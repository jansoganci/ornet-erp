import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCustomer, useCreateCustomer, useUpdateCustomer } from './hooks';
import { customerSchema, customerDefaultValues } from './schema';
import { PageContainer, PageHeader } from '../../components/layout';
import { Button, Card, Input, Spinner, Textarea } from '../../components/ui';
import { useEffect } from 'react';
import { maskPhone } from '../../lib/utils';

export function CustomerFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation(['customers', 'common', 'errors']);
  const { t: tCommon } = useTranslation('common');

  const isEdit = Boolean(id);
  const { data: customer, isLoading: customerLoading } = useCustomer(id);
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(customerSchema),
    defaultValues: customerDefaultValues,
  });

  // Populate form when editing
  useEffect(() => {
    if (isEdit && customer) {
      reset({
        company_name: customer.company_name || '',
        phone: customer.phone || '',
        phone_secondary: customer.phone_secondary || '',
        email: customer.email || '',
        tax_number: customer.tax_number || '',
        notes: customer.notes || '',
      });
    }
  }, [isEdit, customer, reset]);

  const handleBack = () => {
    if (isEdit) {
      navigate(`/customers/${id}`);
    } else {
      navigate('/customers');
    }
  };

  const onSubmit = async (data) => {
    try {
      // Clean empty strings to null
      const cleanedData = Object.fromEntries(
        Object.entries(data).map(([key, value]) => [
          key,
          value === '' ? null : value,
        ])
      );

      if (isEdit) {
        await updateCustomer.mutateAsync({ id, ...cleanedData });
        navigate(`/customers/${id}`);
      } else {
        const newCustomer = await createCustomer.mutateAsync(cleanedData);
        navigate(`/customers/${newCustomer.id}`);
      }
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  if (isEdit && customerLoading) {
    return (
      <PageContainer maxWidth="md" padding="default">
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="md" padding="default">
      <PageHeader
        title={isEdit ? t('customers:form.editTitle') : t('customers:form.addTitle')}
        breadcrumbs={[
          { label: tCommon('nav.customers') || 'Müşteriler', to: '/customers' },
          ...(isEdit && customer ? [{ label: customer.company_name, to: `/customers/${id}` }] : []),
          { label: isEdit ? t('customers:form.editTitle') : t('customers:form.addTitle') }
        ]}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6">
        <Card className="p-6">
          <div className="grid grid-cols-1 gap-y-8 lg:grid-cols-2 lg:gap-6">
            <div className="lg:col-span-2">
              <Input
                label={t('customers:form.fields.companyName')}
                placeholder={t('customers:form.placeholders.companyName')}
                error={errors.company_name?.message}
                {...register('company_name')}
              />
            </div>

            <Input
              label={t('customers:form.fields.phone')}
              placeholder={t('customers:form.placeholders.phone')}
              error={errors.phone?.message}
              {...register('phone', {
                onChange: (e) => {
                  e.target.value = maskPhone(e.target.value);
                }
              })}
            />

            <Input
              label={t('customers:form.fields.phoneSecondary')}
              placeholder={t('customers:form.placeholders.phoneSecondary')}
              error={errors.phone_secondary?.message}
              {...register('phone_secondary', {
                onChange: (e) => {
                  e.target.value = maskPhone(e.target.value);
                }
              })}
            />

            <Input
              label={t('customers:form.fields.email')}
              type="email"
              placeholder={t('customers:form.placeholders.email')}
              error={errors.email?.message}
              {...register('email')}
            />

            <Input
              label={t('customers:form.fields.taxNumber')}
              placeholder={t('customers:form.placeholders.taxNumber')}
              error={errors.tax_number?.message}
              {...register('tax_number')}
            />

            <div className="lg:col-span-2">
              <Textarea
                label={t('common:fields.notes')}
                placeholder={t('common:placeholders.notes')}
                error={errors.notes?.message}
                {...register('notes')}
              />
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-neutral-200 dark:border-[#262626] flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={handleBack}>
              {tCommon('actions.cancel')}
            </Button>
            <Button
              variant="primary"
              type="submit"
              loading={isSubmitting || createCustomer.isPending || updateCustomer.isPending}
            >
              {isEdit ? tCommon('actions.update') : tCommon('actions.create')}
            </Button>
          </div>
        </Card>
      </form>
    </PageContainer>
  );
}
