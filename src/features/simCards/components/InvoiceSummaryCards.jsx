import { useTranslation } from 'react-i18next';
import { FileText, DollarSign, CheckCircle2, AlertCircle, TrendingUp, Activity } from 'lucide-react';
import { Card } from '../../../components/ui';
import { formatCurrency } from '../../../lib/utils';

export function InvoiceSummaryCards({ summary }) {
  const { t } = useTranslation('invoiceAnalysis');

  const {
    totalLines = 0,
    totalInvoiceAmount = 0,
    matchedCount = 0,
    invoiceOnlyCount = 0,
    overageCount = 0,
    totalProfit = 0,
  } = summary;

  const profitPositive = totalProfit >= 0;

  const cards = [
    {
      label: t('summary.totalLines'),
      value: totalLines.toLocaleString('tr-TR'),
      icon: FileText,
      color: 'text-neutral-600 dark:text-neutral-400',
      bg: 'bg-neutral-50 dark:bg-neutral-900/20',
    },
    {
      label: t('summary.totalAmount'),
      value: formatCurrency(totalInvoiceAmount),
      icon: DollarSign,
      color: 'text-primary-600 dark:text-primary-400',
      bg: 'bg-primary-50 dark:bg-primary-900/20',
    },
    {
      label: t('summary.matched'),
      value: matchedCount.toLocaleString('tr-TR'),
      icon: CheckCircle2,
      color: 'text-success-600 dark:text-success-400',
      bg: 'bg-success-50 dark:bg-success-900/20',
    },
    {
      label: t('summary.invoiceOnly'),
      value: invoiceOnlyCount.toLocaleString('tr-TR'),
      icon: AlertCircle,
      color: 'text-error-600 dark:text-error-400',
      bg: 'bg-error-50 dark:bg-error-900/20',
    },
    {
      label: t('summary.overageCount'),
      value: overageCount.toLocaleString('tr-TR'),
      icon: Activity,
      color: 'text-warning-600 dark:text-warning-400',
      bg: 'bg-warning-50 dark:bg-warning-900/20',
    },
    {
      label: t('summary.estimatedProfitLoss'),
      value: formatCurrency(totalProfit),
      icon: TrendingUp,
      color: profitPositive
        ? 'text-success-600 dark:text-success-400'
        : 'text-error-600 dark:text-error-400',
      bg: profitPositive
        ? 'bg-success-50 dark:bg-success-900/20'
        : 'bg-error-50 dark:bg-error-900/20',
    },
  ];

  return (
    <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 mb-6">
      {cards.map((card, i) => (
        <Card key={i} className="p-4 border-neutral-200/60 dark:border-neutral-800/60 shadow-sm">
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-xl ${card.bg} shrink-0`}>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider leading-snug mb-1 break-words">
                {card.label}
              </p>
              <p className={`text-lg font-black leading-tight ${card.color}`}>
                {card.value}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
