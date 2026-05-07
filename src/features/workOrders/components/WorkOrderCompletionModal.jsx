import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { Modal, Button } from '../../../components/ui';
import { formatCurrency } from '../../../lib/utils';
import { calcVatTevkifatSummary } from '../../../lib/proposalCalc';
import { useFinanceSettings } from '../../finance/hooks';
import { useCompleteWorkOrderWithPayment } from '../hooks';

const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer'];

function computeGrandTotal(workOrder) {
  const currency = workOrder.currency ?? 'TRY';
  const items = workOrder.work_order_materials ?? [];
  const discountPercent = Number(workOrder.materials_discount_percent) || 0;

  const subtotal = items.reduce((sum, row) => {
    const qty = parseFloat(row.quantity) || 0;
    const price = currency === 'USD'
      ? (parseFloat(row.unit_price_usd) || 0)
      : (parseFloat(row.unit_price) || 0);
    return sum + qty * price;
  }, 0);

  const discountAmount = subtotal * (discountPercent / 100);
  return subtotal - discountAmount;
}

export function WorkOrderCompletionModal({ open, onClose, workOrder }) {
  const { t } = useTranslation(['workOrders', 'common']);
  const { data: financeSettings } = useFinanceSettings();

  const storedVatRate = Number(workOrder?.vat_rate) || 0;
  const hasTevkifat   = !!workOrder?.has_tevkifat;

  const [collectionDate, setCollectionDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [vatEnabled, setVatEnabled]         = useState(storedVatRate > 0);
  const [paymentMethod, setPaymentMethod]   = useState('cash');

  const effectiveVatRate = vatEnabled ? storedVatRate : 0;

  const grandTotal = useMemo(() => computeGrandTotal(workOrder ?? {}), [workOrder]);

  const tevkifatNum = Number(financeSettings?.tevkifat_rate_numerator) || 9;
  const tevkifatDen = Number(financeSettings?.tevkifat_rate_denominator) || 10;

  const { vatAmount, totalPayable } = useMemo(
    () => calcVatTevkifatSummary(grandTotal, effectiveVatRate, hasTevkifat, tevkifatNum, tevkifatDen),
    [grandTotal, effectiveVatRate, hasTevkifat, tevkifatNum, tevkifatDen]
  );

  const currency = workOrder?.currency ?? 'TRY';

  const completeMutation = useCompleteWorkOrderWithPayment();

  const handleSubmit = () => {
    completeMutation.mutate(
      {
        workOrderId:    workOrder.id,
        paymentMethod,
        collectionDate,
        vatRate:        vatEnabled ? storedVatRate : 0,
      },
      { onSuccess: onClose }
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('workOrders:completion.title')}
      size="sm"
      footer={
        <div className="flex gap-3 w-full">
          <Button variant="ghost" onClick={onClose} className="flex-1" disabled={completeMutation.isPending}>
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
        {storedVatRate > 0 && (
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={vatEnabled}
              onChange={(e) => setVatEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600 accent-primary-600"
            />
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {t('workOrders:completion.vatIncluded')}
              <span className="ml-1 text-neutral-400 text-xs">(%{storedVatRate})</span>
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
            <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">{formatCurrency(grandTotal, currency)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600 dark:text-neutral-400">{t('workOrders:completion.vatAmount')}</span>
            <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">{formatCurrency(vatAmount, currency)}</span>
          </div>
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
