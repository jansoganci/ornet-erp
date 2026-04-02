import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import {
  Smartphone,
  Signal,
  User,
  MapPin,
  DollarSign,
  FileText,
  StickyNote,
  ArrowLeft,
  ChevronDown,
  Settings,
  CreditCard,
  UserCheck,
} from 'lucide-react';
import { useSimCard, useCreateSimCard, useUpdateSimCard, useProviderCompanies } from './hooks';
import { simCardSchema, simCardDefaultValues } from './schema';
import { useCustomer } from '../customers/hooks';
import { useSitesByCustomer } from '../customerSites/hooks';
import { PageContainer } from '../../components/layout';
import { Button, Card, Input, Spinner, Textarea, Select, FormSkeleton, CustomerCombobox } from '../../components/ui';
import { SimCardFormHero } from './components/SimCardFormHero';
import { getCurrencySymbol, cn } from '../../lib/utils';

const MOBILE_CARD = 'rounded-xl border border-neutral-200/80 dark:border-[#262626] bg-white dark:bg-[#171717] p-5 shadow-sm';

export function SimCardFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation(['simCards', 'common', 'customers']);
  const { t: tCommon } = useTranslation('common');

  const customerIdParam = searchParams.get('customerId');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const isEdit = Boolean(id);
  const { data: simCard, isLoading: simCardLoading } = useSimCard(id);

  const createSimCard = useCreateSimCard();
  const updateSimCard = useUpdateSimCard();

  const { data: providerCompanies } = useProviderCompanies();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(simCardSchema),
    defaultValues: {
      ...simCardDefaultValues,
      customer_id: customerIdParam || null,
    },
  });

  const selectedCustomerId = watch('customer_id');
  const selectedCurrency = watch('currency') || 'TRY';
  const watchedPhone = watch('phone_number');
  const { data: sites } = useSitesByCustomer(selectedCustomerId);
  const { data: selectedCustomer } = useCustomer(selectedCustomerId);

  useEffect(() => {
    if (isEdit && simCard) {
      reset({
        phone_number: simCard.phone_number || '',
        operator: simCard.operator || 'TURKCELL',
        capacity: simCard.capacity || '',
        status: simCard.status || 'available',
        provider_company_id: simCard.provider_company_id || null,
        customer_label: simCard.customer_label || '',
        customer_id: simCard.customer_id || null,
        site_id: simCard.site_id || null,
        imsi: simCard.imsi || '',
        gprs_serial_no: simCard.gprs_serial_no || '',
        account_no: simCard.account_no || '',
        cost_price: simCard.cost_price || 0,
        sale_price: simCard.sale_price || 0,
        vat_rate: simCard.vat_rate ?? 0,
        currency: simCard.currency || 'TRY',
        notes: simCard.notes || '',
      });
    }
  }, [isEdit, simCard, reset]);

  const onSubmit = async (data) => {
    try {
      if (isEdit) {
        await updateSimCard.mutateAsync({ id, ...data });
      } else {
        await createSimCard.mutateAsync(data);
      }
      navigate('/sim-cards');
    } catch {
      // error handled by mutation onError
    }
  };

  const isSaving = isSubmitting || createSimCard.isPending || updateSimCard.isPending;

  if (isEdit && simCardLoading) {
    return <FormSkeleton />;
  }

  const siteOptions = sites?.map(s => {
    const loc = [s.site_name, s.address, s.district, s.city].filter(Boolean).join(', ');
    return {
      value: s.id,
      label: loc ? `${loc} (${s.account_no || '---'})` : `Hesap: ${s.account_no || '---'}`
    };
  }) || [];

  const operatorOptions = [
    { value: 'TURKCELL', label: t('operators.TURKCELL') },
    { value: 'VODAFONE', label: t('operators.VODAFONE') },
    { value: 'TURK_TELEKOM', label: t('operators.TURK_TELEKOM') },
  ];

  const statusOptions = [
    { value: 'available', label: t('status.available') },
    { value: 'active', label: t('status.active') },
    { value: 'subscription', label: t('status.subscription') },
    { value: 'cancelled', label: t('status.cancelled') },
  ];

  const providerOptions = [
    { value: '', label: t('simCards:form.placeholders.selectProvider') },
    ...(providerCompanies || []).map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <PageContainer maxWidth="4xl" padding="default" className="space-y-8 pb-24 mx-auto">
      {/* Mobile Sticky Header — md:hidden */}
      <div className="md:hidden sticky top-0 z-30 -mx-4 -mt-8 px-4 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-neutral-200/60 dark:border-[#262626]">
        <div className="flex items-center justify-between h-14">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center justify-center w-10 h-10 -ml-2 rounded-xl text-primary-600 dark:text-primary-400 active:scale-95 transition-transform"
            aria-label={tCommon('actions.back')}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0 px-3 text-center">
            <p className="text-base font-bold text-primary-600 dark:text-primary-400 leading-tight truncate">
              {isEdit ? t('simCards:form.editTitle') : t('simCards:form.addTitle')}
            </p>
            {watchedPhone && (
              <p className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400 tracking-tight truncate">
                {watchedPhone}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleSubmit(onSubmit)}
            disabled={isSaving}
            className="text-primary-600 dark:text-primary-400 font-bold text-base active:scale-95 transition-transform px-2 disabled:opacity-50"
          >
            {isSaving ? <Spinner size="sm" /> : tCommon('actions.save')}
          </button>
        </div>
      </div>

      {/* Desktop Hero — hidden on mobile */}
      <div className="hidden md:block">
        <SimCardFormHero
          isEdit={isEdit}
          onCancel={() => navigate(-1)}
          onSave={handleSubmit(onSubmit)}
          isSaving={isSaving}
          selectedCustomer={selectedCustomer}
        />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* ======= MOBILE LAYOUT — md:hidden ======= */}
        <div className="md:hidden space-y-6">
          {/* Section 1 — SIM Bilgileri */}
          <div className={MOBILE_CARD}>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg bg-primary-50 dark:bg-primary-950/30">
                <Smartphone className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              </div>
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
                {t('simCards:form.sections.simInfo')}
              </h2>
            </div>
            <div className="space-y-4">
              <Input
                label={t('simCards:form.phoneNumber')}
                placeholder="05xx xxx xx xx"
                error={errors.phone_number?.message}
                className="rounded-xl font-mono"
                {...register('phone_number')}
              />
              <div className="grid grid-cols-2 gap-3">
                <Select
                  label={t('simCards:form.operator')}
                  options={operatorOptions}
                  placeholder={t('simCards:form.placeholders.selectOperator')}
                  error={errors.operator?.message}
                  className="rounded-xl"
                  {...register('operator')}
                />
                <Input
                  label={t('simCards:form.capacity')}
                  placeholder="1GB"
                  error={errors.capacity?.message}
                  className="rounded-xl"
                  {...register('capacity')}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Controller
                  name="provider_company_id"
                  control={control}
                  render={({ field }) => (
                    <Select
                      label={t('simCards:list.columns.provider')}
                      options={providerOptions}
                      placeholder={t('simCards:form.placeholders.selectProvider')}
                      error={errors.provider_company_id?.message}
                      value={field.value || ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                      className="rounded-xl"
                    />
                  )}
                />
                <Select
                  label={t('simCards:list.columns.status')}
                  options={statusOptions}
                  placeholder={t('simCards:form.placeholders.selectStatus')}
                  error={errors.status?.message}
                  className="rounded-xl"
                  {...register('status')}
                />
              </div>
            </div>
          </div>

          {/* Section 2 — Atama Bilgileri */}
          <div className={MOBILE_CARD}>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
                {t('simCards:form.sections.assignment')}
              </h2>
            </div>
            <div className="space-y-4">
              <Controller
                name="customer_id"
                control={control}
                render={({ field }) => (
                  <CustomerCombobox
                    label={t('simCards:list.columns.customer')}
                    value={field.value || ''}
                    selectedCustomer={selectedCustomer}
                    onChange={(cid) => {
                      field.onChange(cid || null);
                      setValue('site_id', null);
                    }}
                    placeholder={t('simCards:form.placeholders.selectCustomer')}
                    error={errors.customer_id?.message}
                  />
                )}
              />
              <Controller
                name="site_id"
                control={control}
                render={({ field }) => (
                  <Select
                    label={t('simCards:list.columns.site')}
                    options={siteOptions}
                    placeholder={selectedCustomerId ? t('simCards:form.placeholders.selectSite') : t('simCards:form.placeholders.selectCustomerFirst')}
                    disabled={!selectedCustomerId}
                    error={errors.site_id?.message}
                    value={field.value || ''}
                    onChange={(e) => field.onChange(e.target.value || null)}
                    className="rounded-xl"
                  />
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label={t('simCards:form.customerLabel')}
                  placeholder={t('simCards:form.placeholders.customerLabel')}
                  error={errors.customer_label?.message}
                  className="rounded-xl"
                  {...register('customer_label')}
                />
                <Input
                  label={t('simCards:form.accountNo')}
                  placeholder="ORN-XXXX"
                  error={errors.account_no?.message}
                  className="rounded-xl font-mono"
                  {...register('account_no')}
                />
              </div>
            </div>
          </div>

          {/* Section 3 — Gelişmiş (collapsible) */}
          <div className={cn('rounded-xl border border-neutral-200/80 dark:border-[#262626] bg-white dark:bg-[#171717] shadow-sm overflow-hidden')}>
            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              className="w-full flex items-center justify-between p-5 active:bg-neutral-50 dark:active:bg-neutral-800/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800">
                  <Settings className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
                </div>
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
                  {t('simCards:form.sections.advanced')}
                </h2>
              </div>
              <ChevronDown className={cn(
                'w-4 h-4 text-neutral-400 transition-transform duration-200',
                advancedOpen && 'rotate-180'
              )} />
            </button>
            {advancedOpen && (
              <div className="px-5 pb-5 space-y-4">
                <Input
                  label={t('simCards:form.imsi')}
                  placeholder="IMSI"
                  error={errors.imsi?.message}
                  className="rounded-xl"
                  {...register('imsi')}
                />
                <Input
                  label={t('simCards:form.gprsSerialNo')}
                  placeholder="GPRS Seri No"
                  error={errors.gprs_serial_no?.message}
                  className="rounded-xl"
                  {...register('gprs_serial_no')}
                />
              </div>
            )}
          </div>

          {/* Section 4 — Finansal Bilgiler */}
          <div className={MOBILE_CARD}>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
                {t('simCards:form.sections.financial')}
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t('simCards:form.costPrice')}
                type="number"
                step="0.01"
                rightIcon={<span className="text-neutral-400 font-bold">{getCurrencySymbol(selectedCurrency)}</span>}
                error={errors.cost_price?.message}
                className="rounded-xl"
                {...register('cost_price', { valueAsNumber: true })}
              />
              <Input
                label={t('simCards:form.salePrice')}
                type="number"
                step="0.01"
                rightIcon={<span className="text-neutral-400 font-bold">{getCurrencySymbol(selectedCurrency)}</span>}
                error={errors.sale_price?.message}
                className="rounded-xl"
                {...register('sale_price', { valueAsNumber: true })}
              />
              <Input
                label={t('simCards:form.vatRate')}
                type="number"
                min={0}
                max={100}
                step="0.01"
                rightIcon={<span className="text-neutral-400 font-bold">%</span>}
                error={errors.vat_rate?.message}
                className="rounded-xl"
                {...register('vat_rate')}
              />
              <Select
                label={tCommon('fields.currency')}
                options={['TRY', 'USD', 'EUR'].map(c => ({ value: c, label: t(`common:currencies.${c}`) }))}
                error={errors.currency?.message}
                className="rounded-xl"
                {...register('currency')}
              />
            </div>
          </div>

          {/* Section 5 — Notlar */}
          <div className={MOBILE_CARD}>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
                {t('simCards:form.sections.notes')}
              </h2>
            </div>
            <Textarea
              placeholder={t('simCards:form.notes')}
              rows={3}
              error={errors.notes?.message}
              className="rounded-xl"
              {...register('notes')}
            />
          </div>
        </div>

        {/* ======= DESKTOP LAYOUT — hidden md:block ======= */}
        <div className="hidden md:block space-y-8">
          {/* 1. SIM Information */}
          <Card header={
            <div className="flex items-center space-x-3 px-2">
              <div className="p-2 bg-primary-50 dark:bg-primary-950/30 rounded-lg">
                <Smartphone className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              </div>
              <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-[0.2em] text-[10px]">
                {t('simCards:form.addTitle')}
              </h3>
            </div>
          } className="rounded-[2rem] p-8 border-neutral-200/60 dark:border-[#262626] shadow-sm">
            <div className="space-y-10 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Input
                  label={t('simCards:form.phoneNumber')}
                  placeholder="05xx xxx xx xx"
                  error={errors.phone_number?.message}
                  className="rounded-xl"
                  {...register('phone_number')}
                />

                <Select
                  label={t('simCards:form.operator')}
                  options={operatorOptions}
                  placeholder={t('simCards:form.placeholders.selectOperator')}
                  error={errors.operator?.message}
                  className="rounded-xl"
                  {...register('operator')}
                />

                <Input
                  label={t('simCards:form.capacity')}
                  placeholder="50 MB, 1 GB..."
                  error={errors.capacity?.message}
                  className="rounded-xl"
                  {...register('capacity')}
                />

                <Controller
                  name="provider_company_id"
                  control={control}
                  render={({ field }) => (
                    <Select
                      label={t('simCards:list.columns.provider')}
                      options={providerOptions}
                      placeholder={t('simCards:form.placeholders.selectProvider')}
                      error={errors.provider_company_id?.message}
                      value={field.value || ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                      className="rounded-xl"
                    />
                  )}
                />

                <Select
                  label={t('simCards:list.columns.status')}
                  options={statusOptions}
                  placeholder={t('simCards:form.placeholders.selectStatus')}
                  error={errors.status?.message}
                  className="rounded-xl"
                  {...register('status')}
                />
              </div>
            </div>
          </Card>

          {/* 2. Assignment */}
          <Card header={
            <div className="flex items-center space-x-3 px-2">
              <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-[0.2em] text-[10px]">
                {t('simCards:history.assignment')}
              </h3>
            </div>
          } className="rounded-[2rem] p-8 border-neutral-200/60 dark:border-[#262626] shadow-sm">
            <div className="space-y-10 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Input
                  label={t('simCards:form.imsi')}
                  placeholder="IMSI"
                  error={errors.imsi?.message}
                  className="rounded-xl"
                  {...register('imsi')}
                />

                <Input
                  label={t('simCards:form.gprsSerialNo')}
                  placeholder="GPRS Seri No"
                  error={errors.gprs_serial_no?.message}
                  className="rounded-xl"
                  {...register('gprs_serial_no')}
                />

                <Input
                  label={t('simCards:form.accountNo')}
                  placeholder="Hesap No"
                  error={errors.account_no?.message}
                  className="rounded-xl"
                  {...register('account_no')}
                />


                <Input
                  label={t('simCards:form.customerLabel')}
                  placeholder={t('simCards:form.placeholders.customerLabel')}
                  error={errors.customer_label?.message}
                  className="rounded-xl"
                  {...register('customer_label')}
                />

                <Controller
                  name="customer_id"
                  control={control}
                  render={({ field }) => (
                    <CustomerCombobox
                      label={t('simCards:list.columns.customer')}
                      value={field.value || ''}
                      selectedCustomer={selectedCustomer}
                      onChange={(cid) => {
                        field.onChange(cid || null);
                        setValue('site_id', null);
                      }}
                      placeholder={t('simCards:form.placeholders.selectCustomer')}
                      error={errors.customer_id?.message}
                    />
                  )}
                />

                <Controller
                  name="site_id"
                  control={control}
                  render={({ field }) => (
                    <Select
                      label={t('simCards:list.columns.site')}
                      options={siteOptions}
                      placeholder={selectedCustomerId ? t('simCards:form.placeholders.selectSite') : t('simCards:form.placeholders.selectCustomerFirst')}
                      disabled={!selectedCustomerId}
                      error={errors.site_id?.message}
                      value={field.value || ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                      className="rounded-xl"
                    />
                  )}
                />
              </div>
            </div>
          </Card>

          {/* 3. Financials & Notes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card header={
              <div className="flex items-center space-x-3 px-2">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                  <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-[0.2em] text-[10px]">
                  {t('simCards:list.columns.costPrice')} & {t('simCards:list.columns.salePrice')}
                </h3>
              </div>
            } className="rounded-[2rem] p-8 border-neutral-200/60 dark:border-[#262626] shadow-sm">
              <div className="space-y-8 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label={t('simCards:form.costPrice')}
                    type="number"
                    step="0.01"
                    rightIcon={<span className="text-neutral-400 font-bold">{getCurrencySymbol(selectedCurrency)}</span>}
                    error={errors.cost_price?.message}
                    className="rounded-xl"
                    {...register('cost_price', { valueAsNumber: true })}
                  />

                  <Input
                    label={t('simCards:form.salePrice')}
                    type="number"
                    step="0.01"
                    rightIcon={<span className="text-neutral-400 font-bold">{getCurrencySymbol(selectedCurrency)}</span>}
                    error={errors.sale_price?.message}
                    className="rounded-xl"
                    {...register('sale_price', { valueAsNumber: true })}
                  />

                  <Input
                    label={t('simCards:form.vatRate')}
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    rightIcon={<span className="text-neutral-400 font-bold">%</span>}
                    error={errors.vat_rate?.message}
                    className="rounded-xl"
                    {...register('vat_rate')}
                  />
                </div>
                <Select
                  label={tCommon('fields.currency')}
                  options={['TRY', 'USD', 'EUR'].map(c => ({ value: c, label: t(`common:currencies.${c}`) }))}
                  error={errors.currency?.message}
                  className="rounded-xl"
                  {...register('currency')}
                />
              </div>
            </Card>

            <Card header={
              <div className="flex items-center space-x-3 px-2">
                <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                  <StickyNote className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-[0.2em] text-[10px]">
                  {t('simCards:form.notes')}
                </h3>
              </div>
            } className="rounded-[2rem] p-8 border-neutral-200/60 dark:border-[#262626] shadow-sm">
              <div className="pt-4">
                <Textarea
                  placeholder={t('simCards:form.notes')}
                  error={errors.notes?.message}
                  className="rounded-2xl min-h-[120px]"
                  {...register('notes')}
                />
              </div>
            </Card>
          </div>

          {/* Desktop Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" type="button" onClick={() => navigate('/sim-cards')} className="rounded-xl px-8">
              {tCommon('actions.cancel')}
            </Button>
            <Button
              variant="primary"
              type="submit"
              loading={isSaving}
              className="rounded-xl px-8"
            >
              {isEdit ? tCommon('actions.update') : tCommon('actions.create')}
            </Button>
          </div>
        </div>
      </form>

      {/* Mobile Fixed Bottom Action Bar — md:hidden */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-white/80 dark:bg-[#171717]/80 backdrop-blur-md border-t border-neutral-200 dark:border-[#262626] z-50 flex gap-3 md:hidden">
        <Button
          variant="outline"
          type="button"
          className="flex-1 min-h-[48px]"
          onClick={() => navigate(-1)}
        >
          {tCommon('actions.cancel')}
        </Button>
        <Button
          variant="primary"
          type="button"
          className="flex-[2] min-h-[48px]"
          onClick={handleSubmit(onSubmit)}
          loading={isSaving}
        >
          {isEdit ? tCommon('actions.update') : tCommon('actions.save')}
        </Button>
      </div>
    </PageContainer>
  );
}
