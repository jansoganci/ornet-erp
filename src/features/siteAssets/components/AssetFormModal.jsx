import { useEffect, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Modal, Input, Select, Button, Textarea } from '../../../components/ui';
import { assetSchema, assetDefaultValues, ASSET_TYPES, OWNERSHIP_TYPES } from '../schema';
import { useCreateAsset, useUpdateAsset, useBulkCreateAssets } from '../hooks';
import { useSubscriptionsBySite } from '../../subscriptions/hooks';

export function AssetFormModal({
  open,
  onClose,
  siteId,
  customerId,
  asset = null,
}) {
  const { t } = useTranslation(['siteAssets', 'common', 'subscriptions']);
  const isEditing = !!asset;

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(assetSchema),
    defaultValues: asset
      ? { ...assetDefaultValues, ...asset }
      : { ...assetDefaultValues, site_id: siteId || '', customer_id: customerId || '' },
  });

  const selectedOwnership = useWatch({ control, name: 'ownership_type' });
  const selectedSiteId = useWatch({ control, name: 'site_id' });

  const { data: subscriptions = [], isLoading: isLoadingSubs } = useSubscriptionsBySite(selectedSiteId);

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
  const bulkCreateMutation = useBulkCreateAssets();

  const onSubmit = async (data) => {
    try {
      // If not company owned, clear subscription_id
      const { quantity, ...assetData } = data;
      const payload = { ...assetData };
      if (payload.ownership_type !== 'company_owned') {
        payload.subscription_id = null;
      }

      if (isEditing) {
        await updateMutation.mutateAsync({ id: asset.id, data: payload });
      } else if (quantity > 1) {
        // For bulk, serial number must be unique, so we clear it for all
        const bulkPayload = Array.from({ length: quantity }, () => ({
          ...payload,
          serial_number: null,
        }));
        await bulkCreateMutation.mutateAsync(bulkPayload);
      } else {
        await createMutation.mutateAsync(payload);
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
      onClose={handleClose}
      title={isEditing ? t('siteAssets:actions.edit') : t('siteAssets:addButton')}
      className="max-w-2xl"
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
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Select
            label={t('siteAssets:fields.assetType')}
            placeholder={t('siteAssets:fields.assetType')}
            options={assetTypeOptions}
            error={errors.asset_type?.message}
            {...register('asset_type')}
          />

          <Select
            label={t('siteAssets:fields.ownership')}
            options={ownershipOptions}
            error={errors.ownership_type?.message}
            {...register('ownership_type')}
          />
        </div>

        {selectedOwnership === 'company_owned' && (
          <div className="animate-in fade-in slide-in-from-top-1 duration-200">
            <Select
              label={t('siteAssets:fields.subscription')}
              options={subscriptionOptions}
              disabled={!selectedSiteId || isLoadingSubs}
              error={errors.subscription_id?.message}
              hint={!selectedSiteId ? t('siteAssets:hints.selectSiteFirst') : undefined}
              {...register('subscription_id')}
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Input
            label={t('siteAssets:fields.serialNumber')}
            placeholder={t('siteAssets:placeholders.serialNumber')}
            error={errors.serial_number?.message}
            {...register('serial_number')}
          />
          {!isEditing ? (
            <Input
              label={t('siteAssets:fields.quantity')}
              type="number"
              min={1}
              max={100}
              error={errors.quantity?.message}
              {...register('quantity')}
            />
          ) : (
            <Input
              label={t('siteAssets:fields.installedAt')}
              type="date"
              error={errors.installed_at?.message}
              {...register('installed_at')}
            />
          )}
        </div>

        {!isEditing ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Input
              label={t('siteAssets:fields.warrantyExpires')}
              type="date"
              error={errors.warranty_expires_at?.message}
              {...register('warranty_expires_at')}
            />
            <div className="hidden md:block" />
          </div>
        )}

        <Input
          label={t('siteAssets:fields.locationNote')}
          placeholder={t('siteAssets:placeholders.locationNote')}
          error={errors.location_note?.message}
          {...register('location_note')}
        />

        <Textarea
          label={t('siteAssets:fields.notes')}
          error={errors.notes?.message}
          rows={3}
          {...register('notes')}
        />
      </form>
    </Modal>
  );
}
