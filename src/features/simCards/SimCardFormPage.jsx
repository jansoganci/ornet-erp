import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useSimCard, useCreateSimCard, useUpdateSimCard } from './hooks';
import { simCardSchema, simCardDefaultValues } from './schema';
import { useCustomers } from '../customers/hooks';
import { useSitesByCustomer } from '../customerSites/hooks';
import { PageContainer, PageHeader } from '../../components/layout';
import { Button, Card, Input, Spinner, Textarea, Select } from '../../components/ui';

export function SimCardFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation(['simCards', 'common']);
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
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(simCardSchema),
    defaultValues: {
      ...simCardDefaultValues,
      customer_id: customerIdParam || null,
    },
  });

  const selectedCustomerId = watch('customer_id');
  const { data: sites } = useSitesByCustomer(selectedCustomerId);

  useEffect(() => {
    if (isEdit && simCard) {
      reset({
        phone_number: simCard.phone_number || '',
        imsi: simCard.imsi || '',
        iccid: simCard.iccid || '',
        operator: simCard.operator || 'TURKCELL',
        capacity: simCard.capacity || '',
        account_no: simCard.account_no || '',
        status: simCard.status || 'available',
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
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  if (isEdit && simCardLoading) {
    return (
      <PageContainer maxWidth="md">
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      </PageContainer>
    );
  }

  const customerOptions = customers?.map(c => ({ value: c.id, label: c.company_name })) || [];
  const siteOptions = sites?.map(s => ({ value: s.id, label: s.name })) || [];
  
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
    <PageContainer maxWidth="md">
      <PageHeader
        title={isEdit ? t('form.editTitle') : t('form.addTitle')}
        breadcrumbs={[
          { label: t('title'), to: '/sim-cards' },
          { label: isEdit ? t('form.editTitle') : t('form.addTitle') }
        ]}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6">
        <Card className="p-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Input
              label={t('form.phoneNumber')}
              error={errors.phone_number?.message}
              {...register('phone_number')}
            />
            
            <Input
              label={t('form.imsi')}
              error={errors.imsi?.message}
              {...register('imsi')}
            />

            <Input
              label={t('form.iccid')}
              error={errors.iccid?.message}
              {...register('iccid')}
            />

            <Select
              label={t('form.operator')}
              options={operatorOptions}
              error={errors.operator?.message}
              {...register('operator')}
            />

            <Input
              label={t('form.capacity')}
              error={errors.capacity?.message}
              {...register('capacity')}
            />

            <Input
              label={t('form.accountNo')}
              error={errors.account_no?.message}
              {...register('account_no')}
            />

            <Select
              label={t('list.columns.status')}
              options={statusOptions}
              error={errors.status?.message}
              {...register('status')}
            />

            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              <Controller
                name="customer_id"
                control={control}
                render={({ field }) => (
                  <Select
                    label={t('list.columns.customer')}
                    options={customerOptions}
                    placeholder={tCommon('placeholders.select')}
                    error={errors.customer_id?.message}
                    value={field.value || ''}
                    onChange={(e) => field.onChange(e.target.value || null)}
                  />
                )}
              />

              <Controller
                name="site_id"
                control={control}
                render={({ field }) => (
                  <Select
                    label={t('list.columns.site')}
                    options={siteOptions}
                    placeholder={tCommon('placeholders.select')}
                    disabled={!selectedCustomerId}
                    error={errors.site_id?.message}
                    value={field.value || ''}
                    onChange={(e) => field.onChange(e.target.value || null)}
                  />
                )}
              />
            </div>

            <Input
              label={t('form.costPrice')}
              type="number"
              step="0.01"
              error={errors.cost_price?.message}
              {...register('cost_price', { valueAsNumber: true })}
            />

            <Input
              label={t('form.salePrice')}
              type="number"
              step="0.01"
              error={errors.sale_price?.message}
              {...register('sale_price', { valueAsNumber: true })}
            />

            <div className="md:col-span-2">
              <Textarea
                label={t('form.notes')}
                error={errors.notes?.message}
                {...register('notes')}
              />
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => navigate('/sim-cards')}>
              {tCommon('actions.cancel')}
            </Button>
            <Button
              variant="primary"
              type="submit"
              loading={isSubmitting || createSimCard.isPending || updateSimCard.isPending}
            >
              {isEdit ? tCommon('actions.update') : tCommon('actions.create')}
            </Button>
          </div>
        </Card>
      </form>
    </PageContainer>
  );
}
