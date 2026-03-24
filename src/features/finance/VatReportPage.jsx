import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Percent, Download, Filter, X } from 'lucide-react';
import { useState } from 'react';
import { PageContainer, PageHeader } from '../../components/layout';
import { Button, Card, Select, Table, EmptyState, ErrorState } from '../../components/ui';
import { useVatReport } from './hooks';
import { getLastNMonths } from './api';
import { ViewModeToggle } from './components/ViewModeToggle';
import { formatCurrency } from '../../lib/utils';
import { getErrorMessage } from '../../lib/errorHandler';
import { toCSV, downloadCSV } from '../../lib/csvExport';

function getLast4Quarters() {
  const quarters = [];
  const d = new Date();
  const year = d.getFullYear();
  const currentQuarter = Math.ceil((d.getMonth() + 1) / 3);
  for (let i = 0; i < 4; i++) {
    let q = currentQuarter - i;
    let y = year;
    if (q < 1) {
      q += 4;
      y -= 1;
    }
    quarters.push({
      value: `${y}-Q${q}`,
      label: `${y} Q${q}`,
    });
  }
  return quarters;
}

export function VatReportPage() {
  const { t } = useTranslation(['finance', 'common']);
  const [searchParams, setSearchParams] = useSearchParams();
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const defaultMonth = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  const defaultQuarter = useMemo(() => getLast4Quarters()[0]?.value, []);

  const periodType = searchParams.get('periodType') || 'month';
  const period = searchParams.get('period') || (periodType === 'month' ? defaultMonth : defaultQuarter);
  const viewMode = searchParams.get('viewMode') || 'total';

  const monthOptions = useMemo(() => getLastNMonths(12).map((v) => ({ value: v, label: v })), []);
  const quarterOptions = useMemo(() => getLast4Quarters(), []);

  const periodOptions = periodType === 'month' ? monthOptions : quarterOptions;
  const effectivePeriod = periodType === 'month' ? period : (periodOptions.some((o) => o.value === period) ? period : periodOptions[0]?.value);

  const handleFilterChange = (key, value) => {
    setSearchParams((prev) => {
      if (value) prev.set(key, value);
      else prev.delete(key);
      return prev;
    });
  };

  const handlePeriodTypeChange = (value) => {
    setSearchParams((prev) => {
      prev.set('periodType', value);
      if (value === 'month') {
        prev.set('period', defaultMonth);
      } else {
        prev.set('period', quarterOptions[0]?.value || '');
      }
      return prev;
    });
  };

  const { data: rows = [], isLoading, error, refetch } = useVatReport({
    period: effectivePeriod,
    viewMode,
    periodType,
  });

  const totals = useMemo(() => {
    if (rows.length <= 1) return null;
    const sums = rows.reduce(
      (acc, r) => ({
        output_vat: acc.output_vat + (r.output_vat || 0),
        input_vat: acc.input_vat + (r.input_vat || 0),
      }),
      { output_vat: 0, input_vat: 0 }
    );
    return {
      output_vat: sums.output_vat,
      input_vat: sums.input_vat,
      net_vat: sums.output_vat - sums.input_vat,
    };
  }, [rows]);

  // ── Mobile: single-row totals (when only 1 row, use that row's data) ──
  const displayTotals = useMemo(() => {
    if (totals) return totals;
    if (rows.length === 1) {
      return {
        output_vat: rows[0].output_vat || 0,
        input_vat: rows[0].input_vat || 0,
        net_vat: rows[0].net_vat || 0,
      };
    }
    return { output_vat: 0, input_vat: 0, net_vat: 0 };
  }, [totals, rows]);

  // ── Mobile: active filter count ──
  const activeFilterCount = useMemo(() => {
    const defaultPeriod = periodType === 'month' ? defaultMonth : defaultQuarter;
    return [
      periodType !== 'month',
      period !== defaultPeriod,
      viewMode !== 'total',
    ].filter(Boolean).length;
  }, [periodType, period, viewMode, defaultMonth, defaultQuarter]);

  const periodTypeOptions = [
    { value: 'month', label: t('finance:vatReport.month') },
    { value: 'quarter', label: t('finance:vatReport.quarter') },
  ];

  const handleExportCSV = () => {
    if (rows.length === 0) return;
    const exportRows = rows.map((r) => ({
      period: r.period,
      output_vat: r.output_vat ?? '',
      input_vat: r.input_vat ?? '',
      net_vat: r.net_vat ?? '',
    }));
    if (totals) {
      exportRows.push({
        period: t('finance:vatReport.total'),
        output_vat: totals.output_vat,
        input_vat: totals.input_vat,
        net_vat: totals.net_vat,
      });
    }
    const columns = [
      { key: 'period', header: t('finance:exportColumns.period') },
      { key: 'output_vat', header: t('finance:exportColumns.outputVat') },
      { key: 'input_vat', header: t('finance:exportColumns.inputVat') },
      { key: 'net_vat', header: t('finance:exportColumns.netVat') },
    ];
    const csv = toCSV(exportRows, columns);
    downloadCSV(csv, `${t('finance:export.vatFilename')}_${effectivePeriod || period}.csv`);
  };

  const columns = [
    {
      header: t('finance:filters.period'),
      accessor: 'period',
      render: (val) => val,
    },
    {
      header: t('finance:vatReport.outputVat'),
      accessor: 'output_vat',
      align: 'right',
      render: (val) => formatCurrency(val ?? 0),
    },
    {
      header: t('finance:vatReport.inputVat'),
      accessor: 'input_vat',
      align: 'right',
      render: (val) => formatCurrency(val ?? 0),
    },
    {
      header: t('finance:vatReport.netVat'),
      accessor: 'net_vat',
      align: 'right',
      render: (val) => (
        <span className={val >= 0 ? 'text-neutral-900 dark:text-neutral-50' : 'text-error-600'}>
          {formatCurrency(val ?? 0)}
        </span>
      ),
    },
  ];

  const breadcrumbs = [
    { label: t('common:nav.dashboard'), to: '/' },
    { label: t('finance:dashboard.title'), to: '/finance' },
    { label: t('finance:vatReport.title') },
  ];

  // ══════════════════════════════════════════════════════════════════════════
  // LOADING STATE
  // ══════════════════════════════════════════════════════════════════════════

  if (isLoading) {
    return (
      <PageContainer maxWidth="full" padding="default" className="space-y-6">
        <PageHeader title={t('finance:vatReport.title')} />

        {/* Mobile loading — md:hidden */}
        <div className="md:hidden space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/10">
                <div className="h-3 w-12 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse mb-2" />
                <div className="h-6 w-16 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
              </div>
            ))}
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/5">
              <div className="h-4 w-20 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse mb-3" />
              <div className="grid grid-cols-3 gap-2">
                <div className="h-4 w-14 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
                <div className="h-4 w-14 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
                <div className="h-4 w-14 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
              </div>
            </div>
          ))}
        </div>

        {/* Desktop loading — hidden md:block */}
        <div className="hidden md:flex justify-center py-12">
          <div className="h-8 w-8 rounded-full border-2 border-primary-600 border-t-transparent animate-spin" />
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
        <PageHeader title={t('finance:vatReport.title')} breadcrumbs={breadcrumbs} />
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
        title={t('finance:vatReport.title')}
        breadcrumbs={breadcrumbs}
        actions={
          rows.length > 0 && (
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
      {rows.length > 0 && (
        <section className="grid grid-cols-3 gap-3 md:hidden">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/10">
            <p className="text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-neutral-500 dark:text-neutral-400 mb-1">
              {t('finance:vatReport.outputVat')}
            </p>
            <p className="text-neutral-900 dark:text-neutral-50 font-bold text-lg tracking-tight tabular-nums">
              {formatCurrency(displayTotals.output_vat)}
            </p>
          </div>
          <div className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/10">
            <p className="text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-neutral-500 dark:text-neutral-400 mb-1">
              {t('finance:vatReport.inputVat')}
            </p>
            <p className="text-neutral-900 dark:text-neutral-50 font-bold text-lg tracking-tight tabular-nums">
              {formatCurrency(displayTotals.input_vat)}
            </p>
          </div>
          <div className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/10">
            <p className="text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-neutral-500 dark:text-neutral-400 mb-1">
              {t('finance:vatReport.netVat')}
            </p>
            <p className={`font-bold text-lg tracking-tight tabular-nums ${displayTotals.net_vat >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(displayTotals.net_vat)}
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
            {periodType === 'month'
              ? (period === defaultMonth ? t('finance:mobile.thisMonth') : period)
              : period}
          </span>
        </div>
        <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800 px-3 py-2 rounded-full border border-neutral-200 dark:border-neutral-700 shrink-0">
          <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
            {periodType === 'month' ? t('finance:vatReport.month') : t('finance:vatReport.quarter')}
          </span>
        </div>
      </section>

      {/* ── Mobile Collapsible Filter Panel — md:hidden ── */}
      {showMobileFilters && (
        <section className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/20 space-y-4 md:hidden">
          <Select label={t('finance:vatReport.periodType')} options={periodTypeOptions} value={periodType} onChange={(e) => handlePeriodTypeChange(e.target.value)} />
          <Select label={t('finance:filters.period')} options={periodOptions} value={effectivePeriod || periodOptions[0]?.value} onChange={(e) => handleFilterChange('period', e.target.value)} />
          <ViewModeToggle value={viewMode} onChange={(v) => handleFilterChange('viewMode', v)} size="md" />
        </section>
      )}

      {/* ── Desktop Filter Card — hidden md:block ── */}
      <Card className="hidden md:block p-4 border-neutral-200/60 dark:border-neutral-800/60">
        <div className="flex flex-col md:flex-row gap-4 flex-wrap items-end">
          <div className="w-full md:w-40">
            <Select
              label={t('finance:vatReport.periodType')}
              options={periodTypeOptions}
              value={periodType}
              onChange={(e) => handlePeriodTypeChange(e.target.value)}
            />
          </div>
          <div className="w-full md:w-40">
            <Select
              label={t('finance:filters.period')}
              options={periodOptions}
              value={effectivePeriod || periodOptions[0]?.value}
              onChange={(e) => handleFilterChange('period', e.target.value)}
            />
          </div>
          <div className="flex items-end gap-2">
            <ViewModeToggle value={viewMode} onChange={(v) => handleFilterChange('viewMode', v)} size="md" />
            {rows.length > 0 && (
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

      {rows.length === 0 ? (
        <EmptyState
          icon={Percent}
          title={t('finance:vatReport.empty')}
          description={t('finance:vatReport.emptyDescription')}
        />
      ) : (
        <>
          {/* ── Mobile VAT Cards — md:hidden ── */}
          <section className="space-y-3 md:hidden">
            {rows.map((row) => (
              <div
                key={row.period}
                className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/5"
              >
                <p className="text-sm font-bold text-neutral-900 dark:text-neutral-50 mb-3">
                  {row.period}
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-[0.625rem] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-0.5">
                      {t('finance:vatReport.outputVat')}
                    </p>
                    <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 tabular-nums">
                      {formatCurrency(row.output_vat ?? 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[0.625rem] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-0.5">
                      {t('finance:vatReport.inputVat')}
                    </p>
                    <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 tabular-nums">
                      {formatCurrency(row.input_vat ?? 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[0.625rem] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-0.5">
                      {t('finance:vatReport.netVat')}
                    </p>
                    <p className={`text-sm font-semibold tabular-nums ${(row.net_vat ?? 0) >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                      {formatCurrency(row.net_vat ?? 0)}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {/* Mobile summary card */}
            {totals && (
              <div className="bg-neutral-50 dark:bg-neutral-900/50 rounded-xl p-4 border-2 border-neutral-300 dark:border-neutral-700">
                <p className="text-sm font-bold text-neutral-900 dark:text-neutral-50 mb-3">
                  {t('finance:vatReport.total')}
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-[0.625rem] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-0.5">
                      {t('finance:vatReport.outputVat')}
                    </p>
                    <p className="text-sm font-bold text-neutral-900 dark:text-neutral-50 tabular-nums">
                      {formatCurrency(totals.output_vat)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[0.625rem] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-0.5">
                      {t('finance:vatReport.inputVat')}
                    </p>
                    <p className="text-sm font-bold text-neutral-900 dark:text-neutral-50 tabular-nums">
                      {formatCurrency(totals.input_vat)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[0.625rem] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-0.5">
                      {t('finance:vatReport.netVat')}
                    </p>
                    <p className={`text-sm font-bold tabular-nums ${totals.net_vat >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                      {formatCurrency(totals.net_vat)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* ── Desktop Table — hidden md:block ── */}
          <div className="hidden md:block">
            <div className="bg-white dark:bg-[#171717] rounded-2xl border border-neutral-200 dark:border-[#262626] overflow-hidden shadow-sm">
              <Table
                columns={columns}
                data={rows}
                keyExtractor={(row) => row.period}
              />
              {totals && (
                <div className="border-t border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-neutral-900/50 px-4 py-3 grid grid-cols-4 gap-4 text-sm font-bold">
                  <span className="text-neutral-600 dark:text-neutral-400">{t('finance:vatReport.total')}</span>
                  <span className="text-right">{formatCurrency(totals.output_vat)}</span>
                  <span className="text-right">{formatCurrency(totals.input_vat)}</span>
                  <span className={`text-right ${totals.net_vat >= 0 ? '' : 'text-error-600'}`}>
                    {formatCurrency(totals.net_vat)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </PageContainer>
  );
}
