import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '../../../components/ui';
import { formatCurrency } from '../../../lib/utils';
import { supabase } from '../../../lib/supabase';

export function ParasutPaymentsList({ transaction, onPaymentDeleted }) {
  const { t } = useTranslation('finance');
  const [deleting, setDeleting] = useState(null);

  if (!transaction?.parasut_payments?.length) return null;

  const handleDelete = async (paymentId) => {
    setDeleting(paymentId);
    try {
      const { data, error } = await supabase.functions.invoke('parasut-dispatch', {
        body: {
          action: 'delete-payment',
          payload: { financial_transaction_payment_id: paymentId },
        },
      });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data.error || t('tahsilat.errors.deleteFailed'));
      toast.success(t('tahsilat.paymentDeleted'));
      onPaymentDeleted?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
        {t('tahsilat.parasutPayments')}
      </p>
      {transaction.parasut_payments.map((payment) => (
        <div
          key={payment.id}
          className="flex items-center justify-between text-sm bg-neutral-50 dark:bg-neutral-800/50 rounded px-3 py-2"
        >
          <span>
            {payment.date} — {formatCurrency(payment.amount, 'TRY')}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            loading={deleting === payment.id}
            onClick={() => handleDelete(payment.id)}
          >
            {t('common:actions.delete')}
          </Button>
        </div>
      ))}
    </div>
  );
}
