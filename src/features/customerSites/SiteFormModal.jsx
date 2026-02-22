import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { 
  Modal, 
  Input, 
  Button, 
  Textarea 
} from '../../components/ui';
import { siteSchema, siteDefaultValues } from './schema';
import { useCreateSite, useUpdateSite } from './hooks';
import { toast } from 'sonner';

export function SiteFormModal({
  open,
  onClose,
  customerId,
  site = null,
  onSuccess,
}) {
  const { t } = useTranslation(['customers', 'common']);
  const isEditing = !!site;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(siteSchema),
    defaultValues: site ? { ...siteDefaultValues, ...site, customer_id: site.customer_id } : { ...siteDefaultValues, customer_id: customerId || '' },
  });

  // When modal opens for "add site", sync form with current customerId so validation passes
  useEffect(() => {
    if (open && !isEditing) {
      setValue('customer_id', customerId || '');
    }
  }, [open, isEditing, customerId, setValue]);

  const createMutation = useCreateSite();
  const updateMutation = useUpdateSite();

  const onSubmit = async (data) => {
    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ id: site.id, data });
        toast.success(t('common:success.updated'));
      } else {
        const newSite = await createMutation.mutateAsync(data);
        toast.success(t('common:success.created'));
        onSuccess?.(newSite);
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

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEditing ? t('customers:sites.editButton') : t('customers:sites.addButton')}
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            label={t('customers:sites.fields.siteName')}
            placeholder={t('customers:sites.placeholders.siteName')}
            error={errors.site_name?.message}
            {...register('site_name')}
          />
          <Input
            label={t('customers:sites.fields.accountNo')}
            placeholder={t('customers:sites.placeholders.accountNo')}
            error={errors.account_no?.message}
            {...register('account_no')}
          />
        </div>

        <Textarea
          label={t('customers:sites.fields.address')}
          placeholder={t('customers:sites.placeholders.address')}
          error={errors.address?.message}
          {...register('address')}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            label={t('customers:sites.fields.city')}
            error={errors.city?.message}
            {...register('city')}
          />
          <Input
            label={t('customers:sites.fields.district')}
            error={errors.district?.message}
            {...register('district')}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-neutral-100 dark:border-[#262626]">
          <Input
            label={t('customers:sites.fields.contactName')}
            placeholder={t('customers:sites.placeholders.contactName')}
            error={errors.contact_name?.message}
            {...register('contact_name')}
          />
          <Input
            label={t('customers:sites.fields.contactPhone')}
            placeholder={t('customers:sites.placeholders.contactPhone')}
            error={errors.contact_phone?.message}
            {...register('contact_phone')}
          />
        </div>

        <Input
          label={t('customers:sites.fields.panelInfo')}
          error={errors.panel_info?.message}
          {...register('panel_info')}
        />

        <Textarea
          label={t('common:fields.notes')}
          error={errors.notes?.message}
          {...register('notes')}
        />
      </form>
    </Modal>
  );
}
