import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X, Minus, Circle } from 'lucide-react';
import { Card } from '../../../components/ui';
import { formatCurrency, cn } from '../../../lib/utils';
import { PaymentRecordModal } from './PaymentRecordModal';

const MONTH_NAMES_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

const statusConfig = {
  paid: {
    bg: 'bg-success-50 dark:bg-success-900/20',
    border: 'border-success-200 dark:border-success-800/40',
    icon: Check,
    iconColor: 'text-success-600 dark:text-success-400',
    textColor: 'text-success-700 dark:text-success-300',
  },
  pending: {
    bg: 'bg-neutral-50 dark:bg-neutral-800/30',
    border: 'border-neutral-200 dark:border-neutral-700',
    icon: Circle,
    iconColor: 'text-neutral-400 dark:text-neutral-500',
    textColor: 'text-neutral-600 dark:text-neutral-400',
  },
  failed: {
    bg: 'bg-error-50 dark:bg-error-900/20',
    border: 'border-error-200 dark:border-error-800/40',
    icon: X,
    iconColor: 'text-error-600 dark:text-error-400',
    textColor: 'text-error-700 dark:text-error-300',
  },
  skipped: {
    bg: 'bg-neutral-100 dark:bg-neutral-900/40',
    border: 'border-dashed border-neutral-300 dark:border-neutral-700',
    icon: Minus,
    iconColor: 'text-neutral-400 dark:text-neutral-500',
    textColor: 'text-neutral-500 dark:text-neutral-500',
  },
  write_off: {
    bg: 'bg-warning-50 dark:bg-warning-900/20',
    border: 'border-warning-200 dark:border-warning-800/40',
    icon: Minus,
    iconColor: 'text-warning-600 dark:text-warning-400',
    textColor: 'text-warning-700 dark:text-warning-300 line-through',
  },
};

function getMonthIndex(paymentMonth) {
  if (!paymentMonth) return 0;
  return new Date(paymentMonth).getMonth();
}

export function MonthlyPaymentGrid({ payments = [] }) {
  const { t } = useTranslation('subscriptions');
  const [selectedPayment, setSelectedPayment] = useState(null);

  const handleCellClick = (payment) => {
    if (['pending', 'failed'].includes(payment.status)) {
      setSelectedPayment(payment);
    }
  };

  const paidPayments = payments.filter((p) => p.status === 'paid');
  const pendingPayments = payments.filter((p) => p.status === 'pending');
  const paidTotal = paidPayments.reduce((sum, p) => sum + Number(p.total_amount || 0), 0);
  const pendingTotal = pendingPayments.reduce((sum, p) => sum + Number(p.total_amount || 0), 0);

  return (
    <Card className="overflow-hidden">
      <div className="bg-primary-50/50 dark:bg-primary-950/10 px-5 py-3 border-b border-primary-100 dark:border-primary-900/20 flex items-center space-x-2">
        <h3 className="font-bold text-primary-900 dark:text-primary-100 uppercase tracking-wider text-xs">
          {t('payment.title')}
        </h3>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
          {payments.map((payment) => {
            const monthIdx = getMonthIndex(payment.payment_month);
            const config = statusConfig[payment.status] || statusConfig.pending;
            const Icon = config.icon;
            const isClickable = ['pending', 'failed'].includes(payment.status);

            return (
              <button
                key={payment.id}
                type="button"
                onClick={() => handleCellClick(payment)}
                disabled={!isClickable}
                className={cn(
                  'relative flex flex-col items-center rounded-xl border p-3 transition-all',
                  config.bg,
                  config.border,
                  isClickable
                    ? 'cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-[0.98]'
                    : 'cursor-default'
                )}
              >
                <span className={cn('text-xs font-bold uppercase tracking-wider', config.textColor)}>
                  {MONTH_NAMES_TR[monthIdx]}
                </span>
                <Icon className={cn('w-4 h-4 my-1', config.iconColor)} />
                <span className={cn('text-[10px] font-medium', config.textColor)}>
                  {formatCurrency(payment.total_amount)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Summary row */}
        <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 grid grid-cols-2 gap-4">
          <div className="text-center">
            <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
              {t('payment.statuses.paid')} ({paidPayments.length})
            </p>
            <p className="text-sm font-bold text-success-600 dark:text-success-400">
              {formatCurrency(paidTotal)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
              {t('payment.statuses.pending')} ({pendingPayments.length})
            </p>
            <p className="text-sm font-bold text-neutral-600 dark:text-neutral-400">
              {formatCurrency(pendingTotal)}
            </p>
          </div>
        </div>
      </div>

      <PaymentRecordModal
        open={!!selectedPayment}
        onClose={() => setSelectedPayment(null)}
        payment={selectedPayment}
      />
    </Card>
  );
}
