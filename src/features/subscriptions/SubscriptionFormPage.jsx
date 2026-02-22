import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save, X, DollarSign, FileText, Users, StickyNote, CreditCard, Wallet, Banknote, RefreshCw } from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { PageContainer } from '../../components/layout';
import {
  Button,
  Input,
  Select,
  Card,
  Spinner,
  Textarea,
  SimCardCombobox,
  FormSkeleton,
} from '../../components/ui';
import { subscriptionSchema, subscriptionDefaultValues, SUBSCRIPTION_TYPES, SERVICE_TYPES, BILLING_FREQUENCIES } from './schema';
import {
  useSubscription,
  useCreateSubscription,
  useUpdateSubscription,
  useCurrentProfile,
} from './hooks';
import { useProfiles } from '../tasks/hooks';
import { useSite } from '../customerSites/hooks';
import { useSimCard } from '../simCards/hooks';
import { CustomerSiteSelector } from '../workOrders/CustomerSiteSelector';
import { SubscriptionFormHero } from './components/SubscriptionFormHero';
import { toast } from 'sonner';

const BILLING_DAY_OPTIONS = Array.from({ length: 28 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}));

export function SubscriptionFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation(['subscriptions', 'common', 'errors', 'customers']);
  const { t: tCommon } = useTranslation('common');
  const isEdit = !!id;

  const urlSiteId = searchParams.get('siteId');
  const urlCustomerId = searchParams.get('customerId');

  const { data: subscription, isLoading: isSubLoading } = useSubscription(id);
  const createMutation = useCreateSubscription();
  const updateMutation = useUpdateSubscription();
  const { data: currentProfile } = useCurrentProfile();
  const { data: profiles = [] } = useProfiles();
  const isAdmin = currentProfile?.role === 'admin';

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: subscriptionDefaultValues,
  });

  const selectedSiteId = watch('site_id');
  const simCardId = watch('sim_card_id');
  const subscriptionType = watch('subscription_type');
  const basePrice = watch('base_price');
  const smsFee = watch('sms_fee');
  const lineFee = watch('line_fee');
  const staticIpFee = watch('static_ip_fee');
  const vatRate = watch('vat_rate');
  const selectedCurrency = watch('currency') || 'TRY';

  const { data: siteData } = useSite(selectedSiteId);
  const { data: selectedSim } = useSimCard(simCardId);

  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  // Preselect customer and site from URL params (create mode)
  useEffect(() => {
    if (!isEdit && urlCustomerId && urlSiteId) {
      setSelectedCustomerId(urlCustomerId);
      setValue('site_id', urlSiteId, { shouldValidate: true });
    }
  }, [isEdit, urlCustomerId, urlSiteId, setValue]);

  // Clear sim_card_id when site changes in create mode (selected SIM may not be valid for new site)
  const prevSiteIdRef = useRef('');
  useEffect(() => {
    if (!isEdit && prevSiteIdRef.current !== selectedSiteId) {
      prevSiteIdRef.current = selectedSiteId;
      setValue('sim_card_id', '', { shouldValidate: false });
    }
  }, [selectedSiteId, isEdit, setValue]);

  // Populate form when editing
  useEffect(() => {
    if (subscription && isEdit) {
      reset({
        site_id: subscription.site_id || '',
        subscription_type: subscription.subscription_type || 'recurring_card',
        start_date: subscription.start_date || '',
        billing_day: subscription.billing_day || 1,
        base_price: subscription.base_price ?? '',
        sms_fee: subscription.sms_fee ?? '',
        line_fee: subscription.line_fee ?? '',
        vat_rate: subscription.vat_rate ?? 20,
        cost: subscription.cost ?? '',
        static_ip_fee: subscription.static_ip_fee ?? '',
        static_ip_cost: subscription.static_ip_cost ?? '',
        currency: subscription.currency || 'TRY',
        payment_method_id: subscription.payment_method_id || '',
        sold_by: subscription.sold_by || '',
        managed_by: subscription.managed_by || '',
        notes: subscription.notes || '',
        setup_notes: subscription.setup_notes || '',
        service_type: subscription.service_type || '',
        billing_frequency: subscription.billing_frequency || 'monthly',
        cash_collector_id: subscription.cash_collector_id || '',
        official_invoice: subscription.official_invoice ?? true,
        card_bank_name: subscription.card_bank_name || subscription.pm_bank_name || '',
        card_last4: subscription.card_last4 || subscription.pm_card_last4 || '',
        sim_card_id: subscription.sim_card_id || '',
      });
      if (subscription.customer_id) setSelectedCustomerId(subscription.customer_id);
    }
  }, [subscription, isEdit, reset]);

  // Live computed pricing
  const computedPricing = useMemo(() => {
    const bp = Number(basePrice) || 0;
    const sf = Number(smsFee) || 0;
    const lf = Number(lineFee) || 0;
    const sif = Number(staticIpFee) || 0;
    const vr = Number(vatRate) || 0;
    const subtotal = bp + sf + lf + sif;
    const vatAmount = Math.round(subtotal * vr / 100 * 100) / 100;
    const total = subtotal + vatAmount;
    return { subtotal, vatAmount, total };
  }, [basePrice, smsFee, lineFee, staticIpFee, vatRate]);

  const profileOptions = [
    { value: '', label: t('subscriptions:form.placeholders.selectPerson') },
    ...profiles.map((p) => ({ value: p.id, label: p.full_name })),
  ];

  const serviceTypeOptions = [
    { value: '', label: t('subscriptions:form.placeholders.selectServiceType') },
    ...SERVICE_TYPES.map((v) => ({ value: v, label: t(`subscriptions:serviceTypes.${v}`) })),
  ];

  const billingFrequencyOptions = BILLING_FREQUENCIES.map((v) => ({
    value: v,
    label: t(`subscriptions:form.fields.${v}`),
  }));

  const onSubmit = async (data) => {
    try {
      const cleanValue = (val) => {
        if (val === '' || val === undefined) return null;
        if (typeof val === 'string') return val.trim() || null;
        return val;
      };

      const formattedData = {
        site_id: data.site_id,
        subscription_type: data.subscription_type,
        start_date: data.start_date,
        billing_day: Number(data.billing_day),
        base_price: Number(data.base_price) || 0,
        sms_fee: Number(data.sms_fee) || 0,
        line_fee: Number(data.line_fee) || 0,
        vat_rate: Number(data.vat_rate) || 0,
        cost: Number(data.cost) || 0,
        static_ip_fee: Number(data.static_ip_fee) || 0,
        static_ip_cost: Number(data.static_ip_cost) || 0,
        currency: data.currency || 'TRY',
        payment_method_id: cleanValue(data.payment_method_id),
        sold_by: cleanValue(data.sold_by),
        managed_by: cleanValue(data.managed_by),
        notes: cleanValue(data.notes),
        setup_notes: cleanValue(data.setup_notes),
        service_type: cleanValue(data.service_type),
        billing_frequency: data.billing_frequency || 'monthly',
        cash_collector_id: cleanValue(data.cash_collector_id),
        official_invoice: !!data.official_invoice,
        card_bank_name: cleanValue(data.card_bank_name),
        card_last4: cleanValue(data.card_last4) ? String(data.card_last4).trim().slice(0, 4) : null,
        sim_card_id: cleanValue(data.sim_card_id),
      };

      if (isEdit) {
        await updateMutation.mutateAsync({ id, ...formattedData });
        navigate(`/subscriptions/${id}`);
      } else {
        const newSub = await createMutation.mutateAsync(formattedData);
        navigate(`/subscriptions/${newSub.id}`);
      }
    } catch (err) {
      toast.error(err?.message || t('common:errors.saveFailed'));
    }
  };

  if (isEdit && isSubLoading) {
    return <FormSkeleton />;
  }

  const getSubIcon = (type) => {
    switch (type) {
      case 'recurring_card': return <CreditCard className="w-5 h-5" />;
      case 'manual_cash': return <Wallet className="w-5 h-5" />;
      case 'manual_bank': return <Banknote className="w-5 h-5" />;
      default: return <RefreshCw className="w-5 h-5" />;
    }
  };

  return (
    <PageContainer maxWidth="4xl" padding="default" className="space-y-8 pb-24 mx-auto">
      <SubscriptionFormHero
        isEdit={isEdit}
        onCancel={() => navigate(-1)}
        onSave={handleSubmit(onSubmit)}
        isSaving={isSubmitting || createMutation.isPending || updateMutation.isPending}
        selectedSite={siteData}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <input type="hidden" {...register('site_id')} />

        {/* 1. Customer & Site Selection */}
        <Card className="rounded-[2rem] p-8 overflow-visible border-neutral-200/60 dark:border-[#262626] shadow-sm">
          <CustomerSiteSelector
            selectedCustomerId={selectedCustomerId}
            selectedSiteId={selectedSiteId}
            onCustomerChange={(cid) => setSelectedCustomerId(cid)}
            onSiteChange={(sid) => setValue('site_id', sid, { shouldValidate: true })}
            onAddNewCustomer={() => navigate('/customers/new')}
            onAddNewSite={() => {}}
            error={errors.site_id?.message}
          />
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* 2. Subscription Details */}
            <Card
              header={
                <div className="flex items-center space-x-3 px-2">
                  <div className="p-2 bg-primary-50 dark:bg-primary-950/30 rounded-lg">
                    <FileText className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                  </div>
                  <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-[0.2em] text-[10px]">
                    {t('subscriptions:form.sections.details')}
                  </h3>
                </div>
              }
              className="rounded-[2rem] p-8 border-neutral-200/60 dark:border-[#262626] shadow-sm"
            >
              <div className="space-y-10 pt-4">
                {/* Subscription type grid */}
                <div className="space-y-6">
                  <label className="block text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest ml-1">
                    {t('subscriptions:form.fields.subscriptionType')}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {SUBSCRIPTION_TYPES.map((tp) => (
                      <label
                        key={tp}
                        className={cn(
                          'relative flex flex-col items-center justify-center p-5 rounded-2xl border-2 cursor-pointer transition-all duration-300 group',
                          subscriptionType === tp
                            ? 'bg-primary-50/50 border-primary-600 dark:bg-primary-950/20 dark:border-primary-500 shadow-md scale-[1.02]'
                            : 'bg-white border-neutral-100 hover:border-neutral-300 dark:bg-[#171717] dark:border-[#262626] hover:shadow-sm'
                        )}
                      >
                        <input
                          type="radio"
                          className="sr-only"
                          value={tp}
                          {...register('subscription_type')}
                        />
                        <div className={cn(
                          "mb-3 p-2 rounded-xl transition-colors",
                          subscriptionType === tp ? "bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400" : "bg-neutral-50 dark:bg-neutral-900 text-neutral-400 group-hover:text-neutral-600"
                        )}>
                          {getSubIcon(tp)}
                        </div>
                        <span
                          className={cn(
                            'text-sm font-bold tracking-tight text-center',
                            subscriptionType === tp
                              ? 'text-primary-700 dark:text-primary-400'
                              : 'text-neutral-600 dark:text-neutral-400 group-hover:text-neutral-900'
                          )}
                        >
                          {t(`subscriptions:types.${tp}`)}
                        </span>
                      </label>
                    ))}
                  </div>
                  {errors.subscription_type && (
                    <p className="text-sm text-red-600 mt-2 ml-1">{errors.subscription_type.message}</p>
                  )}
                </div>

                {/* Inline payment fields by type */}
                {subscriptionType === 'recurring_card' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 bg-neutral-50/50 dark:bg-neutral-900/30 rounded-2xl border border-neutral-100 dark:border-[#262626]">
                    <Input
                      label={t('subscriptions:form.fields.cardBankName')}
                      error={errors.card_bank_name?.message}
                      className="rounded-xl"
                      {...register('card_bank_name')}
                    />
                    <Input
                      label={t('subscriptions:form.fields.cardLast4')}
                      maxLength={4}
                      placeholder="1234"
                      error={errors.card_last4?.message || errors.payment_method_id?.message}
                      className="rounded-xl"
                      {...register('card_last4')}
                    />
                  </div>
                )}
                {subscriptionType === 'manual_cash' && (
                  <div className="p-6 bg-neutral-50/50 dark:bg-neutral-900/30 rounded-2xl border border-neutral-100 dark:border-[#262626]">
                    <Select
                      label={t('subscriptions:form.fields.cashCollector')}
                      options={profileOptions}
                      error={errors.cash_collector_id?.message}
                      className="rounded-xl"
                      {...register('cash_collector_id')}
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <Select
                    label={t('subscriptions:form.fields.serviceType')}
                    options={serviceTypeOptions}
                    error={errors.service_type?.message}
                    className="rounded-xl"
                    {...register('service_type')}
                  />
                  <Controller
                    name="sim_card_id"
                    control={control}
                    render={({ field }) => (
                      <SimCardCombobox
                        label={t('subscriptions:form.fields.simCard')}
                        value={field.value || ''}
                        selectedSim={selectedSim}
                        onChange={field.onChange}
                        siteId={selectedSiteId}
                        error={errors.sim_card_id?.message}
                        disabled={!selectedSiteId}
                        className="rounded-xl"
                      />
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <Select
                    label={t('subscriptions:form.fields.billingFrequency')}
                    options={billingFrequencyOptions}
                    error={errors.billing_frequency?.message}
                    className="rounded-xl"
                    {...register('billing_frequency')}
                  />
                  <div className="flex items-end pb-3">
                    <Controller
                      name="official_invoice"
                      control={control}
                      render={({ field }) => (
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <div className={cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                            field.value ? "bg-primary-600 border-primary-600" : "border-neutral-300 dark:border-neutral-700 group-hover:border-primary-500"
                          )}>
                            {field.value && <div className="w-2 h-2 bg-white rounded-full" />}
                          </div>
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={field.value}
                            onChange={(e) => field.onChange(e.target.checked)}
                          />
                          <span className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
                            {t('subscriptions:form.fields.officialInvoice')}
                          </span>
                        </label>
                      )}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <Input
                    label={t('subscriptions:form.fields.startDate')}
                    type="date"
                    error={errors.start_date?.message}
                    className="rounded-xl"
                    {...register('start_date')}
                  />
                  <Select
                    label={t('subscriptions:form.fields.billingDay')}
                    options={BILLING_DAY_OPTIONS}
                    error={errors.billing_day?.message}
                    className="rounded-xl"
                    {...register('billing_day')}
                  />
                </div>
              </div>
            </Card>

            {/* 3. Pricing */}
            <Card
              header={
                <div className="flex items-center space-x-3 px-2">
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                    <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-[0.2em] text-[10px]">
                    {t('subscriptions:form.sections.pricing')}
                  </h3>
                </div>
              }
              className="rounded-[2rem] p-8 border-neutral-200/60 dark:border-[#262626] shadow-sm"
            >
              <div className="space-y-10 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Input
                    label={t('subscriptions:form.fields.basePrice')}
                    type="number"
                    step="0.01"
                    rightIcon={<span className="text-neutral-400 font-bold">₺</span>}
                    error={errors.base_price?.message}
                    className="rounded-xl"
                    {...register('base_price')}
                  />
                  <Input
                    label={t('subscriptions:form.fields.smsFee')}
                    type="number"
                    step="0.01"
                    rightIcon={<span className="text-neutral-400 font-bold">₺</span>}
                    error={errors.sms_fee?.message}
                    className="rounded-xl"
                    {...register('sms_fee')}
                  />
                  <Input
                    label={t('subscriptions:form.fields.lineFee')}
                    type="number"
                    step="0.01"
                    rightIcon={<span className="text-neutral-400 font-bold">₺</span>}
                    error={errors.line_fee?.message}
                    className="rounded-xl"
                    {...register('line_fee')}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <Input
                    label={t('subscriptions:form.fields.staticIpFee')}
                    type="number"
                    step="0.01"
                    rightIcon={<span className="text-neutral-400 font-bold">₺</span>}
                    error={errors.static_ip_fee?.message}
                    className="rounded-xl"
                    {...register('static_ip_fee')}
                  />
                  {isAdmin && (
                    <Input
                      label={t('subscriptions:form.fields.staticIpCost')}
                      type="number"
                      step="0.01"
                      rightIcon={<span className="text-neutral-400 font-bold">₺</span>}
                      error={errors.static_ip_cost?.message}
                      className="rounded-xl"
                      {...register('static_ip_cost')}
                    />
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <Input
                    label={t('subscriptions:form.fields.vatRate')}
                    type="number"
                    step="1"
                    rightIcon={<span className="text-neutral-400 font-bold">%</span>}
                    error={errors.vat_rate?.message}
                    className="rounded-xl"
                    {...register('vat_rate')}
                  />
                  {isAdmin && (
                    <Input
                      label={t('subscriptions:form.fields.cost')}
                      type="number"
                      step="0.01"
                      rightIcon={<span className="text-neutral-400 font-bold">₺</span>}
                      error={errors.cost?.message}
                      className="rounded-xl"
                      {...register('cost')}
                    />
                  )}
                </div>

                {/* Computed pricing - Digital Receipt Style */}
                <div className="p-8 rounded-[2rem] bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-100 dark:border-[#262626] space-y-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full -mr-16 -mt-16 blur-3xl" />
                  
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-neutral-500 font-medium">{t('subscriptions:detail.fields.subtotal')}</span>
                    <span className="font-bold text-neutral-900 dark:text-neutral-100">
                      {formatCurrency(computedPricing.subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-neutral-500 font-medium">{t('subscriptions:detail.fields.vatAmount')}</span>
                    <span className="font-bold text-neutral-900 dark:text-neutral-100">
                      {formatCurrency(computedPricing.vatAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-6 border-t border-neutral-200 dark:border-neutral-800">
                    <span className="text-lg font-black text-neutral-900 dark:text-neutral-100 tracking-tight">
                      {t('subscriptions:detail.fields.totalAmount')}
                    </span>
                    <div className="text-right">
                      <span className="text-2xl font-black text-primary-600 dark:text-primary-400 tracking-tighter">
                        {formatCurrency(computedPricing.total)}
                      </span>
                      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-1">
                        {t(`common:currencies.${selectedCurrency}`)} / {t(`subscriptions:form.fields.${watch('billing_frequency')}`)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Right sidebar */}
          <div className="space-y-8">
            {/* 5. Assignment */}
            <Card
              header={
                <div className="flex items-center space-x-3 px-2">
                  <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                    <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-[0.2em] text-[10px]">
                    {t('subscriptions:form.sections.assignment')}
                  </h3>
                </div>
              }
              className="rounded-[2rem] p-8 border-neutral-200/60 dark:border-[#262626] shadow-sm"
            >
              <div className="space-y-6 pt-4">
                <Select
                  label={t('subscriptions:form.fields.soldBy')}
                  options={profileOptions}
                  error={errors.sold_by?.message}
                  className="rounded-xl"
                  {...register('sold_by')}
                />
                <Select
                  label={t('subscriptions:form.fields.managedBy')}
                  options={profileOptions}
                  error={errors.managed_by?.message}
                  className="rounded-xl"
                  {...register('managed_by')}
                />
              </div>
            </Card>

            {/* 6. Notes */}
            <Card
              header={
                <div className="flex items-center space-x-3 px-2">
                  <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                    <StickyNote className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-[0.2em] text-[10px]">
                    {t('subscriptions:form.sections.notes')}
                  </h3>
                </div>
              }
              className="rounded-[2rem] p-8 border-neutral-200/60 dark:border-[#262626] shadow-sm"
            >
              <div className="space-y-6 pt-4">
                <Textarea
                  label={t('subscriptions:form.fields.setupNotes')}
                  placeholder={t('subscriptions:form.placeholders.setupNotes')}
                  error={errors.setup_notes?.message}
                  className="rounded-xl min-h-[100px]"
                  {...register('setup_notes')}
                />
                <Textarea
                  label={t('subscriptions:form.fields.notes')}
                  placeholder={t('subscriptions:form.placeholders.notes')}
                  error={errors.notes?.message}
                  className="rounded-xl min-h-[100px]"
                  {...register('notes')}
                />
              </div>
            </Card>
          </div>
        </div>

        {/* Floating Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-[#171717]/80 backdrop-blur-md border-t border-neutral-200 dark:border-[#262626] z-50 flex gap-3 lg:static lg:bg-transparent lg:border-none lg:p-0 lg:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(-1)}
            className="flex-1 lg:flex-none"
            leftIcon={<X className="w-4 h-4" />}
          >
            {tCommon('actions.cancel')}
          </Button>
          <Button
            type="submit"
            loading={isSubmitting || createMutation.isPending || updateMutation.isPending}
            className="flex-1 lg:flex-none"
            leftIcon={<Save className="w-4 h-4" />}
          >
            {isEdit ? tCommon('actions.save') : tCommon('actions.create')}
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}
