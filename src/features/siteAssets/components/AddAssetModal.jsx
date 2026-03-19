import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { Modal, Input, Select, Button } from '../../../components/ui';
import { CustomerCombobox } from '../../../components/ui';
import { useCustomer } from '../../customers/hooks';
import { useSitesByCustomer } from '../../customerSites/hooks';
import { useSubscriptionsBySite } from '../../subscriptions/hooks';
import { assetSchema, assetDefaultValues, batchAssetSchema, batchAssetDefaultValues } from '../schema';
import { useCreateAsset, useUpdateAsset, useBulkCreateAssets } from '../hooks';
import { AssetItemsEditor } from './AssetItemsEditor';

export function AddAssetModal({ open, onClose, siteId, customerId, asset = null }) {
  const { t } = useTranslation(['siteAssets', 'common']);
  const isEditing = !!asset;
  const [selectedCustomerId, setSelectedCustomerId] = useState(customerId || asset?.customer_id || '');
  const [selectedSiteId, setSelectedSiteId] = useState(siteId || asset?.site_id || '');

  const { data: selectedCustomer } = useCustomer(selectedCustomerId);
  const { data: sites = [] } = useSitesByCustomer(selectedCustomerId);
  const { data: siteSubscriptions = [] } = useSubscriptionsBySite(selectedSiteId);
  const isSiteCancelled = siteSubscriptions.some((s) => s.status === 'cancelled');

  const singleForm = useForm({
    resolver: zodResolver(assetSchema),
    defaultValues: { ...assetDefaultValues, site_id: siteId || '' },
  });

  const batchForm = useForm({
    resolver: zodResolver(batchAssetSchema),
    defaultValues: { ...batchAssetDefaultValues, site_id: siteId || '' },
  });

  const form = isEditing ? singleForm : batchForm;
  const { register, handleSubmit, reset, setValue, control, formState: { errors, isSubmitting } } = form;

  useEffect(() => {
    if (open) {
      if (asset) {
        reset({ ...assetDefaultValues, ...asset });
        setSelectedCustomerId(asset.customer_id || '');
        setSelectedSiteId(asset.site_id || '');
      } else {
        reset({ ...batchAssetDefaultValues, site_id: siteId || selectedSiteId || '' });
        setSelectedCustomerId(customerId || '');
        setSelectedSiteId(siteId || '');
      }
    }
  }, [open, siteId, customerId, asset, reset]);

  useEffect(() => {
    if (selectedSiteId) setValue('site_id', selectedSiteId);
  }, [selectedSiteId, setValue]);

  const createMutation = useCreateAsset();
  const updateMutation = useUpdateAsset();
  const bulkCreateMutation = useBulkCreateAssets();

  const onSubmit = async (data) => {
    try {
      if (isEditing) {
        await updateMutation.mutateAsync({
          id: asset.id,
          data: {
            equipment_name: data.equipment_name,
            quantity: data.quantity,
            installation_date: data.installation_date,
          },
        });
      } else {
        const validItems = (data.items || [])
          .filter((item) => item.equipment_name?.trim())
          .map((item) => ({
            site_id: data.site_id,
            equipment_name: item.equipment_name.trim(),
            quantity: item.quantity ?? 1,
            installation_date: data.installation_date || null,
          }));
        if (validItems.length === 0) return;
        await bulkCreateMutation.mutateAsync(validItems);
      }
      reset();
      onClose();
    } catch {
      // error handled by mutation onError
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const siteOptions = [
    { value: '', label: t('siteAssets:filters.allSites') },
    ...sites.map((s) => ({
      value: s.id,
      label: `${s.site_name || '-'}${s.account_no ? ` (${s.account_no})` : ''}`,
    })),
  ];

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEditing ? t('common:actions.edit') : t('siteAssets:addButton')}
      size={isEditing ? 'sm' : 'lg'}
      footer={
        <div className="flex gap-3 w-full">
          <Button variant="ghost" onClick={handleClose} className="flex-1">
            {t('common:actions.cancel')}
          </Button>
          <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting} className="flex-1">
            {t('common:actions.save')}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {!isEditing && (
          <>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                {t('siteAssets:fields.customer')}
              </label>
              <CustomerCombobox
                value={selectedCustomerId}
                selectedCustomer={selectedCustomer}
                onChange={(id) => {
                  setSelectedCustomerId(id || '');
                  setSelectedSiteId('');
                  setValue('site_id', '');
                }}
                placeholder={t('siteAssets:placeholders.searchCustomer')}
              />
            </div>

            <Select
              label={t('siteAssets:fields.site')}
              options={siteOptions}
              value={selectedSiteId}
              onChange={(e) => {
                const v = e.target.value;
                setSelectedSiteId(v);
                setValue('site_id', v);
              }}
              disabled={!selectedCustomerId}
              error={errors.site_id?.message}
            />

            {isSiteCancelled && selectedSiteId && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800">
                <AlertTriangle className="w-5 h-5 text-error-600 dark:text-error-400 shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-error-700 dark:text-error-300">
                  {t('siteAssets:alertCancelled')}
                </p>
              </div>
            )}

            <Input
              label={t('siteAssets:fields.installationDate')}
              type="date"
              error={errors.installation_date?.message}
              {...register('installation_date')}
            />

            <AssetItemsEditor control={control} register={register} errors={errors} setValue={setValue} />
          </>
        )}

        {isEditing && (
          <>
            <Input label={t('siteAssets:fields.site')} value={asset?.site_name || asset?.account_no || '-'} disabled />

            {isSiteCancelled && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800">
                <AlertTriangle className="w-5 h-5 text-error-600 dark:text-error-400 shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-error-700 dark:text-error-300">
                  {t('siteAssets:alertCancelled')}
                </p>
              </div>
            )}

            <Input
              label={t('siteAssets:fields.materialName')}
              placeholder={t('siteAssets:placeholders.materialName')}
              error={errors.equipment_name?.message}
              {...register('equipment_name')}
            />

            <Input
              label={t('siteAssets:fields.quantity')}
              type="number"
              min={1}
              max={999}
              error={errors.quantity?.message}
              {...register('quantity')}
            />

            <Input
              label={t('siteAssets:fields.installationDate')}
              type="date"
              error={errors.installation_date?.message}
              {...register('installation_date')}
            />
          </>
        )}
      </form>
    </Modal>
  );
}
