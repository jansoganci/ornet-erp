import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Clock, CheckCircle2 } from 'lucide-react';
import { PageContainer } from '../../components/layout';
import { Card, Skeleton, EmptyState } from '../../components/ui';
import { formatCurrency, formatDate } from '../../lib/utils';
import { useReceivables } from './hooks';
import { AddPaymentModal } from './components/AddPaymentModal';

function SourceLink({ row }) {
  if (row.work_order_id && row.work_orders?.form_no) {
    return (
      <Link
        to={`/work-orders/${row.work_order_id}`}
        className="inline-flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:underline font-medium"
      >
        {row.work_orders.form_no}
        <ExternalLink className="w-3 h-3 shrink-0" />
      </Link>
    );
  }
  if (row.proposal_id && row.proposals?.proposal_no) {
    return (
      <Link
        to={`/proposals/${row.proposal_id}`}
        className="inline-flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:underline font-medium"
        title={row.proposals.title ?? undefined}
      >
        {row.proposals.proposal_no}
        <ExternalLink className="w-3 h-3 shrink-0" />
      </Link>
    );
  }
  return <span className="text-neutral-400">—</span>;
}

function StatusBadge({ status }) {
  const { t } = useTranslation('finance');
  const label = t(`receivables.status.${status}`, { defaultValue: status });

  if (status === 'partially_paid') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-warning-100 dark:bg-warning-950/40 text-warning-700 dark:text-warning-300 border border-warning-200 dark:border-warning-800/40">
        <Clock className="w-3 h-3" />
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-error-100 dark:bg-error-950/40 text-error-700 dark:text-error-300 border border-error-200 dark:border-error-800/40">
      <Clock className="w-3 h-3" />
      {label}
    </span>
  );
}

function ReceivablesTable({ rows, onAddPayment }) {
  const { t } = useTranslation(['finance', 'common']);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 dark:border-neutral-800">
            <th className="text-left py-3 px-4 text-[10px] uppercase font-bold text-neutral-400 tracking-widest whitespace-nowrap">
              {t('finance:receivables.columns.customer')}
            </th>
            <th className="text-left py-3 px-4 text-[10px] uppercase font-bold text-neutral-400 tracking-widest whitespace-nowrap">
              {t('finance:receivables.columns.workOrder')}
            </th>
            <th className="text-right py-3 px-4 text-[10px] uppercase font-bold text-neutral-400 tracking-widest whitespace-nowrap">
              {t('finance:receivables.columns.netAmount')}
            </th>
            <th className="text-right py-3 px-4 text-[10px] uppercase font-bold text-neutral-400 tracking-widest whitespace-nowrap">
              {t('finance:receivables.columns.vatAmount')}
            </th>
            <th className="text-right py-3 px-4 text-[10px] uppercase font-bold text-neutral-400 tracking-widest whitespace-nowrap">
              {t('finance:receivables.columns.totalAmount')}
            </th>
            <th className="text-left py-3 px-4 text-[10px] uppercase font-bold text-neutral-400 tracking-widest whitespace-nowrap">
              {t('finance:receivables.columns.status')}
            </th>
            <th className="text-left py-3 px-4 text-[10px] uppercase font-bold text-neutral-400 tracking-widest whitespace-nowrap">
              {t('finance:receivables.columns.date')}
            </th>
            <th className="py-3 px-4" />
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
          {rows.map((row) => {
            const net   = Number(row.amount_try) || 0;
            const vat   = Number(row.output_vat) || 0;
            const total = net + vat;
            const customerName = row.customers?.company_name ?? '—';

            return (
              <tr key={row.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/30 transition-colors">
                <td className="py-3 px-4 font-medium text-neutral-900 dark:text-neutral-100 whitespace-nowrap">
                  {customerName}
                </td>
                <td className="py-3 px-4 whitespace-nowrap">
                  <SourceLink row={row} />
                </td>
                <td className="py-3 px-4 text-right font-mono text-neutral-900 dark:text-neutral-100 whitespace-nowrap">
                  {formatCurrency(net, 'TRY')}
                </td>
                <td className="py-3 px-4 text-right font-mono text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                  {formatCurrency(vat, 'TRY')}
                </td>
                <td className="py-3 px-4 text-right font-mono font-bold text-neutral-900 dark:text-neutral-100 whitespace-nowrap">
                  {formatCurrency(total, 'TRY')}
                </td>
                <td className="py-3 px-4 whitespace-nowrap">
                  <StatusBadge status={row.payment_status} />
                </td>
                <td className="py-3 px-4 text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                  {row.transaction_date ? formatDate(row.transaction_date) : '—'}
                </td>
                <td className="py-3 px-4 whitespace-nowrap">
                  <button
                    onClick={() => onAddPayment(row)}
                    className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 border border-primary-300 dark:border-primary-700 rounded-lg px-3 py-1.5 hover:bg-primary-50 dark:hover:bg-primary-950/20 transition-colors"
                  >
                    {t('finance:receivables.addPayment.title')}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PageSkeleton() {
  return (
    <PageContainer maxWidth="full" padding="default" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </PageContainer>
  );
}

export function ReceivablesPage() {
  const { t } = useTranslation(['finance', 'common']);
  const { data: rows = [], isLoading } = useReceivables();

  const [selectedTransaction, setSelectedTransaction] = useState(null);

  if (isLoading) return <PageSkeleton />;

  return (
    <PageContainer maxWidth="full" padding="default" className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-neutral-900 dark:text-neutral-100">
            {t('finance:receivables.title')}
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {t('finance:receivables.subtitle')}
          </p>
        </div>
        {rows.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-warning-100 dark:bg-warning-950/40 border border-warning-200 dark:border-warning-800/40">
            <Clock className="w-4 h-4 text-warning-600 dark:text-warning-400" />
            <span className="text-sm font-bold text-warning-700 dark:text-warning-300">
              {rows.length}
            </span>
          </div>
        )}
      </div>

      {/* Table card */}
      {rows.length === 0 ? (
        <Card className="p-12">
          <EmptyState
            icon={CheckCircle2}
            title={t('finance:receivables.empty.title')}
            description={t('finance:receivables.empty.description')}
          />
        </Card>
      ) : (
        <Card padding="none">
          <ReceivablesTable rows={rows} onAddPayment={setSelectedTransaction} />
        </Card>
      )}

      {/* Add payment modal */}
      <AddPaymentModal
        open={!!selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
        transaction={selectedTransaction}
      />
    </PageContainer>
  );
}
