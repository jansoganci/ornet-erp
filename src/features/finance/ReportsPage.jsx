import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { FileText, Download, Filter, X } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/layout';
import { Button, Card, Select, ErrorState, EmptyState } from '../../components/ui';
import { useProfitAndLoss } from './hooks';
import { getLastNMonths } from './api';
import { ViewModeToggle } from './components/ViewModeToggle';
import { formatCurrency, formatDate } from '../../lib/utils';
import { getErrorMessage } from '../../lib/errorHandler';
import { toCSV, downloadCSV } from '../../lib/csvExport';
import { getSourceLabel } from './exportUtils';

function aggregatePL(plData) {
  let revenue = 0;
  let cogs = 0;
  let expenses = 0;
  for (const row of plData || []) {
    const amt = Number(row.amount_try) || 0;
    if (amt > 0) {
      revenue += amt;
      cogs += Number(row.cogs_try) || 0;
    } else {
      expenses += Math.abs(amt);
    }
  }
  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - expenses;
  return {
    revenue: Math.round(revenue * 100) / 100,
    cogs: Math.round(cogs * 100) / 100,
    grossProfit: Math.round(grossProfit * 100) / 100,
    expenses: Math.round(expenses * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
  };
}

export function ReportsPage() {
  const { t } = useTranslation(['finance', 'common']);
  const [searchParams, setSearchParams] = useSearchParams();
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const defaultPeriod = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const period = searchParams.get('period') || defaultPeriod;
  const viewMode = searchParams.get('viewMode') || 'total';

  const monthOptions = useMemo(() => getLastNMonths(6).map((v) => ({ value: v, label: v })), []);

  const handleFilterChange = (key, value) => {
    setSearchParams((prev) => {
      const isDefault = (k, v) =>
        (k === 'period' && v === defaultPeriod) ||
        (k === 'viewMode' && v === 'total');
      if (value && !isDefault(key, value)) prev.set(key, value);
      else prev.delete(key);
      return prev;
    });
  };

  // ── Mobile: active filter count ──
  const activeFilterCount = useMemo(() => {
    return [
      period !== defaultPeriod,
      viewMode !== 'total',
    ].filter(Boolean).length;
  }, [period, defaultPeriod, viewMode]);

  const { data: plData, isLoading, error, refetch } = useProfitAndLoss(period, viewMode);

  const pl = useMemo(() => aggregatePL(plData), [plData]);

  const hasData = pl.revenue > 0 || pl.expenses > 0;

  const handleExportCSV = () => {
    if (!plData?.length) return;
    const exportRows = plData.map((row) => ({
      period_date: formatDate(row.period_date),
      source_label: getSourceLabel(row.source_type, row.direction, t),
      direction_label: row.direction === 'income' ? t('finance:exportColumns.income') : t('finance:exportColumns.expense'),
      amount_try: row.amount_try != null && row.amount_try !== '' ? Number(row.amount_try) : '',
      original_currency: row.original_currency ?? 'TRY',
      output_vat: row.output_vat != null && row.output_vat !== '' ? Number(row.output_vat) : '',
      input_vat: row.input_vat != null && row.input_vat !== '' ? Number(row.input_vat) : '',
      cogs_try: row.cogs_try != null && row.cogs_try !== '' ? Number(row.cogs_try) : '',
    }));
    const columns = [
      { key: 'period_date', header: t('finance:exportColumns.date') },
      { key: 'source_label', header: t('finance:exportColumns.category') },
      { key: 'direction_label', header: t('finance:exportColumns.direction') },
      { key: 'amount_try', header: t('finance:exportColumns.amount') },
      { key: 'original_currency', header: t('finance:exportColumns.currency') },
      { key: 'output_vat', header: t('finance:exportColumns.outputVat') },
      { key: 'input_vat', header: t('finance:exportColumns.inputVat') },
      { key: 'cogs_try', header: t('finance:exportColumns.cogs') },
    ];
    const csv = toCSV(exportRows, columns);
    downloadCSV(csv, `${t('finance:export.plFilename')}_${period}.csv`);
  };

  const breadcrumbs = [
    { label: t('common:nav.dashboard'), to: '/' },
    { label: t('finance:dashboard.title'), to: '/finance' },
    { label: t('finance:reports.title') },
  ];

  // ══════════════════════════════════════════════════════════════════════════
  // LOADING STATE
  // ══════════════════════════════════════════════════════════════════════════

  if (isLoading) {
    return (
      <PageContainer maxWidth="full" padding="default" className="space-y-6">
        <PageHeader title={t('finance:reports.title')} />

        {/* Mobile loading — md:hidden */}
        <div className="md:hidden space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/10">
                <div className="h-3 w-14 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse mb-2" />
                <div className="h-6 w-20 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
              </div>
            ))}
          </div>
          <div className="bg-white dark:bg-[#1a1a1a] rounded-xl p-5 border border-neutral-200 dark:border-[#262626]/10 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex justify-between py-2">
                <div className="h-4 w-24 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
                <div className="h-4 w-16 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Desktop loading — hidden md:block */}
        <div className="hidden md:block space-y-6">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-xl p-6 border border-neutral-200 dark:border-[#262626]/10 max-w-md space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex justify-between py-2">
                <div className="h-4 w-28 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
                <div className="h-4 w-20 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </PageContainer>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ERROR STATE
  // ══════════════════════════════════════════════════════════════════════════

  if (error) {
    return (
      <PageContainer maxWidth="full" padding="default">
        <PageHeader title={t('finance:reports.title')} breadcrumbs={breadcrumbs} />
        <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
      </PageContainer>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <PageContainer maxWidth="full" padding="default" className="space-y-6">
      <PageHeader
        title={t('finance:reports.title')}
        breadcrumbs={breadcrumbs}
        actions={
          plData?.length > 0 && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="md"
                leftIcon={<Download className="w-4 h-4" />}
                onClick={handleExportCSV}
                className="hidden md:inline-flex"
              >
                {t('finance:export.csv')}
              </Button>
              <button
                type="button"
                onClick={handleExportCSV}
                className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 active:scale-95 transition-transform border border-neutral-200 dark:border-neutral-700"
                aria-label={t('finance:export.csv')}
              >
                <Download className="w-5 h-5" />
              </button>
            </div>
          )
        }
      />

      {/* ── Mobile KPI Strip — md:hidden ── */}
      {hasData && (
        <section className="grid grid-cols-2 gap-3 md:hidden">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/10">
            <p className="text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-neutral-500 dark:text-neutral-400 mb-1">
              {t('finance:reports.revenue')}
            </p>
            <p className="text-green-400 font-bold text-xl tracking-tight tabular-nums">
              {formatCurrency(pl.revenue)}
            </p>
          </div>
          <div className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/10">
            <p className="text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-neutral-500 dark:text-neutral-400 mb-1">
              {t('finance:reports.operatingExpenses')}
            </p>
            <p className="text-red-400 font-bold text-xl tracking-tight tabular-nums">
              {formatCurrency(pl.expenses)}
            </p>
          </div>
          <div className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/10">
            <p className="text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-neutral-500 dark:text-neutral-400 mb-1">
              {t('finance:reports.grossProfit')}
            </p>
            <p className="text-neutral-900 dark:text-neutral-50 font-bold text-xl tracking-tight tabular-nums">
              {formatCurrency(pl.grossProfit)}
            </p>
          </div>
          <div className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/10">
            <p className="text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-neutral-500 dark:text-neutral-400 mb-1">
              {t('finance:reports.netProfit')}
            </p>
            <p className={`font-bold text-xl tracking-tight tabular-nums ${pl.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(pl.netProfit)}
            </p>
          </div>
        </section>
      )}

      {/* ── Mobile Filter Row — md:hidden ── */}
      <section className="flex items-center gap-3 overflow-x-auto pb-1 md:hidden">
        <button
          type="button"
          onClick={() => setShowMobileFilters((v) => !v)}
          className="flex items-center gap-2 bg-neutral-100 dark:bg-[#201f1f] px-4 py-2 rounded-full border border-neutral-200 dark:border-[#494847]/20 active:scale-95 transition-transform shrink-0"
        >
          <Filter className="w-4 h-4 text-primary-600 dark:text-primary-400" />
          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-50">
            {t('finance:mobile.filterButton')}
          </span>
          {activeFilterCount > 0 && (
            <span className="bg-primary-600 text-white text-[0.625rem] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
        <div className="flex items-center gap-2 bg-primary-50 dark:bg-primary-600/10 text-primary-700 dark:text-primary-400 px-4 py-2 rounded-full border border-primary-200 dark:border-primary-600/20 shrink-0">
          <span className="text-sm font-medium">
            {period === defaultPeriod ? t('finance:mobile.thisMonth') : period}
          </span>
          {period !== defaultPeriod && (
            <button
              type="button"
              onClick={() => handleFilterChange('period', defaultPeriod)}
              className="hover:text-primary-500 dark:hover:text-primary-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </section>

      {/* ── Mobile Collapsible Filter Panel — md:hidden ── */}
      {showMobileFilters && (
        <section className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/20 space-y-4 md:hidden">
          <Select label={t('finance:filters.period')} options={monthOptions} value={period} onChange={(e) => handleFilterChange('period', e.target.value)} />
          <ViewModeToggle value={viewMode} onChange={(v) => handleFilterChange('viewMode', v)} size="md" />
        </section>
      )}

      {/* ── Desktop Filter Card — hidden md:block ── */}
      <Card className="hidden md:block p-4 border-neutral-200/60 dark:border-neutral-800/60">
        <div className="flex flex-col md:flex-row gap-4 flex-wrap items-end">
          <div className="w-full md:w-40">
            <Select
              label={t('finance:filters.period')}
              options={monthOptions}
              value={period}
              onChange={(e) => handleFilterChange('period', e.target.value)}
            />
          </div>
          <div className="flex items-end gap-2">
            <ViewModeToggle value={viewMode} onChange={(v) => handleFilterChange('viewMode', v)} size="md" />
            {plData?.length > 0 && (
              <Button
                variant="outline"
                size="md"
                leftIcon={<Download className="w-4 h-4" />}
                onClick={handleExportCSV}
              >
                {t('finance:export.csv')}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {!hasData ? (
        <EmptyState
          icon={FileText}
          title={t('finance:reports.empty')}
          description={t('finance:reports.emptyDescription')}
        />
      ) : (
        <>
          {/* ── Mobile P&L Card — md:hidden ── */}
          <section className="md:hidden">
            <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-neutral-200 dark:border-[#262626]/10 overflow-hidden">
              <div className="p-4 space-y-1">
                {/* Revenue */}
                <div className="flex justify-between items-center py-3 border-b border-neutral-100 dark:border-[#262626]">
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    {t('finance:reports.revenue')}
                  </span>
                  <span className="text-sm font-bold text-green-500 dark:text-green-400 tabular-nums">
                    {formatCurrency(pl.revenue)}
                  </span>
                </div>

                {/* COGS */}
                <div className="flex justify-between items-center py-3 border-b border-neutral-100 dark:border-[#262626]">
                  <span className="text-sm text-neutral-500 dark:text-neutral-400 pl-3">
                    - {t('finance:reports.cogs')}
                  </span>
                  <span className="text-sm text-neutral-500 dark:text-neutral-400 tabular-nums">
                    {formatCurrency(pl.cogs)}
                  </span>
                </div>

                {/* Gross Profit */}
                <div className="flex justify-between items-center py-3 border-b border-neutral-100 dark:border-[#262626]">
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    = {t('finance:reports.grossProfit')}
                  </span>
                  <span className="text-sm font-bold text-neutral-900 dark:text-neutral-50 tabular-nums">
                    {formatCurrency(pl.grossProfit)}
                  </span>
                </div>

                {/* Operating Expenses */}
                <div className="flex justify-between items-center py-3 border-b border-neutral-100 dark:border-[#262626]">
                  <span className="text-sm text-neutral-500 dark:text-neutral-400 pl-3">
                    - {t('finance:reports.operatingExpenses')}
                  </span>
                  <span className="text-sm text-red-400 tabular-nums">
                    {formatCurrency(pl.expenses)}
                  </span>
                </div>

                {/* Net Profit */}
                <div className="flex justify-between items-center py-4">
                  <span className="text-base font-bold text-neutral-900 dark:text-neutral-50">
                    = {t('finance:reports.netProfit')}
                  </span>
                  <span
                    className={`text-lg font-bold tabular-nums ${
                      pl.netProfit >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'
                    }`}
                  >
                    {formatCurrency(pl.netProfit)}
                  </span>
                </div>
              </div>

              {/* Margin bar */}
              {pl.revenue > 0 && (
                <div className="px-4 pb-4">
                  <div className="h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pl.netProfit >= 0 ? 'bg-green-400' : 'bg-red-400'}`}
                      style={{ width: `${Math.min(Math.max((pl.netProfit / pl.revenue) * 100, 0), 100)}%` }}
                    />
                  </div>
                  <p className="text-[0.625rem] text-neutral-400 dark:text-neutral-500 mt-1 text-right">
                    {pl.revenue > 0 ? `${((pl.netProfit / pl.revenue) * 100).toFixed(1)}%` : '0%'}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* ── Desktop P&L Card — hidden md:block ── */}
          <Card className="hidden md:block p-6 overflow-hidden">
            <div className="space-y-4 max-w-md">
              <div className="flex justify-between items-center py-2 border-b border-neutral-200 dark:border-[#262626]">
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  {t('finance:reports.revenue')}
                </span>
                <span className="text-sm font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
                  {formatCurrency(pl.revenue)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-neutral-200 dark:border-[#262626]">
                <span className="text-sm text-neutral-600 dark:text-neutral-400 pl-4">
                  - {t('finance:reports.cogs')}
                </span>
                <span className="text-sm tabular-nums text-neutral-600 dark:text-neutral-400">
                  {formatCurrency(pl.cogs)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-neutral-200 dark:border-[#262626]">
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  = {t('finance:reports.grossProfit')}
                </span>
                <span className="text-sm font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
                  {formatCurrency(pl.grossProfit)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-neutral-200 dark:border-[#262626]">
                <span className="text-sm text-neutral-600 dark:text-neutral-400 pl-4">
                  - {t('finance:reports.operatingExpenses')}
                </span>
                <span className="text-sm tabular-nums text-neutral-600 dark:text-neutral-400">
                  {formatCurrency(pl.expenses)}
                </span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-base font-bold text-neutral-900 dark:text-neutral-50">
                  = {t('finance:reports.netProfit')}
                </span>
                <span
                  className={`text-base font-bold tabular-nums ${
                    pl.netProfit >= 0
                      ? 'text-success-600 dark:text-success-400'
                      : 'text-error-600 dark:text-error-400'
                  }`}
                >
                  {formatCurrency(pl.netProfit)}
                </span>
              </div>
            </div>
          </Card>
        </>
      )}
    </PageContainer>
  );
}
