import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Button } from '../../../components/ui';
import { formatCurrency } from '../../../lib/utils';
import { useCreateTransactionPayment, useTransactionPayments } from '../hooks';

const PAYMENT_METHODS = ['bank_transfer', 'cash', 'card'];

function paymentMethodLabel(t, method) {
  const map = {
    cash: t('finance:expense.paymentMethods.cash'),
    card: t('finance:expense.paymentMethods.card'),
    bank_transfer: t('finance:expense.paymentMethods.bank_transfer'),
  };
  return map[method] ?? method;
}

export function AddPaymentModal({ open, onClose, transaction }) {
  const { t } = useTranslation(['finance', 'common']);

  const amountTry   = Number(transaction?.amount_try)  || 0;
  const outputVat   = Number(transaction?.output_vat)  || 0;
  const documentTotal = amountTry + outputVat;

  const { data: existingPayments = [] } = useTransactionPayments(
    open ? transaction?.id : null
  );

  const alreadyPaid = existingPayments.reduce(
    (sum, p) => sum + (Number(p.amount_try) || 0),
    0
  );
  const remaining = Math.max(0, documentTotal - alreadyPaid);

  const [amount, setAmount]               = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [paidAt, setPaidAt]               = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes]                 = useState('');

  const createMutation = useCreateTransactionPayment();

  const handleSubmit = () => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) return;

    createMutation.mutate(
      {
        transactionId: transaction.id,
        amountTry:     parsedAmount,
        paymentMethod,
        paidAt,
        notes:         notes.trim() || null,
      },
      { onSuccess: onClose }
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('finance:receivables.addPayment.title')}
      size="sm"
      footer={
        <div className="flex gap-3 w-full">
          <Button variant="ghost" onClick={onClose} className="flex-1" disabled={createMutation.isPending}>
            {t('common:actions.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            loading={createMutation.isPending}
            disabled={!parseFloat(amount) || parseFloat(amount) <= 0}
            className="flex-1"
          >
            {t('finance:receivables.addPayment.confirmButton')}
          </Button>
        </div>
      }
    >
      <div className="space-y-5 py-2">

        {/* Document total summary */}
        <div className="rounded-xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 p-4 space-y-2">
          <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-widest mb-3">
            {t('finance:receivables.addPayment.documentTotal')}
          </p>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600 dark:text-neutral-400">{t('finance:receivables.columns.netAmount')}</span>
            <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">{formatCurrency(amountTry, 'TRY')}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600 dark:text-neutral-400">{t('finance:receivables.columns.vatAmount')}</span>
            <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">{formatCurrency(outputVat, 'TRY')}</span>
          </div>
          <div className="flex justify-between text-sm pt-2 border-t border-neutral-200 dark:border-neutral-700">
            <span className="font-bold text-neutral-900 dark:text-neutral-100">{t('finance:receivables.columns.totalAmount')}</span>
            <span className="font-mono font-bold text-lg text-neutral-900 dark:text-neutral-100">{formatCurrency(documentTotal, 'TRY')}</span>
          </div>
          {alreadyPaid > 0 && (
            <div className="flex justify-between text-sm pt-2 border-t border-neutral-200 dark:border-neutral-700">
              <span className="text-neutral-500 dark:text-neutral-400">Kalan</span>
              <span className="font-mono font-bold text-warning-600 dark:text-warning-400">{formatCurrency(remaining, 'TRY')}</span>
            </div>
          )}
        </div>

        {/* Amount */}
        <div>
          <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5">
            {t('finance:receivables.addPayment.amount')}
          </label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            placeholder={remaining > 0 ? remaining.toFixed(2) : '0.00'}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Payment method */}
        <div>
          <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5">
            {t('finance:receivables.addPayment.paymentMethod')}
          </label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>{paymentMethodLabel(t, m)}</option>
            ))}
          </select>
        </div>

        {/* Paid at */}
        <div>
          <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5">
            {t('finance:receivables.addPayment.paidAt')}
          </label>
          <input
            type="date"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5">
            {t('finance:receivables.addPayment.notes')}
          </label>
          <textarea
            rows={2}
            placeholder={t('finance:receivables.addPayment.notesPlaceholder')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          />
        </div>
      </div>
    </Modal>
  );
}
