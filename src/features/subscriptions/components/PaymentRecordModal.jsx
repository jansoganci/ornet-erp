import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal, Button, Input, Select, Textarea } from '../../../components/ui';
import { paymentRecordSchema, paymentRecordDefaultValues, PAYMENT_METHODS, INVOICE_TYPES } from '../schema';
import { useRecordPayment } from '../hooks';
import { formatCurrency } from '../../../lib/utils';

const MONTH_NAMES_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

function getMonthLabel(paymentMonth) {
  if (!paymentMonth) return '';
  const d = new Date(paymentMonth);
  return `${MONTH_NAMES_TR[d.getMonth()]} ${d.getFullYear()}`;
}

export function PaymentRecordModal({ open, onClose, payment }) {
  const { t } = useTranslation(['subscriptions', 'common']);
  const recordMutation = useRecordPayment();

  const isLocked = payment?.status === 'paid' && !!payment?.invoice_no;

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(paymentRecordSchema),
    defaultValues: paymentRecordDefaultValues,
  });

  const watchedMethod = useWatch({ control, name: 'payment_method' });
  const watchedShouldInvoice = useWatch({ control, name: 'should_invoice' });
  const watchedVatRate = useWatch({ control, name: 'vat_rate' });

  const isCard = watchedMethod === 'card';
  const isBankTransfer = watchedMethod === 'bank_transfer';

  // Card payments always have should_invoice = true
  useEffect(() => {
    if (isCard) {
      setValue('should_invoice', true);
    }
  }, [isCard, setValue]);

  // Compute live amounts based on should_invoice and vat_rate
  const amounts = useMemo(() => {
    if (!payment) return { amount: 0, vatAmount: 0, totalAmount: 0 };

    const baseAmount = payment.amount || 0;

    if (!watchedShouldInvoice) {
      return { amount: baseAmount, vatAmount: 0, totalAmount: baseAmount };
    }

    const rate = watchedVatRate != null ? Number(watchedVatRate) : 20;
    const vat = Math.round(baseAmount * rate) / 100;
    return { amount: baseAmount, vatAmount: vat, totalAmount: baseAmount + vat };
  }, [payment, watchedShouldInvoice, watchedVatRate]);

  useEffect(() => {
    if (open) {
      reset({
        ...paymentRecordDefaultValues,
        payment_date: new Date().toISOString().slice(0, 10),
      });
    }
  }, [open, reset]);

  const onSubmit = async (data) => {
    await recordMutation.mutateAsync({ paymentId: payment.id, data });
    onClose();
  };

  const paymentMethodOptions = PAYMENT_METHODS.map((m) => ({
    value: m,
    label: t(`subscriptions:payment.methods.${m}`),
  }));

  const invoiceTypeOptions = [
    { value: '', label: '-' },
    ...INVOICE_TYPES.map((type) => ({
      value: type,
      label: t(`subscriptions:payment.invoiceTypes.${type}`),
    })),
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${t('subscriptions:payment.recordTitle')} — ${getMonthLabel(payment?.payment_month)}`}
      size="sm"
      footer={
        !isLocked && (
          <div className="flex gap-3 w-full">
            <Button variant="ghost" onClick={onClose} className="flex-1">
              {t('common:actions.cancel')}
            </Button>
            <Button
              onClick={handleSubmit(onSubmit)}
              loading={isSubmitting || recordMutation.isPending}
              className="flex-1"
            >
              {t('subscriptions:actions.recordPayment')}
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-5">
        {/* Live amount display */}
        <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900/50">
          <div className="text-center">
            <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Tutar</p>
            <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100">{formatCurrency(amounts.amount)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">KDV</p>
            <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100">{formatCurrency(amounts.vatAmount)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Toplam</p>
            <p className="text-sm font-bold text-primary-700 dark:text-primary-300">{formatCurrency(amounts.totalAmount)}</p>
          </div>
        </div>

        {isLocked ? (
          <div className="p-4 rounded-lg bg-success-50 dark:bg-success-950/20 border border-success-200 dark:border-success-800/40 text-center">
            <p className="text-sm text-success-700 dark:text-success-400 font-medium">
              Bu ödeme faturalanmış ve kilitlenmiştir.
            </p>
            {payment.invoice_no && (
              <p className="text-xs text-success-600 dark:text-success-500 mt-1">
                Fatura: {payment.invoice_no}
              </p>
            )}
          </div>
        ) : (
          <>
            <Input
              label={t('subscriptions:payment.fields.paymentDate')}
              type="date"
              error={errors.payment_date?.message}
              {...register('payment_date')}
            />

            <Select
              label={t('subscriptions:payment.fields.paymentMethod')}
              options={paymentMethodOptions}
              error={errors.payment_method?.message}
              {...register('payment_method')}
            />

            {isBankTransfer && (
              <Input
                label={t('subscriptions:payment.fields.referenceNo')}
                error={errors.reference_no?.message}
                {...register('reference_no')}
              />
            )}

            {/* Invoice logic section */}
            {isCard ? (
              /* Card: always invoiced — show info text */
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40">
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  {t('subscriptions:payment.invoice.cardAutoInvoice')}
                </p>
              </div>
            ) : (
              /* Cash/Bank: show should_invoice checkbox */
              <label className="flex items-center gap-3 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900/50 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600 text-primary-600 focus:ring-primary-500"
                  {...register('should_invoice')}
                />
                <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {t('subscriptions:payment.invoice.shouldInvoice')}
                </span>
              </label>
            )}

            {/* No invoice warning */}
            {!isCard && !watchedShouldInvoice && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40">
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  {t('subscriptions:payment.invoice.noInvoiceWarning')}
                </p>
              </div>
            )}

            {/* Invoice fields — shown when should_invoice is true */}
            {watchedShouldInvoice && (
              <>
                <Input
                  label={t('subscriptions:payment.invoice.vatRate')}
                  type="number"
                  min={0}
                  max={100}
                  error={errors.vat_rate?.message}
                  {...register('vat_rate')}
                />

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label={t('subscriptions:payment.fields.invoiceNo')}
                    error={errors.invoice_no?.message}
                    {...register('invoice_no')}
                  />
                  <Select
                    label={t('subscriptions:payment.fields.invoiceType')}
                    options={invoiceTypeOptions}
                    error={errors.invoice_type?.message}
                    {...register('invoice_type')}
                  />
                </div>
              </>
            )}

            <Textarea
              label={t('subscriptions:payment.fields.notes')}
              rows={2}
              error={errors.notes?.message}
              {...register('notes')}
            />
          </>
        )}
      </div>
    </Modal>
  );
}
