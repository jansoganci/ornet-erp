import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo } from 'react';
import { Smartphone, Signal, User, MapPin, DollarSign, FileText, StickyNote } from 'lucide-react';
import { useSimCard, useCreateSimCard, useUpdateSimCard } from './hooks';
import { simCardSchema, simCardDefaultValues } from './schema';
import { useCustomers } from '../customers/hooks';
import { useSitesByCustomer } from '../customerSites/hooks';
import { PageContainer } from '../../components/layout';
import { Button, Card, Input, Spinner, Textarea, Select, FormSkeleton } from '../../components/ui';
import { SimCardFormHero } from './components/SimCardFormHero';
import { getCurrencySymbol } from '../../lib/utils';

export function SimCardFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation(['simCards', 'common', 'customers']);
  const { t: tCommon } = useTranslation('common');

  const customerIdParam = searchParams.get('customerId');

  const isEdit = Boolean(id);
  const { data: simCard, isLoading: simCardLoading } = useSimCard(id);

  const createSimCard = useCreateSimCard();
  const updateSimCard = useUpdateSimCard();

  const { data: customers } = useCustomers();
  
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
  const { data: sites } = useSitesByCustomer(selectedCustomerId);

  const selectedCustomer = useMemo(() => 
    customers?.find(c => c.id === selectedCustomerId),
    [customers, selectedCustomerId]
  );

  useEffect(() => {
    if (isEdit && simCard) {
      reset({
        phone_number: simCard.phone_number || '',
        operator: simCard.operator || 'TURKCELL',
        capacity: simCard.capacity || '',
        status: simCard.status || 'available',
        buyer_id: simCard.buyer_id || null,
        customer_id: simCard.customer_id || null,
        site_id: simCard.site_id || null,
        cost_price: simCard.cost_price || 0,
        sale_price: simCard.sale_price || 0,
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

  if (isEdit && simCardLoading) {
    return <FormSkeleton />;
  }

  const customerOptions = customers?.map(c => ({ value: c.id, label: c.company_name })) || [];
  const siteOptions = sites?.map(s => ({ 
    value: s.id, 
    label: s.site_name ? `${s.site_name} (${s.account_no || '---'})` : `${s.address} (${s.account_no || '---'})`
  })) || [];
  
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

  return (
    <PageContainer maxWidth="4xl" padding="default" className="space-y-8 pb-24 mx-auto">
      <SimCardFormHero
        isEdit={isEdit}
        onCancel={() => navigate(-1)}
        onSave={handleSubmit(onSubmit)}
        isSaving={isSubmitting || createSimCard.isPending || updateSimCard.isPending}
        selectedCustomer={selectedCustomer}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
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
              <Controller
                name="buyer_id"
                control={control}
                render={({ field }) => (
                  <Select
                    label={t('simCards:form.buyer')}
                    options={customerOptions}
                    placeholder={t('simCards:form.placeholders.selectBuyer')}
                    error={errors.buyer_id?.message}
                    value={field.value || ''}
                    onChange={(e) => field.onChange(e.target.value || null)}
                    className="rounded-xl"
                  />
                )}
              />

              <div className="hidden md:block" />

              <Controller
                name="customer_id"
                control={control}
                render={({ field }) => (
                  <Select
                    label={t('simCards:list.columns.customer')}
                    options={customerOptions}
                    placeholder={t('simCards:form.placeholders.selectCustomer')}
                    error={errors.customer_id?.message}
                    value={field.value || ''}
                    onChange={(e) => {
                      field.onChange(e.target.value || null);
                      setValue('site_id', null);
                    }}
                    className="rounded-xl"
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
              </div>
              <Select
                label={t('common:fields.currency')}
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

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" type="button" onClick={() => navigate('/sim-cards')} className="rounded-xl px-8">
            {tCommon('actions.cancel')}
          </Button>
          <Button
            variant="primary"
            type="submit"
            loading={isSubmitting || createSimCard.isPending || updateSimCard.isPending}
            className="rounded-xl px-8"
          >
            {isEdit ? tCommon('actions.update') : tCommon('actions.create')}
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}
