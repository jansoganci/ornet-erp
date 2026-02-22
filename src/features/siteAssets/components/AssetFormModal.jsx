import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Modal, Input, Select, Button, Textarea } from '../../../components/ui';
import { assetSchema, assetDefaultValues, ASSET_TYPES } from '../schema';
import { useCreateAsset, useUpdateAsset } from '../hooks';

export function AssetFormModal({
  open,
  onClose,
  siteId,
  customerId,
  asset = null,
}) {
  const { t } = useTranslation(['siteAssets', 'common']);
  const isEditing = !!asset;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(assetSchema),
    defaultValues: asset
      ? { ...assetDefaultValues, ...asset }
      : { ...assetDefaultValues, site_id: siteId || '', customer_id: customerId || '' },
  });

  useEffect(() => {
    if (open && !isEditing) {
      reset({ ...assetDefaultValues, site_id: siteId || '', customer_id: customerId || '' });
    }
    if (open && isEditing && asset) {
      reset({ ...assetDefaultValues, ...asset });
    }
  }, [open, isEditing, siteId, customerId, asset, reset]);

  const createMutation = useCreateAsset();
  const updateMutation = useUpdateAsset();

  const onSubmit = async (data) => {
    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ id: asset.id, data });
      } else {
        await createMutation.mutateAsync(data);
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

  const assetTypeOptions = ASSET_TYPES.map((type) => ({
    value: type,
    label: t(`siteAssets:types.${type}`),
  }));

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEditing ? t('siteAssets:actions.edit') : t('siteAssets:addButton')}
      size="lg"
      footer={
        <div className="flex space-x-3 w-full sm:w-auto">
          <Button
            variant="ghost"
            onClick={handleClose}
            className="flex-1 sm:flex-none"
          >
            {t('common:actions.cancel')}
          </Button>
          <Button
            onClick={handleSubmit(onSubmit)}
            loading={isSubmitting}
            className="flex-1 sm:flex-none"
          >
            {t('common:actions.save')}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Select
          label={t('siteAssets:fields.assetType')}
          placeholder={t('siteAssets:fields.assetType')}
          options={assetTypeOptions}
          error={errors.asset_type?.message}
          {...register('asset_type')}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            label={t('siteAssets:fields.brand')}
            placeholder={t('siteAssets:placeholders.brand')}
            error={errors.brand?.message}
            {...register('brand')}
          />
          <Input
            label={t('siteAssets:fields.model')}
            placeholder={t('siteAssets:placeholders.model')}
            error={errors.model?.message}
            {...register('model')}
          />
        </div>

        <Input
          label={t('siteAssets:fields.serialNumber')}
          placeholder={t('siteAssets:placeholders.serialNumber')}
          error={errors.serial_number?.message}
          {...register('serial_number')}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            label={t('siteAssets:fields.installedAt')}
            type="date"
            error={errors.installed_at?.message}
            {...register('installed_at')}
          />
          <Input
            label={t('siteAssets:fields.warrantyExpires')}
            type="date"
            error={errors.warranty_expires_at?.message}
            {...register('warranty_expires_at')}
          />
        </div>

        <Input
          label={t('siteAssets:fields.locationNote')}
          placeholder={t('siteAssets:placeholders.locationNote')}
          error={errors.location_note?.message}
          {...register('location_note')}
        />

        <Textarea
          label={t('siteAssets:fields.notes')}
          error={errors.notes?.message}
          {...register('notes')}
        />
      </form>
    </Modal>
  );
}
