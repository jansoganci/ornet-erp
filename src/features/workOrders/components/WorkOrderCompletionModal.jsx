import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { Modal, Button } from '../../../components/ui';
import { formatCurrency } from '../../../lib/utils';
import { round2 } from '../../../lib/proposalCalc';
import { useFinanceSettings } from '../../finance/hooks';
import { useCompleteWorkOrderWithPayment } from '../hooks';

const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer'];

function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0' || normalized === '') return false;
  }
  return false;
}

export function WorkOrderCompletionModal({ open, onClose, workOrder }) {
  const { t } = useTranslation(['workOrders', 'common']);
  const { data: financeSettings } = useFinanceSettings();

  const storedHasVat = normalizeBoolean(workOrder?.has_vat);
  const storedVatRate = storedHasVat ? Math.max(Number(workOrder?.vat_rate) || 0, 0) : 0;
  const hasTevkifat   = !!workOrder?.has_tevkifat;
  const netAmount = Number(workOrder?.net_amount) || 0;
  const grossAmount = storedHasVat ? (Number(workOrder?.gross_amount) || netAmount) : netAmount;
  const vatAmount = storedHasVat
    ? (Number(workOrder?.vat_amount) || Math.max(grossAmount - netAmount, 0))
    : 0;

  const [collectionDate, setCollectionDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [vatEnabled, setVatEnabled]         = useState(null);
  const [paymentMethod, setPaymentMethod]   = useState('cash');
  const isVatEnabled = storedHasVat && (vatEnabled ?? storedHasVat);
  const displayedVatRate = isVatEnabled ? storedVatRate : 0;
  const displayedVatAmount = isVatEnabled ? vatAmount : 0;
  const basePayableAmount = isVatEnabled ? grossAmount : netAmount;

  const tevkifatNum = Number(financeSettings?.tevkifat_rate_numerator) || 9;
  const tevkifatDen = Number(financeSettings?.tevkifat_rate_denominator) || 10;

  const withheldVat = useMemo(
    () => (
      hasTevkifat && displayedVatAmount > 0
        ? round2(displayedVatAmount * tevkifatNum / tevkifatDen)
        : 0
    ),
    [displayedVatAmount, hasTevkifat, tevkifatNum, tevkifatDen]
  );
  const totalPayable = useMemo(
    () => round2(basePayableAmount - withheldVat),
    [basePayableAmount, withheldVat]
  );

  const currency = workOrder?.currency ?? 'TRY';

  const completeMutation = useCompleteWorkOrderWithPayment();

  const handleClose = () => {
    setVatEnabled(null);
    setPaymentMethod('cash');
    setCollectionDate(new Date().toISOString().slice(0, 10));
    onClose?.();
  };

  const handleSubmit = () => {
    const sanitizedVatRate = storedHasVat && isVatEnabled ? storedVatRate : 0;

    completeMutation.mutate(
      {
        workOrderId:    workOrder.id,
        paymentMethod,
        collectionDate,
        vatRate:        sanitizedVatRate,
      },
      { onSuccess: handleClose }
    );
  };

  return (
      <Modal
      open={open}
      onClose={handleClose}
      title={t('workOrders:completion.title')}
      size="sm"
      footer={
        <div className="flex gap-3 w-full">
          <Button variant="ghost" onClick={handleClose} className="flex-1" disabled={completeMutation.isPending}>
            {t('common:actions.cancel')}
          </Button>
          <Button
            variant="success"
            onClick={handleSubmit}
            loading={completeMutation.isPending}
            className="flex-1"
          >
            {t('workOrders:completion.confirmButton')}
          </Button>
        </div>
      }
    >
      <div className="space-y-5 py-2">

        {/* Collection date */}
        <div>
          <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5">
            {t('workOrders:completion.collectionDate')}
          </label>
          <input
            type="date"
            value={collectionDate}
            onChange={(e) => setCollectionDate(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* VAT toggle */}
        {storedHasVat && (
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isVatEnabled}
              onChange={(e) => setVatEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600 accent-primary-600"
            />
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {t('workOrders:completion.vatIncluded')}
              <span className="ml-1 text-neutral-400 text-xs">(%{displayedVatRate})</span>
            </span>
          </label>
        )}

        {/* Amount summary */}
        <div className="rounded-xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 p-4 space-y-2">
          <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-widest mb-3">
            {t('workOrders:completion.amountSummary')}
          </p>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600 dark:text-neutral-400">{t('workOrders:completion.netAmount')}</span>
            <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">{formatCurrency(netAmount, currency)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600 dark:text-neutral-400">{t('workOrders:completion.vatAmount')}</span>
            <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">{formatCurrency(displayedVatAmount, currency)}</span>
          </div>
          {hasTevkifat && (
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600 dark:text-neutral-400">{t('workOrders:detail.withheldVat')}</span>
              <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">-{formatCurrency(withheldVat, currency)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm pt-2 border-t border-neutral-200 dark:border-neutral-700">
            <span className="font-bold text-neutral-900 dark:text-neutral-100">{t('workOrders:completion.totalAmount')}</span>
            <span className="font-mono font-bold text-lg text-primary-600 dark:text-primary-400">{formatCurrency(totalPayable, currency)}</span>
          </div>
        </div>

        {/* Payment method */}
        <div>
          <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
            {t('workOrders:completion.paymentMethod')}
          </p>
          <div className="space-y-2">
            {PAYMENT_METHODS.map((method) => (
              <label key={method} className="flex items-center gap-3 cursor-pointer p-2.5 rounded-lg border border-transparent hover:bg-neutral-50 dark:hover:bg-neutral-900/50 has-[:checked]:border-primary-300 dark:has-[:checked]:border-primary-700 has-[:checked]:bg-primary-50 dark:has-[:checked]:bg-primary-950/20 transition-colors">
                <input
                  type="radio"
                  name="paymentMethod"
                  value={method}
                  checked={paymentMethod === method}
                  onChange={() => setPaymentMethod(method)}
                  className="accent-primary-600"
                />
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  {t(`workOrders:completion.paymentMethods.${method}`)}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Bank transfer hint */}
        {paymentMethod === 'bank_transfer' && (
          <div className="flex items-start gap-2 rounded-lg bg-warning-50 dark:bg-warning-950/20 border border-warning-200 dark:border-warning-800/40 p-3">
            <Info className="w-4 h-4 text-warning-600 dark:text-warning-400 shrink-0 mt-0.5" />
            <p className="text-xs text-warning-700 dark:text-warning-300 leading-relaxed">
              {t('workOrders:completion.bankTransferHint')}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
