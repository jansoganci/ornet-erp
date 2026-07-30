import { useState, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight, ExternalLink, Clock, CheckCircle2 } from 'lucide-react';
import { PageContainer } from '../../components/layout';
import { Card, Skeleton, EmptyState } from '../../components/ui';
import { formatCurrency, formatDate, cn } from '../../lib/utils';
import { grossCollectibleTotal, grossRemainingCollectible } from './utils';
import { useReceivables } from './hooks';
import { AddPaymentModal } from './components/AddPaymentModal';

const MAIN_COL_COUNT = 9;

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

  if (status === 'partially_paid' || status === 'partial') {
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

function Th({ children, align = 'left', className }) {
  return (
    <th
      className={cn(
        'py-3 px-3 text-[10px] uppercase font-bold text-neutral-400 tracking-widest whitespace-nowrap',
        align === 'right' ? 'text-right' : 'text-left',
        className
      )}
    >
      {children}
    </th>
  );
}

function DetailItem({ label, children }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 dark:text-neutral-500 mb-0.5">
        {label}
      </p>
      <div className="text-sm text-neutral-800 dark:text-neutral-200">{children}</div>
    </div>
  );
}

function ReceivablesTable({ rows, onAddPayment }) {
  const { t } = useTranslation(['finance', 'common']);
  const [expandedId, setExpandedId] = useState(null);

  const toggleExpanded = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm table-fixed">
        <colgroup>
          <col className="w-10" />
          <col className="w-[18%]" />
          <col className="w-[11%]" />
          <col className="w-[28%]" />
          <col className="w-[11%]" />
          <col className="w-[11%]" />
          <col className="w-[10%]" />
          <col className="w-[9%]" />
          <col className="w-[12%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-neutral-200 dark:border-neutral-800">
            <Th className="w-10 px-2" aria-label={t('finance:receivables.expandToggle')} />
            <Th>{t('finance:receivables.columns.customer')}</Th>
            <Th>{t('finance:receivables.columns.incomeType')}</Th>
            <Th>{t('finance:receivables.columns.description')}</Th>
            <Th align="right">{t('finance:receivables.columns.remainingCollectible')}</Th>
            <Th>{t('finance:receivables.columns.paymentMethod')}</Th>
            <Th>{t('finance:receivables.columns.status')}</Th>
            <Th>{t('finance:receivables.columns.date')}</Th>
            <th className="py-3 px-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
          {rows.map((row) => {
            const net = Number(row.amount_try) || 0;
            const vat = Number(row.output_vat) || 0;
            const cogs = Number(row.cogs_try) || 0;
            const profit = net - cogs;
            const documentTotal = grossCollectibleTotal(row.amount_try, row.output_vat);
            const collected = Number(row.total_collected) || 0;
            const remaining = grossRemainingCollectible(row.amount_try, row.output_vat, collected);
            const customerName = row.customers?.company_name ?? '—';
            const incomeTypeLabel = row.income_type
              ? t(`finance:income.incomeTypes.${row.income_type}`, { defaultValue: row.income_type })
              : '—';
            const paymentMethodLabel = row.payment_method
              ? t(`finance:expense.paymentMethods.${row.payment_method}`, { defaultValue: row.payment_method })
              : '—';
            const description = row.description?.trim() || '—';
            const isExpanded = expandedId === row.id;

            return (
              <Fragment key={row.id}>
                <tr
                  className={cn(
                    'hover:bg-neutral-50 dark:hover:bg-neutral-900/30 transition-colors',
                    isExpanded && 'bg-neutral-50/80 dark:bg-neutral-900/20'
                  )}
                >
                  <td className="py-3 px-2 align-top">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(row.id)}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                      aria-expanded={isExpanded}
                      aria-label={t('finance:receivables.expandToggle')}
                    >
                      <ChevronRight
                        className={cn('w-4 h-4 transition-transform', isExpanded && 'rotate-90')}
                      />
                    </button>
                  </td>
                  <td className="py-3 px-3 align-top font-medium text-neutral-900 dark:text-neutral-100">
                    <span className="block line-clamp-2 break-words" title={customerName !== '—' ? customerName : undefined}>
                      {customerName}
                    </span>
                  </td>
                  <td className="py-3 px-3 align-top text-neutral-700 dark:text-neutral-300">
                    <span className="block leading-snug">{incomeTypeLabel}</span>
                  </td>
                  <td className="py-3.5 px-3 align-top text-neutral-700 dark:text-neutral-300">
                    <span
                      className="block text-[13px] leading-snug line-clamp-2 break-words"
                      title={description !== '—' ? description : undefined}
                    >
                      {description}
                    </span>
                  </td>
                  <td className="py-3 px-3 align-top text-right font-mono font-bold text-primary-600 dark:text-primary-400 whitespace-nowrap">
                    {formatCurrency(remaining, 'TRY')}
                  </td>
                  <td className="py-3 px-3 align-top text-neutral-600 dark:text-neutral-400">
                    <span className="block leading-snug">{paymentMethodLabel}</span>
                  </td>
                  <td className="py-3 px-3 align-top">
                    <StatusBadge status={row.payment_status} />
                  </td>
                  <td className="py-3 px-3 align-top text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                    {row.transaction_date ? formatDate(row.transaction_date) : '—'}
                  </td>
                  <td className="py-3 px-3 align-top whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onAddPayment(row)}
                      className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 border border-primary-300 dark:border-primary-700 rounded-lg px-3 py-1.5 hover:bg-primary-50 dark:hover:bg-primary-950/20 transition-colors"
                    >
                      {t('finance:receivables.addPayment.title')}
                    </button>
                  </td>
                </tr>
                {isExpanded ? (
                  <tr className="bg-neutral-50 dark:bg-neutral-900/40">
                    <td colSpan={MAIN_COL_COUNT} className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800/60">
                      <div className="pl-8 pr-2">
                        <p className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 dark:text-neutral-500 mb-2.5">
                          {t('finance:receivables.detailTitle')}
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3">
                          <DetailItem label={t('finance:receivables.columns.workOrder')}>
                            <SourceLink row={row} />
                          </DetailItem>
                          <DetailItem label={t('finance:receivables.columns.period')}>
                            <span className="font-mono text-xs">{row.period || '—'}</span>
                          </DetailItem>
                          <DetailItem label={t('finance:receivables.columns.netAmount')}>
                            <span className="font-mono">{formatCurrency(net, 'TRY')}</span>
                          </DetailItem>
                          <DetailItem label={t('finance:receivables.columns.vatAmount')}>
                            <span className="font-mono">
                              {vat > 0 ? formatCurrency(vat, 'TRY') : '—'}
                            </span>
                          </DetailItem>
                          <DetailItem label={t('finance:receivables.columns.documentTotal')}>
                            <span className="font-mono font-semibold">
                              {formatCurrency(documentTotal, 'TRY')}
                            </span>
                          </DetailItem>
                          <DetailItem label={t('finance:receivables.columns.collected')}>
                            <span className="font-mono">
                              {collected > 0 ? formatCurrency(collected, 'TRY') : '—'}
                            </span>
                          </DetailItem>
                          <DetailItem label={t('finance:receivables.columns.cogsTry')}>
                            <span className="font-mono">
                              {cogs > 0 ? formatCurrency(cogs, 'TRY') : '—'}
                            </span>
                          </DetailItem>
                          <DetailItem label={t('finance:receivables.columns.profit')}>
                            <span className="font-mono font-medium">
                              {formatCurrency(profit, 'TRY')}
                            </span>
                          </DetailItem>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
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

      <AddPaymentModal
        open={!!selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
        transaction={selectedTransaction}
      />
    </PageContainer>
  );
}
