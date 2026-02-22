import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { 
  Modal, 
  Input, 
  Button, 
  Select,
  Textarea,
} from '../../components/ui';
import { materialSchema, materialDefaultValues } from './schema';
import { useCreateMaterial, useUpdateMaterial } from './hooks';
import { toast } from 'sonner';

export function MaterialFormModal({ 
  open, 
  onClose, 
  material = null,
  onSuccess = null
}) {
  const { t } = useTranslation(['materials', 'common']);
  const isEditing = !!material;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(materialSchema),
    defaultValues: material || materialDefaultValues,
  });

  const createMutation = useCreateMaterial();
  const updateMutation = useUpdateMaterial();

  const onSubmit = async (data) => {
    try {
      let result;
      if (isEditing) {
        result = await updateMutation.mutateAsync({ id: material.id, data });
        toast.success(t('common:success.updated'));
      } else {
        result = await createMutation.mutateAsync(data);
        toast.success(t('common:success.created'));
      }
      reset();
      onClose();
      if (onSuccess && result) {
        onSuccess(result);
      }
    } catch {
      // error handled by mutation onError
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const categoryOptions = [
    { value: 'dedektor', label: t('materials:categories.dedektor') },
    { value: 'siren', label: t('materials:categories.siren') },
    { value: 'panel', label: t('materials:categories.panel') },
    { value: 'buton', label: t('materials:categories.buton') },
    { value: 'kablo', label: t('materials:categories.kablo') },
    { value: 'aksesuar', label: t('materials:categories.aksesuar') },
    { value: 'kamera', label: t('materials:categories.kamera') },
    { value: 'diger', label: t('materials:categories.diger') },
  ];

  const unitOptions = [
    { value: 'adet', label: t('materials:units.adet') },
    { value: 'metre', label: t('materials:units.metre') },
    { value: 'paket', label: t('materials:units.paket') },
  ];

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEditing ? t('materials:form.editTitle') : t('materials:form.createTitle')}
      size="md"
      footer={
        <div className="flex gap-3 w-full sm:w-auto">
          <Button variant="ghost" onClick={handleClose} className="flex-1 sm:flex-none">
            {t('common:actions.cancel')}
          </Button>
          <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting} className="flex-1 sm:flex-none">
            {t('common:actions.save')}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Input
          label={t('materials:form.fields.code')}
          placeholder={t('materials:form.placeholders.code')}
          error={errors.code?.message}
          {...register('code')}
          autoFocus
        />

        <Input
          label={t('materials:form.fields.name')}
          placeholder={t('materials:form.placeholders.name')}
          error={errors.name?.message}
          {...register('name')}
        />

        <Textarea
          label={t('materials:form.fields.description')}
          placeholder={t('materials:form.placeholders.description')}
          error={errors.description?.message}
          rows={3}
          {...register('description')}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Select
            label={t('materials:form.fields.category')}
            options={categoryOptions}
            placeholder={t('materials:form.placeholders.category')}
            error={errors.category?.message}
            {...register('category')}
          />
          <Select
            label={t('materials:form.fields.unit')}
            options={unitOptions}
            error={errors.unit?.message}
            {...register('unit')}
          />
        </div>

        <div className="flex items-center space-x-3 p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-xl border border-neutral-100 dark:border-neutral-800">
          <input
            id="is_active"
            type="checkbox"
            className="h-5 w-5 rounded border-neutral-300 text-primary-600 focus:ring-primary-600 transition-all cursor-pointer"
            {...register('is_active')}
          />
          <label htmlFor="is_active" className="text-sm font-bold text-neutral-700 dark:text-neutral-200 cursor-pointer select-none">
            {t('materials:form.fields.isActive')}
          </label>
        </div>
      </form>
    </Modal>
  );
}
