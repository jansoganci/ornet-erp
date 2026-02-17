import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Input,
  Button,
  Select,
  Textarea,
} from '../../../components/ui';
import { templateSchema, templateDefaultValues, PAYMENT_METHODS } from '../recurringSchema';
import { useCategories } from '../hooks';
import { useCreateRecurringTemplate, useUpdateRecurringTemplate } from '../recurringHooks';

export function RecurringTemplateFormModal({ open, onClose, template }) {
  const { t } = useTranslation(['recurring', 'common', 'finance']);
  const isEditMode = !!template;
  const createMutation = useCreateRecurringTemplate();
  const updateMutation = useUpdateRecurringTemplate();
  const { data: categories = [] } = useCategories({ is_active: true });

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(templateSchema),
    defaultValues: templateDefaultValues,
  });

  const hasInvoice = useWatch({ control, name: 'has_invoice', defaultValue: true });

  useEffect(() => {
    if (open) {
      if (isEditMode && template) {
        reset({
          name: template.name || '',
          expense_category_id: template.expense_category_id || '',
          is_variable: template.is_variable ?? false,
          amount: template.amount ?? 0,
          day_of_month: template.day_of_month ?? 1,
          is_active: template.is_active ?? true,
          payment_method: template.payment_method || 'bank_transfer',
          has_invoice: template.has_invoice ?? true,
          vat_rate: template.vat_rate ?? 20,
          description_template: template.description_template || '',
        });
      } else {
        reset(templateDefaultValues);
      }
    }
  }, [open, reset, isEditMode, template]);

  const onSubmit = async (data) => {
    if (isEditMode) {
      await updateMutation.mutateAsync({ id: template.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
    reset();
    onClose();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const categoryOptions = categories.map((c) => ({
    value: c.id,
    label: c.name_tr || c.name_en,
  }));

  const paymentMethodOptions = PAYMENT_METHODS.map((m) => ({
    value: m,
    label: t(`recurring:paymentMethods.${m}`),
  }));

  const footer = (
    <div className="flex flex-col-reverse sm:flex-row gap-3 w-full sm:w-auto">
      <Button variant="ghost" onClick={handleClose} className="flex-1 sm:flex-none">
        {t('common:actions.cancel')}
      </Button>
      <Button
        variant="primary"
        onClick={handleSubmit(onSubmit)}
        loading={isSubmitting}
        className="flex-1 sm:flex-none"
      >
        {t('common:actions.save')}
      </Button>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEditMode ? t('recurring:form.editTitle') : t('recurring:form.createTitle')}
      size="md"
      footer={footer}
    >
      <form className="space-y-5">
        <Input
          label={t('recurring:form.fields.name')}
          placeholder={t('recurring:form.placeholders.name')}
          error={errors.name?.message}
          {...register('name')}
          autoFocus
        />

        <Select
          label={t('recurring:form.fields.category')}
          options={categoryOptions}
          placeholder={t('finance:expense.placeholders.category')}
          error={errors.expense_category_id?.message}
          {...register('expense_category_id')}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Input
            label={t('recurring:form.fields.amount')}
            type="number"
            min={0}
            step="0.01"
            placeholder={t('recurring:form.placeholders.amount')}
            error={errors.amount?.message}
            {...register('amount')}
          />
          <Input
            label={t('recurring:form.fields.dayOfMonth')}
            type="number"
            min={1}
            max={31}
            placeholder={t('recurring:form.placeholders.dayOfMonth')}
            error={errors.day_of_month?.message}
            hint={t('recurring:form.hints.dayOfMonth')}
            {...register('day_of_month')}
          />
        </div>

        <Select
          label={t('recurring:form.fields.paymentMethod')}
          options={paymentMethodOptions}
          error={errors.payment_method?.message}
          {...register('payment_method')}
        />

        <div className="flex items-center space-x-3 p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-xl border border-neutral-100 dark:border-neutral-800">
          <input
            id="has_invoice"
            type="checkbox"
            className="h-5 w-5 rounded border-neutral-300 text-primary-600 focus:ring-primary-600 transition-all cursor-pointer"
            {...register('has_invoice')}
          />
          <label
            htmlFor="has_invoice"
            className="text-sm font-bold text-neutral-700 dark:text-neutral-200 cursor-pointer select-none"
          >
            {t('recurring:form.fields.hasInvoice')}
          </label>
        </div>

        {hasInvoice && (
          <Input
            label={t('recurring:form.fields.vatRate')}
            type="number"
            min={0}
            max={100}
            step="0.01"
            error={errors.vat_rate?.message}
            {...register('vat_rate')}
          />
        )}

        <div className="flex items-center space-x-3 p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-xl border border-neutral-100 dark:border-neutral-800">
          <input
            id="is_variable"
            type="checkbox"
            className="h-5 w-5 rounded border-neutral-300 text-primary-600 focus:ring-primary-600 transition-all cursor-pointer"
            {...register('is_variable')}
          />
          <div>
            <label
              htmlFor="is_variable"
              className="text-sm font-bold text-neutral-700 dark:text-neutral-200 cursor-pointer select-none"
            >
              {t('recurring:form.fields.isVariable')}
            </label>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {t('recurring:form.hints.isVariable')}
            </p>
          </div>
        </div>

        <Textarea
          label={t('recurring:form.fields.description')}
          placeholder={t('recurring:form.placeholders.description')}
          error={errors.description_template?.message}
          rows={2}
          {...register('description_template')}
        />

        {isEditMode && (
          <div className="flex items-center space-x-3 p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-xl border border-neutral-100 dark:border-neutral-800">
            <input
              id="is_active"
              type="checkbox"
              className="h-5 w-5 rounded border-neutral-300 text-primary-600 focus:ring-primary-600 transition-all cursor-pointer"
              {...register('is_active')}
            />
            <label
              htmlFor="is_active"
              className="text-sm font-bold text-neutral-700 dark:text-neutral-200 cursor-pointer select-none"
            >
              {t('recurring:form.fields.isActive')}
            </label>
          </div>
        )}
      </form>
    </Modal>
  );
}
