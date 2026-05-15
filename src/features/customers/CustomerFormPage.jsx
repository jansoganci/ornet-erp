import { useParams, useNavigate, Navigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCustomer, useCreateCustomer, useUpdateCustomer } from './hooks';
import { useSitesByCustomer, useCreateSite, useUpdateSite } from '../customerSites/hooks';
import {
  customerCreateSchema,
  customerCreateDefaultValues,
} from './schema';
import { PageContainer, PageHeader } from '../../components/layout';
import { Button, Card, Input, Select, Textarea, FormSkeleton } from '../../components/ui';
import { useEffect } from 'react';
import { maskPhone } from '../../lib/utils';
import { useRole } from '../../lib/roles';

const FIRST_SITE_KEYS = [
  'first_site_site_name',
  'first_site_account_no',
  'first_site_address',
  'first_site_city',
  'first_site_district',
  'first_site_contact_name',
  'first_site_contact_phone',
  'first_site_alarm_center',
  'first_site_panel_info',
  'first_site_connection_date',
  'first_site_notes',
];

function hasFirstSiteData(data) {
  return FIRST_SITE_KEYS.some((key) => {
    const v = data[key];
    return typeof v === 'string' && v.trim() !== '';
  });
}

function buildSitePayload(data) {
  return {
    site_name: data.first_site_site_name?.trim() || null,
    account_no: data.first_site_account_no?.trim() || null,
    address: data.first_site_address?.trim() || null,
    city: data.first_site_city?.trim() || null,
    district: data.first_site_district?.trim() || null,
    contact_name: data.first_site_contact_name?.trim() || null,
    contact_phone: data.first_site_contact_phone?.trim() || null,
    alarm_center: data.first_site_alarm_center?.trim() || null,
    panel_info: data.first_site_panel_info?.trim() || null,
    connection_date: data.first_site_connection_date || null,
    notes: data.first_site_notes?.trim() || null,
  };
}

export function CustomerFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation(['customers', 'common', 'errors']);
  const { t: tCommon } = useTranslation('common');
  const { isFieldWorker } = useRole();

  const isEdit = Boolean(id);

  const { data: customer, isLoading: customerLoading } = useCustomer(id);
  const { data: sites = [], isLoading: sitesLoading } = useSitesByCustomer(id);
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const createSite = useCreateSite();
  const updateSite = useUpdateSite();

  const firstSite = sites.length > 0 ? sites[0] : null;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(customerCreateSchema),
    defaultValues: customerCreateDefaultValues,
  });

  // Populate form when editing (customer + first site if any)
  useEffect(() => {
    if (isEdit && customer) {
      const base = {
        company_name: customer.company_name || '',
        subscriber_title: customer.subscriber_title || '',
        phone: customer.phone || '',
        phone_secondary: customer.phone_secondary || '',
        email: customer.email || '',
        tax_number: customer.tax_number || '',
        identity_type: customer.identity_type || '',
        tax_office: customer.tax_office || '',
        notes: customer.notes || '',
      };
      const siteFields = firstSite
        ? {
            first_site_site_name: firstSite.site_name || '',
            first_site_account_no: firstSite.account_no || '',
            first_site_address: firstSite.address || '',
            first_site_city: firstSite.city || '',
            first_site_district: firstSite.district || '',
            first_site_contact_name: firstSite.contact_name || '',
            first_site_contact_phone: firstSite.contact_phone || '',
            first_site_alarm_center: firstSite.alarm_center || '',
            first_site_panel_info: firstSite.panel_info || '',
            first_site_connection_date: firstSite.connection_date || '',
            first_site_notes: firstSite.notes || '',
          }
        : {
            first_site_site_name: '',
            first_site_account_no: '',
            first_site_address: '',
            first_site_city: '',
            first_site_district: '',
            first_site_contact_name: '',
            first_site_contact_phone: '',
            first_site_alarm_center: '',
            first_site_panel_info: '',
            first_site_connection_date: '',
            first_site_notes: '',
          };
      reset({ ...base, ...siteFields });
    }
  }, [isEdit, customer, firstSite, reset]);

  const handleBack = () => {
    if (isEdit) {
      navigate(`/customers/${id}`);
    } else {
      navigate('/customers');
    }
  };

  const onSubmit = async (data) => {
    try {
      if (isEdit) {
        const customerData = Object.fromEntries(
          Object.entries(data)
            .filter(([k]) => !FIRST_SITE_KEYS.includes(k))
            .map(([key, value]) => [key, value === '' ? null : value])
        );
        await updateCustomer.mutateAsync({ id, ...customerData });
        if (sites.length === 0 && hasFirstSiteData(data)) {
          const sitePayload = {
            customer_id: id,
            ...buildSitePayload(data),
          };
          await createSite.mutateAsync(sitePayload);
        } else if (sites.length >= 1) {
          const sitePayload = buildSitePayload(data);
          await updateSite.mutateAsync({ id: firstSite.id, data: sitePayload });
        }
        navigate(`/customers/${id}`);
      } else {
        const customerData = Object.fromEntries(
          Object.entries(data)
            .filter(([k]) => !FIRST_SITE_KEYS.includes(k))
            .map(([key, value]) => [key, value === '' ? null : value])
        );
        const newCustomer = await createCustomer.mutateAsync(customerData);
        if (hasFirstSiteData(data)) {
          const sitePayload = {
            customer_id: newCustomer.id,
            ...buildSitePayload(data),
          };
          await createSite.mutateAsync(sitePayload);
        }
        navigate(`/customers/${newCustomer.id}`);
      }
    } catch {
      // error handled by mutation onError
    }
  };

  if (isEdit && (customerLoading || sitesLoading)) {
    return <FormSkeleton />;
  }

  if (isFieldWorker) return <Navigate to="/customers" replace />;

  return (
    <PageContainer maxWidth="4xl" padding="default">
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

            <div className="lg:col-span-2">
              <Input
                label={t('customers:form.fields.subscriberTitle')}
                placeholder={t('customers:form.placeholders.subscriberTitle')}
                error={errors.subscriber_title?.message}
                {...register('subscriber_title')}
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

            <Select
              label={t('customers:form.fields.identityType')}
              placeholder={t('customers:form.placeholders.identityType')}
              error={errors.identity_type?.message}
              options={[
                { value: 'vkn', label: t('customers:form.identityTypes.vkn') },
                { value: 'tckn', label: t('customers:form.identityTypes.tckn') },
              ]}
              {...register('identity_type')}
            />

            <Input
              label={t('customers:form.fields.taxOffice')}
              placeholder={t('customers:form.placeholders.taxOffice')}
              error={errors.tax_office?.message}
              {...register('tax_office')}
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

          <div className="mt-8 pt-6 border-t border-neutral-200 dark:border-[#262626]">
            <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              {t('customers:form.firstSite.title')}
            </h3>
            <p className={`text-xs text-neutral-500 dark:text-neutral-400 ${isEdit && sites.length > 1 ? 'mb-2' : 'mb-6'}`}>
              {!isEdit
                ? t('customers:form.firstSite.description')
                : t('customers:form.firstSite.editDescription')}
            </p>
            {isEdit && sites.length > 1 && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-6">
                {t('customers:form.firstSite.moreLocations', { count: sites.length - 1 })}{' '}
                <Link
                  to={`/customers/${id}?tab=locations`}
                  className="text-primary-600 dark:text-primary-400 hover:underline font-medium"
                >
                  {t('customers:form.firstSite.moreLocationsLink')}
                </Link>
              </p>
            )}
            <div className="grid grid-cols-1 gap-y-6 lg:grid-cols-2 lg:gap-6">
                <Input
                  label={t('customers:sites.fields.siteName')}
                  placeholder={t('customers:sites.placeholders.siteName')}
                  error={errors.first_site_site_name?.message}
                  {...register('first_site_site_name')}
                />
                <Input
                  label={t('customers:sites.fields.accountNo')}
                  placeholder={t('customers:sites.placeholders.accountNo')}
                  error={errors.first_site_account_no?.message}
                  {...register('first_site_account_no')}
                />
                <div className="lg:col-span-2">
                  <Textarea
                    label={t('customers:sites.fields.address')}
                    placeholder={t('customers:sites.placeholders.address')}
                    error={errors.first_site_address?.message}
                    {...register('first_site_address')}
                  />
                </div>
                <Input
                  label={t('customers:sites.fields.city')}
                  error={errors.first_site_city?.message}
                  {...register('first_site_city')}
                />
                <Input
                  label={t('customers:sites.fields.district')}
                  error={errors.first_site_district?.message}
                  {...register('first_site_district')}
                />
                <Input
                  label={t('customers:sites.fields.contactName')}
                  placeholder={t('customers:sites.placeholders.contactName')}
                  error={errors.first_site_contact_name?.message}
                  {...register('first_site_contact_name')}
                />
                <Input
                  label={t('customers:sites.fields.contactPhone')}
                  placeholder={t('customers:sites.placeholders.contactPhone')}
                  error={errors.first_site_contact_phone?.message}
                  {...register('first_site_contact_phone', {
                    onChange: (e) => {
                      e.target.value = maskPhone(e.target.value);
                    },
                  })}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:col-span-2">
                  <Input
                    label={t('customers:sites.fields.alarmCenter')}
                    error={errors.first_site_alarm_center?.message}
                    {...register('first_site_alarm_center')}
                  />
                  <Input
                    label={t('customers:sites.fields.connectionDate')}
                    type="date"
                    error={errors.first_site_connection_date?.message}
                    {...register('first_site_connection_date')}
                  />
                </div>
                <div className="lg:col-span-2">
                  <Input
                    label={t('customers:sites.fields.panelInfo')}
                    error={errors.first_site_panel_info?.message}
                    {...register('first_site_panel_info')}
                  />
                </div>
                <div className="lg:col-span-2">
                  <Textarea
                    label={t('common:fields.notes')}
                    error={errors.first_site_notes?.message}
                    {...register('first_site_notes')}
                  />
                </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-neutral-200 dark:border-[#262626] flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={handleBack}>
              {tCommon('actions.cancel')}
            </Button>
            <Button
              variant="primary"
              type="submit"
              loading={
                isSubmitting ||
                createCustomer.isPending ||
                updateCustomer.isPending ||
                createSite.isPending ||
                updateSite.isPending
              }
            >
              {isEdit ? tCommon('actions.update') : tCommon('actions.create')}
            </Button>
          </div>
        </Card>
      </form>
    </PageContainer>
  );
}
