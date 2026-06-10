import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, Filter } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/layout';
import {
  Button,
  ListboxSelect,
  Input,
  SearchInput,
  Spinner,
  EmptyState,
  Card,
  Badge,
  Table,
  ErrorState,
  TableSkeleton,
  Modal,
  IconButton,
} from '../../components/ui';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useSearchWorkHistory } from './hooks';
import { useProfiles } from '../tasks/hooks';
import { formatDate } from '../../lib/utils';
import { WORK_TYPES } from '../workOrders/schema';
import { subDays, format } from 'date-fns';

const DATE_PRESETS = ['all', '7', '30', '90', 'custom'];

function getDateRangeFromPreset(preset) {
  if (!preset || preset === 'all') return { dateFrom: '', dateTo: '' };
  if (preset === 'custom') return { dateFrom: '', dateTo: '' };
  const days = parseInt(preset, 10);
  if (isNaN(days)) return { dateFrom: '', dateTo: '' };
  const today = format(new Date(), 'yyyy-MM-dd');
  const from = format(subDays(new Date(), days), 'yyyy-MM-dd');
  return { dateFrom: from, dateTo: today };
}

export function WorkHistoryPage() {
  const { t } = useTranslation(['workHistory', 'common', 'workOrders']);
  const { t: tCommon } = useTranslation('common');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [localSearch, setLocalSearch] = useState(searchParams.get('search') || '');
  const debouncedSearch = useDebouncedValue(localSearch, 300);
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    datePreset: searchParams.get('datePreset') || 'all',
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
    workType: searchParams.get('workType') || 'all',
    workerId: searchParams.get('workerId') || 'all',
    siteId: searchParams.get('siteId') || '',
  });

  // Sync filters from URL — setState in effect is intentional
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const siteId = searchParams.get('siteId');
    if (siteId) {
      setFilters((prev) => ({ ...prev, siteId }));
    }
  }, [searchParams]);

  const resolvedDateRange =
    filters.datePreset && filters.datePreset !== 'all' && filters.datePreset !== 'custom'
      ? getDateRangeFromPreset(filters.datePreset)
      : { dateFrom: filters.dateFrom, dateTo: filters.dateTo };

  const shouldRunSearch =
    (debouncedSearch || '').trim().length >= 2 ||
    Boolean(filters.siteId) ||
    Boolean(resolvedDateRange.dateFrom) ||
    Boolean(resolvedDateRange.dateTo) ||
    (filters.workType && filters.workType !== 'all') ||
    (filters.workerId && filters.workerId !== 'all');

  const { data: results = [], isLoading, error, refetch } = useSearchWorkHistory(
    {
      ...filters,
      search: debouncedSearch,
      ...resolvedDateRange,
      limit: 200,
      offset: 0,
    },
    shouldRunSearch
  );
  const { data: profiles = [] } = useProfiles();

  const handleFilterChange = (key, value) => {
    if (key === 'search') {
      setLocalSearch(value ?? '');
      return;
    }
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'datePreset' && value !== 'custom' && value !== 'all') {
        const range = getDateRangeFromPreset(value);
        next.dateFrom = range.dateFrom;
        next.dateTo = range.dateTo;
      }
      return next;
    });
  };

  const handleReset = () => {
    setLocalSearch('');
    setFilters((prev) => ({
      search: '',
      datePreset: 'all',
      dateFrom: '',
      dateTo: '',
      workType: 'all',
      workerId: 'all',
      siteId: prev.siteId,
    }));
  };

  const workTypeOptions = [
    { value: 'all', label: t('workHistory:filters.allTypes') },
    ...WORK_TYPES.map((type) => ({ value: type, label: tCommon(`workType.${type}`) })),
  ];

  const workerOptions = [
    { value: 'all', label: t('workHistory:filters.allWorkers') },
    ...profiles.map((p) => ({ value: p.id, label: p.full_name })),
  ];

  const datePresetOptions = DATE_PRESETS.map((p) => ({
    value: p,
    label: t(`workHistory:filters.datePresets.${p}`),
  }));

  const [filterOpen, setFilterOpen] = useState(false);
  const activeFilterCount = [
    filters.datePreset !== 'all' && filters.datePreset !== 'custom',
    filters.workType !== 'all',
    filters.workerId !== 'all',
    filters.datePreset === 'custom' && (filters.dateFrom || filters.dateTo),
  ].filter(Boolean).length;

  const columns = [
    {
      header: t('workHistory:results.columns.customer'),
      accessor: 'company_name',
      render: (val, row) => (
        <div className="min-w-[150px]">
          <p className="font-bold text-neutral-900 dark:text-neutral-100 truncate">{val}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
            {row.site_name || row.site_address}
          </p>
        </div>
      ),
    },
    {
      header: t('workHistory:results.columns.accountNo'),
      accessor: 'account_no',
      render: (val) => <Badge variant="info" className="font-mono">{val || '---'}</Badge>,
    },
    {
      header: t('workHistory:results.columns.workType'),
      accessor: 'work_type',
      render: (val, row) => (
        <div className="space-y-1">
          <Badge variant="default" size="sm">{tCommon(`workType.${val}`)}</Badge>
          {row.form_no && <p className="text-[10px] font-mono text-neutral-400">#{row.form_no}</p>}
        </div>
      ),
    },
    {
      header: t('workHistory:results.columns.date'),
      accessor: 'scheduled_date',
      render: (val) => (val ? formatDate(val) : '---'),
    },
    {
      header: t('workHistory:results.columns.workers'),
      accessor: 'assigned_workers',
      render: (workers) => (
        <div className="flex -space-x-2 overflow-hidden">
          {workers?.map((w, idx) => (
            <div
              key={w?.id ?? idx}
              className="inline-flex h-7 w-7 rounded-full ring-2 ring-white dark:ring-[#171717] bg-primary-100 dark:bg-primary-900/40 items-center justify-center shrink-0"
              title={w.name}
            >
              <span className="text-[10px] font-bold text-primary-700 dark:text-primary-300 uppercase leading-none tracking-normal">
                {(w.name ?? '?').charAt(0)}
              </span>
            </div>
          ))}
        </div>
      ),
    },
  ];

  return (
    <PageContainer maxWidth="full" padding="default" className="space-y-6">
      {/* Desktop: PageHeader */}
      <div className="hidden lg:block">
        <PageHeader
          title={t('workHistory:title')}
          description={t('workHistory:subtitle')}
          breadcrumbs={[
            { label: t('common:nav.dashboard'), to: '/' },
            { label: t('workHistory:title') },
          ]}
        />
      </div>

      {/* Mobile only: header with Search + Filter */}
      <div className="lg:hidden space-y-3">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-lg font-bold text-neutral-900 dark:text-neutral-50 truncate">
              {t('workHistory:title')}
            </h1>
          </div>
          <SearchInput
            placeholder={t('workHistory:search.placeholder')}
            value={localSearch}
            onChange={(v) => handleFilterChange('search', v)}
            className="min-w-0 flex-1 max-w-[140px]"
            size="sm"
          />
          <div className="relative shrink-0">
            <IconButton
              icon={Filter}
              variant="secondary"
              size="md"
              aria-label={t('common:filters.title')}
              onClick={() => setFilterOpen(true)}
              className="border border-neutral-200 dark:border-[#262626] rounded-lg"
            />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-600 text-[10px] font-bold text-white px-1">
                {activeFilterCount}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Filters - desktop only */}
      <Card className="hidden lg:block p-4 border-neutral-200/60 dark:border-neutral-800/60">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <SearchInput
                placeholder={t('workHistory:search.placeholder')}
                value={localSearch}
                onChange={(v) => handleFilterChange('search', v)}
                className="w-full"
              />
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <ListboxSelect
                options={datePresetOptions}
                value={filters.datePreset}
                onChange={(v) => handleFilterChange('datePreset', v)}
                placeholder={t('workHistory:filters.dateRange')}
                size="sm"
                className="w-full md:w-40"
              />
              <ListboxSelect
                options={workTypeOptions}
                value={filters.workType}
                onChange={(v) => handleFilterChange('workType', v)}
                placeholder={t('workHistory:filters.workType')}
                size="sm"
                className="w-full md:w-44"
              />
              <ListboxSelect
                options={workerOptions}
                value={filters.workerId}
                onChange={(v) => handleFilterChange('workerId', v)}
                placeholder={t('workHistory:filters.worker')}
                size="sm"
                className="w-full md:w-44"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="text-neutral-400 hover:text-primary-600 shrink-0"
              >
                {t('common:actions.reset')}
              </Button>
            </div>
          </div>
          {filters.datePreset === 'custom' && (
            <div className="flex flex-wrap gap-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <Input
                type="date"
                label={t('workHistory:filters.from')}
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                className="max-w-[180px]"
              />
              <Input
                type="date"
                label={t('workHistory:filters.to')}
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                className="max-w-[180px]"
              />
            </div>
          )}
        </div>
      </Card>

      {/* Filter Modal - mobile only */}
      <Modal
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        title={t('common:filters.title')}
        size="sm"
        footer={
          <div className="flex justify-between w-full">
            <Button variant="ghost" size="sm" onClick={() => { handleReset(); setFilterOpen(false); }}>
              {t('common:filters.clear')}
            </Button>
            <Button variant="primary" size="sm" onClick={() => setFilterOpen(false)}>
              {t('common:actions.done')}
            </Button>
          </div>
        }
      >
        <div className="grid gap-4 py-2">
          <ListboxSelect
            options={datePresetOptions}
            value={filters.datePreset}
            onChange={(v) => handleFilterChange('datePreset', v)}
            placeholder={t('workHistory:filters.dateRange')}
            size="sm"
          />
          <ListboxSelect
            options={workTypeOptions}
            value={filters.workType}
            onChange={(v) => handleFilterChange('workType', v)}
            placeholder={t('workHistory:filters.workType')}
            size="sm"
          />
          <ListboxSelect
            options={workerOptions}
            value={filters.workerId}
            onChange={(v) => handleFilterChange('workerId', v)}
            placeholder={t('workHistory:filters.worker')}
            size="sm"
          />
          {filters.datePreset === 'custom' && (
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <Input
                type="date"
                label={t('workHistory:filters.from')}
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              />
              <Input
                type="date"
                label={t('workHistory:filters.to')}
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              />
            </div>
          )}
        </div>
      </Modal>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">
            {t('workHistory:results.title')}
          </h3>
          {results.length > 0 && (
            <Badge variant="secondary">{t('workHistory:results.count', { count: results.length })}</Badge>
          )}
        </div>

        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-4">
            <Spinner size="lg" />
            <p className="text-sm text-neutral-500 animate-pulse">{t('common:loading')}</p>
          </div>
        ) : error ? (
          <ErrorState message={error.message} onRetry={() => refetch()} />
        ) : results.length === 0 ? (
          <EmptyState
            icon={Search}
            title={t('workHistory:results.noResults')}
            description={debouncedSearch ? t('common:noResults') : t('workHistory:subtitle')}
          />
        ) : (
          <Table
            columns={columns}
            data={results}
            onRowClick={(row) => navigate(`/work-orders/${row.id}`)}
          />
        )}
      </div>
    </PageContainer>
  );
}
