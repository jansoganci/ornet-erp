import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Modal, Button, Input } from '../../../components/ui';
import { useRecordPayment } from '../hooks';

export function TahsilatModal({ open, onClose, transaction }) {
  const { t } = useTranslation('finance');
  const recordPayment = useRecordPayment();

  const [amount, setAmount] = useState('');
  const [paidDate, setPaidDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [notes, setNotes] = useState('');

  if (!transaction) return null;

  const remaining = transaction.remaining || transaction.sale_price_net || 0;
  const totalWithVat = transaction.total_with_vat || 0;

  const handleFullPayment = async () => {
    setAmount(String(remaining));
    // Auto-submit with full amount
    setTimeout(async () => {
      try {
        await recordPayment.mutateAsync({
          transaction_id: transaction.transaction_id,
          amount: remaining,
          paid_date: paidDate,
          payment_method: paymentMethod,
          notes: notes || null,
        });
        toast.success(t('tahsilat.success'));
        onClose();
      } catch (err) {
        toast.error(err.message);
      }
    }, 50);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error(t('tahsilat.errors.invalidAmount'));
      return;
    }
    if (parsedAmount > remaining) {
      toast.error(t('tahsilat.errors.amountExceeds'));
      return;
    }
    try {
      await recordPayment.mutateAsync({
        transaction_id: transaction.transaction_id,
        amount: parsedAmount,
        paid_date: paidDate,
        payment_method: paymentMethod,
        notes,
      });
      toast.success(t('tahsilat.success'));
      onClose();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('tahsilat.modalTitle')} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-neutral-500">{t('tahsilat.customer')}</span>
            <span className="font-medium">{transaction.customer_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">{t('tahsilat.totalWithVat')}</span>
            <span className="font-medium">{totalWithVat.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">{t('tahsilat.remaining')}</span>
            <span className="font-medium text-primary-600">{remaining.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</span>
          </div>
        </div>

        <Input
          label={t('tahsilat.amount')}
          type="number"
          step="0.01"
          min="0.01"
          max={remaining}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <Button type="button" variant="primary" size="sm" onClick={handleFullPayment}>
          {t('tahsilat.payFull')}
        </Button>

        <Input
          label={t('tahsilat.paidDate')}
          type="date"
          value={paidDate}
          onChange={(e) => setPaidDate(e.target.value)}
          required
        />

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            {t('tahsilat.paymentMethod')}
          </label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="block w-full h-9 rounded-lg border border-neutral-300 dark:border-[#262626] bg-white dark:bg-[#171717] text-sm px-3"
          >
            <option value="bank_transfer">{t('tahsilat.methods.bankTransfer')}</option>
            <option value="cash">{t('tahsilat.methods.cash')}</option>
            <option value="card">{t('tahsilat.methods.card')}</option>
            <option value="check">{t('tahsilat.methods.check')}</option>
            <option value="other">{t('tahsilat.methods.other')}</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            {t('tahsilat.notes')}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="block w-full rounded-lg border border-neutral-300 dark:border-[#262626] bg-white dark:bg-[#171717] text-sm px-3 py-2"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('common:cancel')}
          </Button>
          <Button type="submit" loading={recordPayment.isPending}>
            {t('tahsilat.save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
