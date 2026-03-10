import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Modal, Input, Button } from '../../../components/ui';
import { categorySchema, categoryDefaultValues } from '../schema';
import { useCreateCategory, useUpdateCategory } from '../hooks';

export function CategoryFormModal({ open, onClose, category = null, onSuccess }) {
  const { t } = useTranslation(['finance', 'common']);
  const isEditing = !!category;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(categorySchema),
    defaultValues: category ? { ...categoryDefaultValues, ...category } : categoryDefaultValues,
  });

  useEffect(() => {
    if (open) {
      reset(category ? { ...categoryDefaultValues, ...category } : categoryDefaultValues);
    }
  }, [open, category, reset]);

  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();

  const onSubmit = async (data) => {
    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ id: category.id, data });
      } else {
        await createMutation.mutateAsync(data);
        onSuccess?.();
      }
      reset();
      onClose();
    } catch {
      // Error handled by mutation onError
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
      title={isEditing ? t('finance:categories.editTitle') : t('finance:categories.createTitle')}
      size="md"
      footer={
        <div className="flex gap-3 w-full">
          <Button variant="ghost" onClick={handleClose} className="flex-1">
            {t('common:actions.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit(onSubmit)}
            loading={isSubmitting || createMutation.isPending || updateMutation.isPending}
            className="flex-1"
          >
            {isEditing ? t('common:actions.save') : t('common:actions.create')}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label={t('finance:categoryForm.code')}
          error={errors.code?.message}
          {...register('code')}
          disabled={category?.is_system}
        />
        <Input
          label={t('finance:categoryForm.nameTr')}
          error={errors.name_tr?.message}
          {...register('name_tr')}
        />
        <Input
          label={t('finance:categoryForm.nameEn')}
          error={errors.name_en?.message}
          {...register('name_en')}
        />
        <Input
          label={t('finance:categoryForm.sortOrder')}
          type="number"
          min="0"
          error={errors.sort_order?.message}
          {...register('sort_order')}
        />
      </form>
    </Modal>
  );
}
