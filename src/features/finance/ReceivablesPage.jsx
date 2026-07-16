import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Landmark,
  Plus,
  Wallet,
} from 'lucide-react';
import { PageContainer } from '../../components/layout';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  SearchInput,
  Select,
  Skeleton,
} from '../../components/ui';
import { normalizeForSearch } from '../../lib/normalizeForSearch';
import { formatCurrency, formatDate } from '../../lib/utils';
import {
  formatFinancePeriodLabel,
  getReceivableRowAmounts,
  getReceivableWorkDate,
  isPartialPaymentStatus,
  isReceivablePeriodOverdue,
  summarizeReceivableRows,
} from './utils';
import { useReceivables } from './hooks';
import { RECEIVABLE_FETCH_LIMIT } from './api';
import { AddPaymentModal } from './components/AddPaymentModal';
import { ChannelKpiCard } from './components/dashboard/ChannelKpiCard';

const STATUS_FILTERS = ['all', 'unpaid', 'partial'];

function SourceCell({ row }) {
  const { t } = useTranslation('finance');

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

  if (row.income_type) {
    return (
      <Badge variant="secondary">
        {t(`income.incomeTypes.${row.income_type}`, { defaultValue: row.income_type })}
      </Badge>
    );
  }

  return <span className="text-neutral-400">—</span>;
}

function StatusBadge({ status }) {
  const { t } = useTranslation('finance');
  const label = t(`receivables.status.${status}`, { defaultValue: status });
  const variant = isPartialPaymentStatus(status) ? 'warning' : 'error';

  return <Badge variant={variant}>{label}</Badge>;
}

function PeriodBadge({ period, t }) {
  const label = formatFinancePeriodLabel(period, t) ?? '—';
  const overdue = isReceivablePeriodOverdue(period);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className={
          overdue
            ? 'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-warning-100 dark:bg-warning-950/40 text-warning-800 dark:text-warning-200'
            : 'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-primary-50 dark:bg-primary-950/30 text-primary-700 dark:text-primary-300'
        }
      >
        {label}
      </span>
      {overdue && (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wide text-warning-700 dark:text-warning-300">
          <AlertTriangle className="w-3 h-3" />
          {t('finance:receivables.overdue')}
        </span>
      )}
    </div>
  );
}

function filterReceivableRows(rows, { search, period, status }) {
  const normalizedSearch = normalizeForSearch(search);

  return rows.filter((row) => {
    if (period !== 'all' && row.period !== period) return false;

    if (status === 'unpaid' && isPartialPaymentStatus(row.payment_status)) return false;
    if (status === 'partial' && !isPartialPaymentStatus(row.payment_status)) return false;

    if (!normalizedSearch) return true;

    const customerName = row.customers?.company_name ?? '';
    const formNo = row.work_orders?.form_no ?? '';
    const proposalNo = row.proposals?.proposal_no ?? '';
    const incomeType = row.income_type ?? '';
    const haystack = normalizeForSearch(`${customerName} ${formNo} ${proposalNo} ${incomeType}`);

    return haystack.includes(normalizedSearch);
  });
}

function groupRowsByPeriod(rows, t) {
  const groups = new Map();

  for (const row of rows) {
    const key = row.period || 'unknown';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([period, groupRows]) => {
      const sortedRows = [...groupRows].sort((a, b) => {
        const dateA = getReceivableWorkDate(a) ?? '';
        const dateB = getReceivableWorkDate(b) ?? '';
        return String(dateB).localeCompare(String(dateA));
      });

      const groupSummary = summarizeReceivableRows(sortedRows);

      return {
        period,
        periodLabel: formatFinancePeriodLabel(period, t) ?? period,
        overdue: isReceivablePeriodOverdue(period),
        rows: sortedRows,
        ...groupSummary,
      };
    });
}

function ReceivablesTable({ groups, showCollectedColumn, onAddPayment }) {
  const { t } = useTranslation(['finance', 'common']);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[52rem]">
        <thead className="sticky top-0 z-10 bg-white dark:bg-[#171717]">
          <tr className="border-b border-neutral-200 dark:border-neutral-800">
            <th className="text-left py-3 px-4 text-[10px] uppercase font-bold text-neutral-400 tracking-widest whitespace-nowrap">
              {t('finance:receivables.columns.customer')}
            </th>
            <th className="text-left py-3 px-4 text-[10px] uppercase font-bold text-neutral-400 tracking-widest whitespace-nowrap">
              {t('finance:receivables.columns.workDate')}
            </th>
            <th className="text-left py-3 px-4 text-[10px] uppercase font-bold text-neutral-400 tracking-widest whitespace-nowrap">
              {t('finance:receivables.columns.workOrder')}
            </th>
            <th className="text-right py-3 px-4 text-[10px] uppercase font-bold text-neutral-400 tracking-widest whitespace-nowrap">
              {t('finance:receivables.columns.documentTotal')}
            </th>
            {showCollectedColumn && (
              <th className="text-right py-3 px-4 text-[10px] uppercase font-bold text-neutral-400 tracking-widest whitespace-nowrap">
                {t('finance:receivables.columns.collected')}
              </th>
            )}
            <th className="text-right py-3 px-4 text-[10px] uppercase font-bold text-neutral-400 tracking-widest whitespace-nowrap">
              {t('finance:receivables.columns.remainingCollectible')}
            </th>
            <th className="text-left py-3 px-4 text-[10px] uppercase font-bold text-neutral-400 tracking-widest whitespace-nowrap">
              {t('finance:receivables.columns.status')}
            </th>
            <th className="text-right py-3 px-4 text-[10px] uppercase font-bold text-neutral-400 tracking-widest whitespace-nowrap">
              {t('finance:receivables.columns.actions')}
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <Fragment key={group.period}>
              <tr
                key={`group-${group.period}`}
                className={
                  group.overdue
                    ? 'bg-warning-50/80 dark:bg-warning-950/20 border-y border-warning-200/70 dark:border-warning-900/40'
                    : 'bg-neutral-50/90 dark:bg-neutral-900/50 border-y border-neutral-200 dark:border-neutral-800'
                }
              >
                <td colSpan={showCollectedColumn ? 8 : 7} className="py-2.5 px-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <PeriodBadge period={group.period} t={t} />
                      <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                        {t('finance:receivables.group.documents', { count: group.documentCount })}
                      </span>
                    </div>
                    <span className="text-sm font-bold font-mono text-neutral-900 dark:text-neutral-100">
                      {t('finance:receivables.group.outstanding')}: {formatCurrency(group.totalOutstanding, 'TRY')}
                    </span>
                  </div>
                </td>
              </tr>

              {group.rows.map((row) => {
                const { documentTotal, collected, remaining } = getReceivableRowAmounts(row);
                const customerName = row.customers?.company_name ?? '—';
                const workDate = getReceivableWorkDate(row);

                return (
                  <tr
                    key={row.id}
                    className="border-b border-neutral-100 dark:border-neutral-800/60 hover:bg-neutral-50/80 dark:hover:bg-neutral-900/30 transition-colors"
                  >
                    <td className="py-3 px-4 font-medium text-neutral-900 dark:text-neutral-100 whitespace-nowrap max-w-[14rem] truncate">
                      {customerName}
                    </td>
                    <td className="py-3 px-4 text-neutral-700 dark:text-neutral-300 whitespace-nowrap tabular-nums">
                      {workDate ? formatDate(workDate) : '—'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <SourceCell row={row} />
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-neutral-800 dark:text-neutral-200 whitespace-nowrap">
                      {formatCurrency(documentTotal, 'TRY')}
                    </td>
                    {showCollectedColumn && (
                      <td className="py-3 px-4 text-right font-mono text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                        {collected > 0 ? formatCurrency(collected, 'TRY') : '—'}
                      </td>
                    )}
                    <td className="py-3 px-4 text-right font-mono font-bold text-neutral-900 dark:text-neutral-50 whitespace-nowrap">
                      {formatCurrency(remaining, 'TRY')}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <StatusBadge status={row.payment_status} />
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onAddPayment(row)}
                        className="gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {t('finance:receivables.addPayment.title')}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </Fragment>
          ))}
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </PageContainer>
  );
}

export function ReceivablesPage() {
  const { t } = useTranslation(['finance', 'common']);
  const { data: rows = [], isLoading } = useReceivables();

  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [search, setSearch] = useState('');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const periodOptions = useMemo(() => {
    const periods = [...new Set(rows.map((row) => row.period).filter(Boolean))].sort((a, b) => b.localeCompare(a));
    return [
      { value: 'all', label: t('finance:receivables.filters.allPeriods') },
      ...periods.map((period) => ({
        value: period,
        label: formatFinancePeriodLabel(period, t) ?? period,
      })),
    ];
  }, [rows, t]);

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: t('finance:receivables.filters.allStatuses') },
      { value: 'unpaid', label: t('finance:receivables.status.unpaid') },
      { value: 'partial', label: t('finance:receivables.status.partial') },
    ],
    [t]
  );

  const filteredRows = useMemo(
    () => filterReceivableRows(rows, { search, period: periodFilter, status: statusFilter }),
    [rows, search, periodFilter, statusFilter]
  );

  const summary = useMemo(() => summarizeReceivableRows(filteredRows), [filteredRows]);
  const groups = useMemo(() => groupRowsByPeriod(filteredRows, t), [filteredRows, t]);
  const showCollectedColumn = useMemo(
    () => filteredRows.some((row) => Number(row.total_collected) > 0),
    [filteredRows]
  );

  const hasActiveFilters = search || periodFilter !== 'all' || statusFilter !== 'all';

  if (isLoading) return <PageSkeleton />;

  return (
    <PageContainer maxWidth="full" padding="default" className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 text-primary-600 dark:text-primary-400 mb-2">
            <Landmark className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-widest">Finans</span>
          </div>
          <h1 className="text-2xl font-black text-neutral-900 dark:text-neutral-100">
            {t('finance:receivables.title')}
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {t('finance:receivables.subtitle')}
          </p>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ChannelKpiCard
            title={t('finance:receivables.kpi.totalOutstanding')}
            value={formatCurrency(summary.totalOutstanding, 'TRY')}
            variant="negative"
            emphasis
          />
          <ChannelKpiCard
            title={t('finance:receivables.kpi.documentCount')}
            value={String(summary.documentCount)}
            variant="neutral"
          />
          <ChannelKpiCard
            title={t('finance:receivables.kpi.overdueCount')}
            value={String(summary.overdueCount)}
            variant={summary.overdueCount > 0 ? 'negative' : 'positive'}
          />
        </div>
      )}

      {rows.length === RECEIVABLE_FETCH_LIMIT && (
        <div className="flex items-start gap-3 rounded-xl border border-warning-200 dark:border-warning-900/50 bg-warning-50/70 dark:bg-warning-950/20 px-4 py-3 text-sm text-warning-800 dark:text-warning-200">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>{t('finance:receivables.limitWarning', { limit: RECEIVABLE_FETCH_LIMIT })}</p>
        </div>
      )}

      {rows.length === 0 ? (
        <Card className="p-12">
          <EmptyState
            icon={CheckCircle2}
            title={t('finance:receivables.empty.title')}
            description={t('finance:receivables.empty.description')}
          />
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="border-b border-neutral-200 dark:border-neutral-800 p-4 space-y-3">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.8fr)] gap-3">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder={t('finance:receivables.filters.search')}
              />
              <Select
                label={t('finance:receivables.filters.period')}
                options={periodOptions}
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value)}
              />
              <Select
                label={t('finance:receivables.filters.status')}
                options={statusOptions}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              />
            </div>
          </div>

          {filteredRows.length === 0 ? (
            <div className="p-12">
              <EmptyState
                icon={Wallet}
                title={t('finance:receivables.noFilterResults.title')}
                description={t('finance:receivables.noFilterResults.description')}
              />
              {hasActiveFilters && (
                <div className="mt-4 flex justify-center">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setSearch('');
                      setPeriodFilter('all');
                      setStatusFilter('all');
                    }}
                  >
                    {t('finance:receivables.noFilterResults.clearFilters')}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <>
              <ReceivablesTable
                groups={groups}
                showCollectedColumn={showCollectedColumn}
                onAddPayment={setSelectedTransaction}
              />
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/40 px-4 py-3">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  {t('finance:receivables.footer.visibleDocuments', { count: summary.documentCount })}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                    {t('finance:receivables.footer.totalOutstanding')}:
                  </span>
                  <span className="text-lg font-black font-mono text-neutral-900 dark:text-neutral-50">
                    {formatCurrency(summary.totalOutstanding, 'TRY')}
                  </span>
                </div>
              </div>
            </>
          )}
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
