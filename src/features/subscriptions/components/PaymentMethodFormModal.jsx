import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal, Button, Input, Select } from '../../../components/ui';
import { paymentMethodSchema, paymentMethodDefaultValues } from '../schema';
import { useCreatePaymentMethod } from '../hooks';
import { cn } from '../../../lib/utils';

const METHOD_TYPES = ['card', 'bank_transfer', 'cash'];
const CARD_BRANDS = ['visa', 'mastercard', 'troy', 'amex'];

export function PaymentMethodFormModal({ open, onClose, customerId }) {
  const { t } = useTranslation(['subscriptions', 'common']);

  const createMutation = useCreatePaymentMethod();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(paymentMethodSchema),
    defaultValues: { ...paymentMethodDefaultValues, customer_id: customerId },
  });

  const methodType = watch('method_type');

  useEffect(() => {
    if (open && customerId) {
      reset({ ...paymentMethodDefaultValues, customer_id: customerId });
    }
  }, [open, customerId, reset]);

  const onSubmit = async (data) => {
    await createMutation.mutateAsync(data);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('subscriptions:detail.sections.paymentMethod')}
      size="sm"
      footer={
        <div className="flex gap-3 w-full">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            {t('common:actions.cancel')}
          </Button>
          <Button
            onClick={handleSubmit(onSubmit)}
            loading={isSubmitting || createMutation.isPending}
            className="flex-1"
          >
            {t('common:actions.save')}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <input type="hidden" {...register('customer_id')} />

        {/* Method type radio */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t('subscriptions:payment.fields.paymentMethod')}
          </label>
          <div className="flex flex-wrap gap-2">
            {METHOD_TYPES.map((type) => (
              <label
                key={type}
                className={cn(
                  'flex items-center px-4 py-2 rounded-xl border-2 cursor-pointer transition-all',
                  methodType === type
                    ? 'bg-primary-50 border-primary-600 dark:bg-primary-950/30 dark:border-primary-500'
                    : 'bg-white border-neutral-200 hover:border-neutral-300 dark:bg-[#171717] dark:border-[#262626]'
                )}
              >
                <input
                  type="radio"
                  className="sr-only"
                  value={type}
                  {...register('method_type')}
                />
                <span className={cn(
                  'text-sm font-bold',
                  methodType === type ? 'text-primary-700 dark:text-primary-400' : 'text-neutral-600 dark:text-neutral-400'
                )}>
                  {t(`subscriptions:payment.methods.${type}`)}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Card fields */}
        {methodType === 'card' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label={t('subscriptions:payment.fields.invoiceNo')}
                placeholder="1234"
                maxLength={4}
                error={errors.card_last4?.message}
                {...register('card_last4')}
              />
              <Select
                label="Marka"
                options={CARD_BRANDS.map(b => ({ value: b, label: b.toUpperCase() }))}
                error={errors.card_brand?.message}
                {...register('card_brand')}
              />
            </div>
            <Input
              label="Kart Sahibi"
              error={errors.card_holder?.message}
              {...register('card_holder')}
            />
            <Input
              label="Son Kullanma (AA/YY)"
              placeholder="12/26"
              maxLength={5}
              error={errors.card_expiry?.message}
              {...register('card_expiry')}
            />
          </div>
        )}

        {/* Bank fields */}
        {methodType === 'bank_transfer' && (
          <div className="space-y-4">
            <Input
              label="Banka Adı"
              error={errors.bank_name?.message}
              {...register('bank_name')}
            />
            <Input
              label="IBAN"
              placeholder="TR..."
              error={errors.iban?.message}
              {...register('iban')}
            />
          </div>
        )}

        {/* Cash - label */}
        {methodType === 'cash' && (
          <Input
            label="Etiket"
            placeholder="Örn: Elden Nakit"
            error={errors.label?.message}
            {...register('label')}
          />
        )}

        {/* Is default */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="rounded border-neutral-300 dark:border-neutral-600 text-primary-600 focus:ring-primary-500"
            {...register('is_default')}
          />
          <span className="text-sm text-neutral-700 dark:text-neutral-300">
            Varsayılan ödeme yöntemi
          </span>
        </label>
      </div>
    </Modal>
  );
}
