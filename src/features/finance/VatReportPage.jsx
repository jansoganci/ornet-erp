import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Percent } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/layout';
import { Card, Select, Table, EmptyState, Spinner, ErrorState } from '../../components/ui';
import { useVatReport } from './hooks';
import { ViewModeToggle } from './components/ViewModeToggle';
import { formatCurrency } from '../../lib/utils';

function getLast12Months() {
  const months = [];
  const d = new Date();
  for (let i = 0; i < 12; i++) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    months.push({ value: `${y}-${m}`, label: `${y}-${m}` });
    d.setMonth(d.getMonth() - 1);
  }
  return months;
}

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

  const defaultMonth = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  const defaultQuarter = useMemo(() => getLast4Quarters()[0]?.value, []);

  const periodType = searchParams.get('periodType') || 'month';
  const period = searchParams.get('period') || (periodType === 'month' ? defaultMonth : defaultQuarter);
  const viewMode = searchParams.get('viewMode') || 'total';

  const monthOptions = useMemo(() => getLast12Months(), []);
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
    return rows.reduce(
      (acc, r) => ({
        output_vat: acc.output_vat + (r.output_vat || 0),
        input_vat: acc.input_vat + (r.input_vat || 0),
        net_vat: acc.net_vat + (r.net_vat || 0),
      }),
      { output_vat: 0, input_vat: 0, net_vat: 0 }
    );
  }, [rows]);

  const periodTypeOptions = [
    { value: 'month', label: t('finance:vatReport.month') },
    { value: 'quarter', label: t('finance:vatReport.quarter') },
  ];

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

  if (isLoading) {
    return (
      <PageContainer maxWidth="xl" padding="default">
        <PageHeader title={t('finance:vatReport.title')} breadcrumbs={breadcrumbs} />
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer maxWidth="xl" padding="default">
        <PageHeader title={t('finance:vatReport.title')} breadcrumbs={breadcrumbs} />
        <ErrorState message={error.message} onRetry={refetch} />
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="xl" padding="default" className="space-y-6">
      <PageHeader title={t('finance:vatReport.title')} breadcrumbs={breadcrumbs} />

      <Card className="p-4 border-neutral-200/60 dark:border-neutral-800/60">
        <div className="flex flex-col md:flex-row gap-4 flex-wrap">
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
          <div className="flex items-end">
            <ViewModeToggle value={viewMode} onChange={(v) => handleFilterChange('viewMode', v)} size="md" />
          </div>
        </div>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          icon={Percent}
          title={t('finance:vatReport.empty')}
          description={t('finance:vatReport.empty')}
        />
      ) : (
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
      )}
    </PageContainer>
  );
}
