import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ClipboardList,
  Filter,
  Calendar,
  Building2,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  ListFilter,
  FolderOpen,
  Wrench,
  CircleCheck,
} from 'lucide-react';
import { PageContainer } from '../../components/layout';
import {
  Button,
  SearchInput,
  ListboxSelect,
  Table,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  TableSkeleton,
  KpiCard,
  Modal,
  IconButton,
} from '../../components/ui';
import {
  formatDate,
  formatCurrency,
  workOrderStatusVariant,
  priorityVariant,
  cn,
} from '../../lib/utils';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useWorkOrdersPaginated } from './hooks';
import { WORK_TYPES } from './schema';

const WO_TAB_DEFINITIONS = [
  { key: 'active', labelKey: 'list.tabs.active', statusGroup: 'active' },
  { key: 'archive', labelKey: 'list.tabs.archive', statusGroup: 'archive' },
];

export function WorkOrdersListPage() {
  const { t } = useTranslation(['workOrders', 'common']);
  const { t: tCommon } = useTranslation('common');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchFromUrl = searchParams.get('search') || '';
  const [localSearch, setLocalSearch] = useState(searchFromUrl);
  const debouncedSearch = useDebouncedValue(localSearch, 300);

  // Sync local search from URL
  useEffect(() => {
    setLocalSearch(searchFromUrl);
  }, [searchFromUrl]);
  // Sync debounced search to URL — reset page on new search
  useEffect(() => {
    if (searchFromUrl === debouncedSearch) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (debouncedSearch) next.set('search', debouncedSearch);
      else next.delete('search');
      next.delete('page');
      return next;
    });
  }, [debouncedSearch, searchFromUrl, setSearchParams]);

  const work_type = searchParams.get('work_type') || 'all';
  const yearParam = searchParams.get('year') || '';
  const monthParam = searchParams.get('month') || '';
  const page = Number(searchParams.get('page') || '0');
  const tabParam = searchParams.get('tab');
  const activeTabKey = tabParam === 'archive' ? 'archive' : 'active';
  const currentTabDef =
    WO_TAB_DEFINITIONS.find((def) => def.key === activeTabKey) ?? WO_TAB_DEFINITIONS[0];

  const filters = {
    search: debouncedSearch,
    statusGroup: currentTabDef.statusGroup,
    work_type,
    year: yearParam || undefined,
    month: monthParam || undefined,
  };

  const {
    data: workOrders,
    isLoading,
    error,
    refetch,
    isFetching,
    totalCount,
    pageCount,
    pageSize,
  } = useWorkOrdersPaginated(filters, page);

  const handleSearch = (value) => setLocalSearch(value ?? '');

  const handleFilterChange = (key, value) => {
    setSearchParams(prev => {
      if (value && value !== 'all' && value !== '') prev.set(key, value);
      else prev.delete(key);
      prev.delete('page');
      return prev;
    });
  };

  const handlePageChange = (newPage) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newPage > 0) next.set('page', String(newPage));
      else next.delete('page');
      return next;
    });
  };

  const handleTabChange = (tabKey) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tabKey === 'active') next.delete('tab');
      else next.set('tab', tabKey);
      next.delete('page');
      next.delete('status');
      return next;
    });
  };

  const typeOptions = [
    { value: 'all', label: t('common:filters.all') },
    ...WORK_TYPES.map(type => ({
      value: type,
      label: tCommon(`workType.${type}`)
    }))
  ];

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - 2 + i).toString());
  const yearOptions = [
    { value: 'all', label: t('common:filters.all') },
    ...years.map((y) => ({ value: y, label: y })),
  ];

  const monthOptions = [
    { value: 'all', label: t('common:filters.all') },
    ...Object.entries(t('notifications:months', { returnObjects: true })).map(([val, label]) => ({
      value: val,
      label,
    })),
  ];

  const columns = [
    {
      header: t('workOrders:list.columns.customer'),
      accessor: 'company_name',
      cellClassName: 'whitespace-normal align-top max-w-[min(280px,40vw)]',
      render: (value, row) => (
        <div className="min-w-[140px]">
          <p className="line-clamp-2 break-words font-bold text-neutral-900 dark:text-neutral-100">
            {value}
          </p>
          <p className="line-clamp-2 break-words text-xs text-neutral-500 dark:text-neutral-400">
            {row.site_name || row.site_address}
          </p>
          {row.account_no && (
            <p className="text-[10px] font-mono text-neutral-400 mt-0.5">{row.account_no}</p>
          )}
        </div>
      ),
    },
    {
      header: t('workOrders:list.columns.city'),
      accessor: 'city',
      render: (value) => (
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <span className="text-neutral-900 dark:text-neutral-50">
            {value || '-'}
          </span>
        </div>
      ),
    },
    {
      header: t('workOrders:form.fields.workType'),
      accessor: 'work_type',
      render: (value, row) => (
        <div className="space-y-1">
          <Badge variant="outline" size="sm">
            {tCommon(`workType.${value}`)}
          </Badge>
          {row.form_no && (
            <p className="text-[10px] font-mono text-neutral-400">#{row.form_no}</p>
          )}
        </div>
      ),
    },
    {
      header: t('workOrders:list.columns.status'),
      accessor: 'status',
      render: (value) => (
        <Badge variant={workOrderStatusVariant[value]} dot>
          {tCommon(`status.${value}`)}
        </Badge>
      ),
    },
    {
      header: t('workOrders:list.columns.priority'),
      accessor: 'priority',
      render: (value) => (
        <Badge variant={priorityVariant[value] || 'default'}>
          {tCommon(`priority.${value}`)}
        </Badge>
      ),
    },
    {
      header: t('workOrders:list.columns.amount'),
      accessor: 'amount',
      render: (value, row) => (
        <div className="text-right">
          <span className="text-neutral-900 dark:text-neutral-50 font-medium">
            {value ? formatCurrency(value, row.currency || 'TRY') : '-'}
          </span>
        </div>
      ),
    },
    {
      header: t('workOrders:form.fields.scheduledDate'),
      accessor: 'scheduled_date',
      render: (value, row) => (
        <div className="text-sm min-w-[100px]">
          <div className="flex items-center text-neutral-700 dark:text-neutral-300 font-medium">
            <Calendar className="w-3.5 h-3.5 mr-1.5 text-neutral-400" />
            {value ? formatDate(value) : '-'}
          </div>
          {row.scheduled_time && (
            <p className="text-xs text-neutral-400 ml-5">{row.scheduled_time}</p>
          )}
        </div>
      ),
    },
    {
      header: t('workOrders:form.fields.assignedTo'),
      accessor: 'assigned_workers',
      render: (workers) => (
        <div className="flex -space-x-2 overflow-hidden">
          {workers?.map((worker) => (
            <div 
              key={worker.id}
              className="inline-flex h-7 w-7 rounded-full ring-2 ring-white dark:ring-[#171717] bg-primary-100 dark:bg-primary-900/40 items-center justify-center shrink-0"
              title={worker.name}
            >
              <span className="text-[10px] font-bold text-primary-700 dark:text-primary-300 uppercase leading-none tracking-normal">
                {worker.name.charAt(0)}
              </span>
            </div>
          ))}
        </div>
      ),
    },
  ];

  const kpiPlaceholder = t('workOrders:list.kpi.placeholder');
  const showKpiValues = !isLoading && !error;

  const [filterOpen, setFilterOpen] = useState(false);
  const activeFilterCount = [
    work_type !== 'all',
    yearParam,
    monthParam,
  ].filter(Boolean).length;

  const hasNarrowingFilters =
    Boolean(debouncedSearch) || work_type !== 'all' || Boolean(yearParam) || Boolean(monthParam);

  return (
    <PageContainer maxWidth="full" padding="default" className="space-y-6">
      {/* Desktop: original header */}
      <div className="hidden lg:flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
            {t('workOrders:list.eyebrow')}
          </p>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 sm:text-3xl">
            {t('workOrders:list.title')}
          </h1>
        </div>
        <Button
          size="lg"
          onClick={() => navigate('/work-orders/new')}
          leftIcon={<CirclePlus className="h-5 w-5" />}
          className="w-full shrink-0 rounded-xl shadow-lg shadow-primary-600/20 sm:w-auto"
        >
          {t('workOrders:list.addButton')}
        </Button>
      </div>

      {/* Mobile only: header with Search + Filter */}
      <div className="lg:hidden space-y-3">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-lg font-bold text-neutral-900 dark:text-neutral-50 truncate">
              {t('workOrders:list.title')}
            </h1>
          </div>
          <SearchInput
            placeholder={t('workOrders:list.searchPlaceholder')}
            value={localSearch}
            onChange={handleSearch}
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
        <Button
          size="lg"
          onClick={() => navigate('/work-orders/new')}
          leftIcon={<CirclePlus className="h-5 w-5" />}
          className="w-full rounded-xl shadow-lg shadow-primary-600/20"
        >
          {t('workOrders:list.addButton')}
        </Button>
      </div>

      {/* Phase A: KPI strip (only “matched” uses existing count; rest are placeholders until phase B) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard
          title={t('workOrders:list.kpi.matched')}
          value={showKpiValues ? totalCount : kpiPlaceholder}
          icon={ListFilter}
          loading={isLoading}
          className="border-neutral-200/70 bg-neutral-50/90 dark:border-[#262626] dark:bg-[#131313]"
        />
        <KpiCard
          title={t('workOrders:list.kpi.open')}
          value={
            showKpiValues
              ? activeTabKey === 'active'
                ? totalCount
                : kpiPlaceholder
              : kpiPlaceholder
          }
          icon={FolderOpen}
          loading={isLoading}
          className="border-neutral-200/70 bg-neutral-50/90 dark:border-[#262626] dark:bg-[#131313]"
        />
        <KpiCard
          title={t('workOrders:list.kpi.pendingInstall')}
          value={kpiPlaceholder}
          icon={Wrench}
          loading={isLoading}
          className="border-neutral-200/70 bg-neutral-50/90 dark:border-[#262626] dark:bg-[#131313]"
        />
        <KpiCard
          title={t('workOrders:list.kpi.completed')}
          value={
            showKpiValues
              ? activeTabKey === 'archive'
                ? totalCount
                : kpiPlaceholder
              : kpiPlaceholder
          }
          icon={CircleCheck}
          loading={isLoading}
          className="border-neutral-200/70 bg-neutral-50/90 dark:border-[#262626] dark:bg-[#131313]"
        />
      </div>

      {/* Active / Archive — same responsive pattern as ProposalsListPage */}
      <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 lg:mx-0 lg:px-0">
        <div className="flex gap-6 min-w-max border-b border-neutral-200 dark:border-[#262626] lg:border-0 lg:flex lg:items-center lg:gap-1 lg:p-1 lg:w-full lg:bg-neutral-100 lg:dark:bg-neutral-800/60 lg:rounded-xl lg:min-w-0">
          {WO_TAB_DEFINITIONS.map(({ key, labelKey }) => {
            const isActive = activeTabKey === key;
            const count = isActive ? totalCount : undefined;

            return (
              <button
                key={key}
                type="button"
                onClick={() => handleTabChange(key)}
                className={cn(
                  'shrink-0 pb-2.5 lg:pb-0 lg:flex-1 lg:flex lg:items-center lg:justify-center lg:gap-2 lg:px-3 lg:py-2 lg:rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-150',
                  isActive
                    ? 'border-b-2 border-primary text-primary dark:border-primary-400 dark:text-primary-400 lg:border-0 lg:bg-white lg:dark:bg-[#171717] lg:text-neutral-900 lg:dark:text-neutral-50 lg:shadow-sm'
                    : 'border-b-2 border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 lg:hover:text-neutral-700 lg:dark:hover:text-neutral-200 lg:hover:bg-white/60 lg:dark:hover:bg-neutral-700/40'
                )}
              >
                <span>{t(labelKey)}</span>
                {count != null && count > 0 && (
                  <span
                    className={cn(
                      'ml-1.5 lg:ml-0 px-1.5 py-0.5 text-[10px] font-bold rounded-full min-w-[18px] text-center tabular-nums leading-none inline-block lg:inline',
                      isActive
                        ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300 lg:bg-primary-100 lg:text-primary-700'
                        : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300'
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters - desktop only */}
      <Card className="hidden lg:block rounded-xl border border-neutral-200/80 bg-neutral-50/90 p-4 dark:border-[#262626] dark:bg-[#1a1a1a]/80">
        <div className="flex flex-col items-stretch gap-4 lg:flex-row lg:items-end">
          <div className="flex-1 min-w-[200px] w-full">
            <SearchInput
              placeholder={t('workOrders:list.searchPlaceholder')}
              value={localSearch}
              onChange={handleSearch}
              className="w-full"
              size="sm"
            />
          </div>
          <div className="flex flex-wrap items-end gap-3 w-full lg:w-auto">
            <div className="w-full sm:flex-1 md:w-44">
              <ListboxSelect
                options={typeOptions}
                value={work_type}
                onChange={(v) => handleFilterChange('work_type', v)}
                placeholder={t('workOrders:list.filters.workType')}
                size="sm"
              />
            </div>
            <div className="w-full sm:flex-1 md:w-32">
              <ListboxSelect
                options={yearOptions}
                value={yearParam || 'all'}
                onChange={(v) => handleFilterChange('year', v)}
                placeholder={t('workOrders:list.filters.selectYear')}
                size="sm"
              />
            </div>
            <div className="w-full sm:flex-1 md:w-36">
              <ListboxSelect
                options={monthOptions}
                value={monthParam || 'all'}
                onChange={(v) => handleFilterChange('month', v)}
                placeholder={t('workOrders:list.filters.selectMonth')}
                size="sm"
              />
            </div>
          </div>
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  ['work_type', 'year', 'month'].forEach((k) => next.delete(k));
                  next.delete('page');
                  return next;
                });
              }}
            >
              {t('common:filters.clear')}
            </Button>
            <Button variant="primary" size="sm" onClick={() => setFilterOpen(false)}>
              {t('common:actions.done')}
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="col-span-2">
            <ListboxSelect
              options={typeOptions}
              value={work_type}
              onChange={(v) => handleFilterChange('work_type', v)}
              placeholder={t('workOrders:list.filters.workType')}
              size="sm"
            />
          </div>
          <div>
            <ListboxSelect
              options={yearOptions}
              value={yearParam || 'all'}
              onChange={(v) => handleFilterChange('year', v)}
              placeholder={t('workOrders:list.filters.selectYear')}
              size="sm"
            />
          </div>
          <div>
            <ListboxSelect
              options={monthOptions}
              value={monthParam || 'all'}
              onChange={(v) => handleFilterChange('month', v)}
              placeholder={t('workOrders:list.filters.selectMonth')}
              size="sm"
            />
          </div>
        </div>
      </Modal>

      {isLoading ? (
        <div className="mt-6">
          <TableSkeleton cols={8} />
        </div>
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : totalCount === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={
            hasNarrowingFilters
              ? t('workOrders:list.empty.title')
              : activeTabKey === 'active'
                ? t('workOrders:list.empty.activeTitle')
                : t('workOrders:list.empty.archiveTitle')
          }
          description={
            hasNarrowingFilters
              ? t('workOrders:list.empty.description')
              : activeTabKey === 'active'
                ? t('workOrders:list.empty.activeDescription')
                : t('workOrders:list.empty.archiveDescription')
          }
          actionLabel={
            !hasNarrowingFilters && activeTabKey === 'active' ? t('workOrders:list.addButton') : null
          }
          onAction={
            !hasNarrowingFilters && activeTabKey === 'active'
              ? () => navigate('/work-orders/new')
              : null
          }
        />
      ) : (
        <div
          className={`overflow-hidden rounded-xl border border-neutral-200/90 bg-white shadow-xl shadow-neutral-900/5 transition-opacity dark:border-[#262626] dark:bg-[#0a0a0a] dark:shadow-black/40 ${isFetching && !isLoading ? 'opacity-70' : ''}`}
        >
          <Table
            columns={columns}
            data={workOrders}
            onRowClick={(row) => navigate(`/work-orders/${row.id}`)}
            className="border-none"
          />
          {pageCount > 1 && (
            <div className="flex items-center justify-between border-t border-neutral-200/90 bg-neutral-50/50 px-4 py-3 dark:border-[#262626] dark:bg-[#141414]/80">
              <span className="text-sm text-neutral-500 dark:text-neutral-400">
                {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalCount)} / {totalCount} {t('workOrders:list.unit')}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 0}
                  className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-neutral-600 dark:text-neutral-400 px-2">
                  {page + 1} / {pageCount}
                </span>
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= pageCount - 1}
                  className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
}
