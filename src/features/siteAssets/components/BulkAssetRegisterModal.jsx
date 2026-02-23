import { useEffect, useState } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, HardDrive } from 'lucide-react';
import { Modal, Input, Select, Button, IconButton } from '../../../components/ui';
import { ASSET_TYPES, OWNERSHIP_TYPES } from '../schema';
import { useBulkCreateAssets } from '../hooks';
import { useSubscriptionsBySite } from '../../subscriptions/hooks';
import { CustomerSiteSelector } from '../../workOrders/CustomerSiteSelector';
import { z } from 'zod';
import i18n from '../../../lib/i18n';

const bulkItemSchema = z.object({
  asset_type: z.enum(ASSET_TYPES, { required_error: i18n.t('errors:validation.required') }),
  brand: z.string().optional().or(z.literal('')),
  model: z.string().optional().or(z.literal('')),
  serial_number: z.string().optional().or(z.literal('')),
  quantity: z.coerce.number().min(1).max(100).default(1),
});

const bulkRegisterSchema = z.object({
  site_id: z.string().min(1, i18n.t('errors:validation.required')).uuid(),
  customer_id: z.string().min(1, i18n.t('errors:validation.required')).uuid(),
  ownership_type: z.enum(OWNERSHIP_TYPES).optional().or(z.literal('')).or(z.null()),
  subscription_id: z.string().uuid().optional().or(z.literal('')).or(z.null()),
  installed_at: z.string().optional().or(z.literal('')),
  items: z.array(bulkItemSchema).min(1),
});

const defaultItem = {
  asset_type: '',
  brand: '',
  model: '',
  serial_number: '',
  quantity: 1,
};

export function BulkAssetRegisterModal({
  open,
  onClose,
  siteId,
  customerId,
}) {
  const { t } = useTranslation(['siteAssets', 'common', 'subscriptions', 'errors']);
  
  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(bulkRegisterSchema),
    defaultValues: {
      site_id: siteId || '',
      customer_id: customerId || '',
      ownership_type: 'customer_owned',
      subscription_id: '',
      installed_at: new Date().toISOString().split('T')[0],
      items: [defaultItem],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const selectedOwnership = useWatch({ control, name: 'ownership_type' });
  const selectedSiteId = useWatch({ control, name: 'site_id' });
  const [selectedCustomerId, setSelectedCustomerId] = useState(customerId || '');

  const { data: subscriptions = [], isLoading: isLoadingSubs } = useSubscriptionsBySite(selectedSiteId);
  const bulkCreateMutation = useBulkCreateAssets();

  useEffect(() => {
    if (open) {
      reset({
        site_id: siteId || '',
        customer_id: customerId || '',
        ownership_type: 'customer_owned',
        subscription_id: '',
        installed_at: new Date().toISOString().split('T')[0],
        items: [defaultItem],
      });
      setSelectedCustomerId(customerId || '');
    }
  }, [open, siteId, customerId, reset]);

  const onSubmit = async (data) => {
    try {
      const { items, ...globalData } = data;
      const flattenedAssets = [];

      items.forEach((item) => {
        const baseAsset = {
          ...globalData,
          asset_type: item.asset_type,
          brand: item.brand || null,
          model: item.model || null,
          ownership_type: globalData.ownership_type || null,
          subscription_id: globalData.ownership_type === 'company_owned' ? globalData.subscription_id : null,
        };

        if (item.quantity > 1) {
          // For bulk, serial number must be unique, so we clear it for all
          for (let i = 0; i < item.quantity; i++) {
            flattenedAssets.push({
              ...baseAsset,
              serial_number: null,
            });
          }
        } else {
          flattenedAssets.push({
            ...baseAsset,
            serial_number: item.serial_number || null,
          });
        }
      });

      await bulkCreateMutation.mutateAsync(flattenedAssets);
      reset();
      onClose();
    } catch (error) {
      console.error('Bulk registration failed:', error);
    }
  };

  const assetTypeOptions = ASSET_TYPES.map((type) => ({
    value: type,
    label: t(`siteAssets:types.${type}`),
  }));

  const ownershipOptions = [
    { value: '', label: t('siteAssets:filters.none') },
    ...OWNERSHIP_TYPES.map((type) => ({
      value: type,
      label: t(`siteAssets:ownerships.${type}`),
    })),
  ];

  const subscriptionOptions = [
    { value: '', label: subscriptions.length > 0 ? t('siteAssets:filters.selectSubscription') : t('subscriptions:multiService.noOtherServices') },
    ...subscriptions
      .filter((s) => s.status === 'active')
      .map((s) => ({
        value: s.id,
        label: `${t(`subscriptions:serviceTypes.${s.service_type}`)} (${s.base_price} ${s.currency})`,
      })),
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('siteAssets:bulkRegister.title')}
      className="max-w-5xl"
      footer={
        <div className="flex space-x-3 w-full sm:w-auto">
          <Button variant="ghost" onClick={onClose} className="flex-1 sm:flex-none">
            {t('common:actions.cancel')}
          </Button>
          <Button
            onClick={handleSubmit(onSubmit)}
            loading={isSubmitting}
            className="flex-1 sm:flex-none"
            leftIcon={<HardDrive className="w-4 h-4" />}
          >
            {t('siteAssets:bulkRegister.submitButton', { count: fields.length })}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* 1. Customer & Site Selection */}
        <div className="bg-neutral-50 dark:bg-neutral-900/50 p-6 rounded-xl border border-neutral-200 dark:border-neutral-800">
          <CustomerSiteSelector
            selectedCustomerId={selectedCustomerId}
            selectedSiteId={selectedSiteId}
            onCustomerChange={(cid) => setSelectedCustomerId(cid)}
            onSiteChange={(sid) => setValue('site_id', sid, { shouldValidate: true })}
            onAddNewCustomer={() => {}}
            onAddNewSite={() => {}}
            error={errors.site_id?.message}
          />
        </div>

        {/* Global Fields */}
        <div className="bg-neutral-50 dark:bg-neutral-900/50 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800">
          <h3 className="text-sm font-semibold mb-4 text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
            {t('siteAssets:bulkRegister.globalFields')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              label={t('siteAssets:fields.ownership')}
              options={ownershipOptions}
              error={errors.ownership_type?.message}
              {...register('ownership_type')}
            />
            {selectedOwnership === 'company_owned' && (
              <Select
                label={t('siteAssets:fields.subscription')}
                options={subscriptionOptions}
                disabled={!selectedSiteId || isLoadingSubs}
                error={errors.subscription_id?.message}
                {...register('subscription_id')}
              />
            )}
            <Input
              label={t('siteAssets:fields.installedAt')}
              type="date"
              error={errors.installed_at?.message}
              {...register('installed_at')}
            />
          </div>
        </div>

        {/* Item List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
              {t('siteAssets:bulkRegister.items')}
            </h3>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => append(defaultItem)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              {t('siteAssets:bulkRegister.addItem')}
            </Button>
          </div>

          <div className="space-y-3">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 items-end relative group animate-in fade-in slide-in-from-top-1 duration-200"
              >
                <div className="md:col-span-3">
                  <Select
                    label={index === 0 ? t('siteAssets:fields.assetType') : undefined}
                    options={assetTypeOptions}
                    error={errors.items?.[index]?.asset_type?.message}
                    {...register(`items.${index}.asset_type`)}
                  />
                </div>
                <div className="md:col-span-2">
                  <Input
                    label={index === 0 ? t('siteAssets:fields.brand') : undefined}
                    placeholder={t('siteAssets:placeholders.brand')}
                    {...register(`items.${index}.brand`)}
                  />
                </div>
                <div className="md:col-span-2">
                  <Input
                    label={index === 0 ? t('siteAssets:fields.model') : undefined}
                    placeholder={t('siteAssets:placeholders.model')}
                    {...register(`items.${index}.model`)}
                  />
                </div>
                <div className="md:col-span-3">
                  <Input
                    label={index === 0 ? t('siteAssets:fields.serialNumber') : undefined}
                    placeholder={t('siteAssets:placeholders.serialNumber')}
                    {...register(`items.${index}.serial_number`)}
                  />
                </div>
                <div className="md:col-span-1">
                  <Input
                    label={index === 0 ? t('siteAssets:fields.quantity') : undefined}
                    type="number"
                    min={1}
                    {...register(`items.${index}.quantity`)}
                  />
                </div>
                <div className="md:col-span-1 flex justify-end">
                  <IconButton
                    type="button"
                    icon={Trash2}
                    variant="ghost"
                    size="sm"
                    className="text-error-500 hover:bg-error-50 dark:hover:bg-error-950/30"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}
