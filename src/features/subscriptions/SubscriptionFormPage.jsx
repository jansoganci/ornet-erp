import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save, X, DollarSign, FileText, Users, StickyNote } from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { PageContainer, PageHeader } from '../../components/layout';
import {
  Button,
  Input,
  Select,
  Card,
  Spinner,
  Textarea,
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
import { CustomerSiteSelector } from '../workOrders/CustomerSiteSelector';
import { toast } from 'sonner';

const BILLING_DAY_OPTIONS = Array.from({ length: 28 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}));

export function SubscriptionFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation(['subscriptions', 'common', 'errors']);
  const { t: tCommon } = useTranslation('common');
  const isEdit = !!id;

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
  const subscriptionType = watch('subscription_type');
  const basePrice = watch('base_price');
  const smsFee = watch('sms_fee');
  const lineFee = watch('line_fee');
  const vatRate = watch('vat_rate');

  const { data: siteData } = useSite(selectedSiteId);

  const [selectedCustomerId, setSelectedCustomerId] = useState('');

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
      });
      if (subscription.customer_id) setSelectedCustomerId(subscription.customer_id);
    }
  }, [subscription, isEdit, reset]);

  // Live computed pricing
  const computedPricing = useMemo(() => {
    const bp = Number(basePrice) || 0;
    const sf = Number(smsFee) || 0;
    const lf = Number(lineFee) || 0;
    const vr = Number(vatRate) || 0;
    const subtotal = bp + sf + lf;
    const vatAmount = Math.round(subtotal * vr / 100 * 100) / 100;
    const total = subtotal + vatAmount;
    return { subtotal, vatAmount, total };
  }, [basePrice, smsFee, lineFee, vatRate]);

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
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <PageContainer maxWidth="lg" padding="default" className="space-y-6 pb-24">
      <PageHeader
        title={isEdit ? t('subscriptions:form.editTitle') : t('subscriptions:form.addTitle')}
        breadcrumbs={[
          { label: t('subscriptions:list.title'), to: '/subscriptions' },
          ...(isEdit && subscription
            ? [{ label: `#${id?.slice(0, 8)}`, to: `/subscriptions/${id}` }]
            : []),
          { label: isEdit ? t('subscriptions:form.editTitle') : t('subscriptions:form.addTitle') },
        ]}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 mt-6">
        <input type="hidden" {...register('site_id')} />

        {/* 1. Customer & Site Selection */}
        <Card className="p-1 overflow-visible">
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
                <div className="flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-primary-600" />
                  <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-sm">
                    {t('subscriptions:form.sections.details')}
                  </h3>
                </div>
              }
              className="p-6"
            >
              <div className="space-y-6">
                {/* Subscription type radio */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    {t('subscriptions:form.fields.subscriptionType')}
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {SUBSCRIPTION_TYPES.map((tp) => (
                      <label
                        key={tp}
                        className={cn(
                          'relative flex items-center px-4 py-2 rounded-xl border-2 cursor-pointer transition-all duration-200',
                          subscriptionType === tp
                            ? 'bg-primary-50 border-primary-600 dark:bg-primary-950/30 dark:border-primary-500'
                            : 'bg-white border-neutral-200 hover:border-neutral-300 dark:bg-[#171717] dark:border-[#262626]'
                        )}
                      >
                        <input
                          type="radio"
                          className="sr-only"
                          value={tp}
                          {...register('subscription_type')}
                        />
                        <span
                          className={cn(
                            'text-sm font-bold',
                            subscriptionType === tp
                              ? 'text-primary-700 dark:text-primary-400'
                              : 'text-neutral-600 dark:text-neutral-400'
                          )}
                        >
                          {t(`subscriptions:types.${tp}`)}
                        </span>
                      </label>
                    ))}
                  </div>
                  {errors.subscription_type && (
                    <p className="text-sm text-error-600 mt-1">{errors.subscription_type.message}</p>
                  )}
                </div>

                {/* Inline payment fields by type */}
                {subscriptionType === 'recurring_card' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label={t('subscriptions:form.fields.cardBankName')}
                      error={errors.card_bank_name?.message}
                      {...register('card_bank_name')}
                    />
                    <Input
                      label={t('subscriptions:form.fields.cardLast4')}
                      maxLength={4}
                      placeholder="1234"
                      error={errors.card_last4?.message || errors.payment_method_id?.message}
                      {...register('card_last4')}
                    />
                  </div>
                )}
                {subscriptionType === 'manual_cash' && (
                  <Select
                    label={t('subscriptions:form.fields.cashCollector')}
                    options={profileOptions}
                    error={errors.cash_collector_id?.message}
                    {...register('cash_collector_id')}
                  />
                )}

                <Select
                  label={t('subscriptions:form.fields.serviceType')}
                  options={serviceTypeOptions}
                  error={errors.service_type?.message}
                  {...register('service_type')}
                />
                <Select
                  label={t('subscriptions:form.fields.billingFrequency')}
                  options={billingFrequencyOptions}
                  error={errors.billing_frequency?.message}
                  {...register('billing_frequency')}
                />
                <div className="flex items-center gap-3">
                  <Controller
                    name="official_invoice"
                    control={control}
                    render={({ field }) => (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                          className="rounded border-neutral-300 dark:border-neutral-600 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-sm text-neutral-700 dark:text-neutral-300">
                          {t('subscriptions:form.fields.officialInvoice')}
                        </span>
                      </label>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label={t('subscriptions:form.fields.startDate')}
                    type="date"
                    error={errors.start_date?.message}
                    {...register('start_date')}
                  />
                  <Select
                    label={t('subscriptions:form.fields.billingDay')}
                    options={BILLING_DAY_OPTIONS}
                    error={errors.billing_day?.message}
                    {...register('billing_day')}
                  />
                </div>
              </div>
            </Card>

            {/* 3. Pricing */}
            <Card
              header={
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-5 h-5 text-primary-600" />
                  <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-sm">
                    {t('subscriptions:form.sections.pricing')}
                  </h3>
                </div>
              }
              className="p-6"
            >
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    label={t('subscriptions:form.fields.basePrice')}
                    type="number"
                    step="0.01"
                    rightIcon={<span className="text-neutral-400">₺</span>}
                    error={errors.base_price?.message}
                    {...register('base_price')}
                  />
                  <Input
                    label={t('subscriptions:form.fields.smsFee')}
                    type="number"
                    step="0.01"
                    rightIcon={<span className="text-neutral-400">₺</span>}
                    error={errors.sms_fee?.message}
                    {...register('sms_fee')}
                  />
                  <Input
                    label={t('subscriptions:form.fields.lineFee')}
                    type="number"
                    step="0.01"
                    rightIcon={<span className="text-neutral-400">₺</span>}
                    error={errors.line_fee?.message}
                    {...register('line_fee')}
                  />
                </div>

                <Input
                  label={t('subscriptions:form.fields.vatRate')}
                  type="number"
                  step="1"
                  rightIcon={<span className="text-neutral-400">%</span>}
                  error={errors.vat_rate?.message}
                  {...register('vat_rate')}
                />

                {isAdmin && (
                  <Input
                    label={t('subscriptions:form.fields.cost')}
                    type="number"
                    step="0.01"
                    rightIcon={<span className="text-neutral-400">₺</span>}
                    error={errors.cost?.message}
                    {...register('cost')}
                  />
                )}

                {/* Computed pricing */}
                <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-900/50 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">{t('subscriptions:detail.fields.subtotal')}</span>
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">
                      {formatCurrency(computedPricing.subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">{t('subscriptions:detail.fields.vatAmount')}</span>
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">
                      {formatCurrency(computedPricing.vatAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-neutral-200 dark:border-neutral-700 pt-2">
                    <span className="font-bold text-neutral-700 dark:text-neutral-200">
                      {t('subscriptions:detail.fields.totalAmount')}
                    </span>
                    <span className="font-black text-primary-700 dark:text-primary-300">
                      {formatCurrency(computedPricing.total)}
                    </span>
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
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-primary-600" />
                  <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-sm">
                    {t('subscriptions:form.sections.assignment')}
                  </h3>
                </div>
              }
              className="p-6"
            >
              <div className="space-y-4">
                <Select
                  label={t('subscriptions:form.fields.soldBy')}
                  options={profileOptions}
                  error={errors.sold_by?.message}
                  {...register('sold_by')}
                />
                <Select
                  label={t('subscriptions:form.fields.managedBy')}
                  options={profileOptions}
                  error={errors.managed_by?.message}
                  {...register('managed_by')}
                />
              </div>
            </Card>

            {/* 6. Notes */}
            <Card
              header={
                <div className="flex items-center space-x-2">
                  <StickyNote className="w-5 h-5 text-primary-600" />
                  <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-sm">
                    {t('subscriptions:form.sections.notes')}
                  </h3>
                </div>
              }
              className="p-6"
            >
              <div className="space-y-4">
                <Textarea
                  label={t('subscriptions:form.fields.setupNotes')}
                  placeholder={t('subscriptions:form.placeholders.setupNotes')}
                  error={errors.setup_notes?.message}
                  {...register('setup_notes')}
                />
                <Textarea
                  label={t('subscriptions:form.fields.notes')}
                  placeholder={t('subscriptions:form.placeholders.notes')}
                  error={errors.notes?.message}
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
