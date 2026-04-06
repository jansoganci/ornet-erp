import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Building2, Calendar } from 'lucide-react';
import { useSearchInput } from '../../hooks/useSearchInput';
import { useProposals } from './hooks';
import { PageContainer, PageHeader } from '../../components/layout';
import {
  Button,
  SearchInput,
  ListboxSelect,
  Card,
  Table,
  Badge,
  Skeleton,
  EmptyState,
  ErrorState,
} from '../../components/ui';
import { cn, formatDate } from '../../lib/utils';
import { ProposalStatusBadge } from './components/ProposalStatusBadge';

const TAB_DEFINITIONS = [
  { key: 'active', labelKey: 'list.tabs.active', statusGroup: 'active' },
  { key: 'archive', labelKey: 'list.tabs.archive', statusGroup: 'archive' },
];

/** Client-side sort rank for Active tab: draft → sent → accepted */
const ACTIVE_STATUS_RANK = { draft: 0, sent: 1, accepted: 2 };

function ListSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <Card key={i} className="p-4">
          <div className="flex items-center space-x-4">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export function ProposalsListPage() {
  const { t } = useTranslation('proposals');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { search, setSearch, debouncedSearch } = useSearchInput({ debounceMs: 300 });

  const tabParam = searchParams.get('tab');
  const activeTabKey = tabParam === 'archive' ? 'archive' : 'active';
  const yearParam = searchParams.get('year') || '';
  const monthParam = searchParams.get('month') || '';

  const handleFilterChange = (key, value) => {
    setSearchParams((prev) => {
      if (value && value !== 'all' && value !== '') prev.set(key, value);
      else prev.delete(key);
      return prev;
    });
  };

  const handleTabChange = (tabKey) => {
    setSearchParams((prev) => {
      if (tabKey === 'active') prev.delete('tab');
      else prev.set('tab', tabKey);
      return prev;
    });
  };

  const currentTabDef =
    TAB_DEFINITIONS.find((def) => def.key === activeTabKey) ?? TAB_DEFINITIONS[0];

  const { data: proposals, isLoading, isFetching, error, refetch } = useProposals({
    search: debouncedSearch,
    statusGroup: currentTabDef.statusGroup,
    year: yearParam || undefined,
    month: monthParam || undefined,
  });

  const sortedProposals = useMemo(() => {
    if (!proposals?.length) return [];
    const list = [...proposals];
    if (activeTabKey === 'active') {
      return list.sort((a, b) => {
        const ra = ACTIVE_STATUS_RANK[a.status] ?? 99;
        const rb = ACTIVE_STATUS_RANK[b.status] ?? 99;
        if (ra !== rb) return ra - rb;
        const ta = new Date(a.created_at).getTime();
        const tb = new Date(b.created_at).getTime();
        return tb - ta;
      });
    }
    return list.sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return tb - ta;
    });
  }, [proposals, activeTabKey]);

  const hasListFilters = Boolean(debouncedSearch) || Boolean(yearParam) || Boolean(monthParam);
  const emptyStateTitle = hasListFilters
    ? t('list.noResults.title')
    : activeTabKey === 'active'
      ? t('list.empty.activeTitle')
      : t('list.empty.archiveTitle');
  const emptyStateDescription = hasListFilters
    ? t('list.noResults.description')
    : activeTabKey === 'active'
      ? t('list.empty.activeDescription')
      : t('list.empty.archiveDescription');

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - 2 + i).toString());
  const yearOptions = [
    { value: '', label: t('common:filters.all') },
    ...years.map((y) => ({ value: y, label: y })),
  ];

  const monthOptions = [
    { value: '', label: t('common:filters.all') },
    ...Object.entries(t('notifications:months', { returnObjects: true })).map(([val, label]) => ({
      value: val,
      label,
    })),
  ];

  const columns = [
    {
      header: t('list.columns.customer'),
      accessor: 'customer_company_name',
      maxWidth: 250,
      cellClassName: 'whitespace-normal align-top',
      render: (value, row) => {
        const text = [value ?? row.company_name ?? '—', row.site_name].filter(Boolean).join(' · ');
        return (
          <div
            className="min-w-0 w-full max-w-[200px] sm:max-w-[250px] font-medium text-neutral-900 dark:text-neutral-50 whitespace-normal line-clamp-2 break-words"
            title={text || undefined}
          >
            {text || '—'}
          </div>
        );
      },
    },
    {
      header: t('list.columns.createdAt'),
      accessor: 'created_at',
      hideOnMobile: true,
      render: (value) => (
        <div className="text-sm text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
          {value ? formatDate(value) : '-'}
        </div>
      ),
    },
    {
      header: t('list.columns.city'),
      accessor: 'city',
      hideOnMobile: true,
      render: (value) => (
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-neutral-400 shrink-0" />
          <span className="text-neutral-900 dark:text-neutral-50">
            {value || '-'}
          </span>
        </div>
      ),
    },
    {
      header: t('list.columns.title'),
      accessor: 'title',
      hideOnMobile: true,
      render: (value) => (
        <div className="min-w-[200px] max-w-[400px]">
          <p className="font-medium text-neutral-900 dark:text-neutral-50 whitespace-normal break-words">
            {value || '—'}
          </p>
        </div>
      ),
    },
    {
      header: t('list.columns.status'),
      accessor: 'status',
      render: (value) => <ProposalStatusBadge status={value} size="sm" />,
    },
    {
      header: t('list.columns.dates'),
      accessor: 'sent_at',
      hideOnMobile: true,
      render: (_, row) => {
        const dates = [];
        if (row.sent_at) {
          dates.push({ label: t('dateLabels.sent'), date: row.sent_at });
        }
        if (row.accepted_at) {
          dates.push({ label: t('dateLabels.accepted'), date: row.accepted_at });
        }
        if (row.rejected_at) {
          dates.push({ label: t('dateLabels.rejected'), date: row.rejected_at });
        }

        if (dates.length === 0) {
          return <span className="text-neutral-400">—</span>;
        }

        return (
          <div className="space-y-1 min-w-[120px]">
            {dates.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <Calendar className="w-3 h-3 text-neutral-400 shrink-0" />
                <span className="text-xs text-neutral-600 dark:text-neutral-400">
                  {item.label}: {formatDate(item.date)}
                </span>
              </div>
            ))}
          </div>
        );
      },
    },
  ];

  return (
    <PageContainer maxWidth="full" padding="default">
      {/* Mobile: Compact header band; Desktop: PageHeader */}
      <div className="lg:hidden mb-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50 truncate">
            {t('list.title')}
          </h1>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => navigate('/proposals/new')}
            className="shrink-0 px-3 py-1.5 text-xs"
          >
            {t('list.addButton')}
          </Button>
        </div>
      </div>
      <div className="hidden lg:block">
        <PageHeader
          title={t('list.title')}
          actions={
            <Button
              variant="primary"
              leftIcon={<Plus className="w-5 h-5" />}
              onClick={() => navigate('/proposals/new')}
            >
              {t('list.addButton')}
            </Button>
          }
        />
      </div>

      {/* Mobile: Underline tabs; Desktop: Pill tabs */}
      <div className="mb-4 overflow-x-auto scrollbar-hide -mx-4 px-4 lg:mx-0 lg:px-0">
        <div className="flex gap-6 min-w-max border-b border-neutral-200 dark:border-[#262626] lg:border-0 lg:flex lg:items-center lg:gap-1 lg:p-1 lg:w-full lg:bg-neutral-100 lg:dark:bg-neutral-800/60 lg:rounded-xl lg:min-w-0">
          {TAB_DEFINITIONS.map(({ key, labelKey }) => {
            const isActive = activeTabKey === key;
            const count = isActive ? proposals?.length : undefined;

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
                  <span className={cn(
                    'ml-1.5 lg:ml-0 px-1.5 py-0.5 text-[10px] font-bold rounded-full min-w-[18px] text-center tabular-nums leading-none inline-block lg:inline',
                    isActive
                      ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300 lg:bg-primary-100 lg:text-primary-700'
                      : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300'
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters: Mobile grid-cols-2 Yıl+Ay; Desktop flex row */}
      <Card className="p-3 border-neutral-200/60 dark:border-neutral-800/60">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-end gap-3">
          <div className="flex-1 min-w-0 lg:min-w-[200px]">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={t('list.searchPlaceholder')}
              className="w-full"
              size="sm"
            />
          </div>
          <div className="grid grid-cols-2 lg:flex gap-3">
            <div className="min-w-0 lg:w-32">
              <ListboxSelect
                value={yearParam}
                onChange={(val) => handleFilterChange('year', val)}
                options={yearOptions}
                placeholder={t('filters.selectYear')}
                size="sm"
              />
            </div>
            <div className="min-w-0 lg:w-36">
              <ListboxSelect
                value={monthParam}
                onChange={(val) => handleFilterChange('month', val)}
                options={monthOptions}
                placeholder={t('filters.selectMonth')}
                size="sm"
              />
            </div>
          </div>
        </div>
      </Card>

      {isLoading && <ListSkeleton />}

      {error && (
        <ErrorState
          message={error.message}
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !error && proposals?.length === 0 && (
        <EmptyState
          title={emptyStateTitle}
          description={emptyStateDescription}
          actionLabel={
            !hasListFilters && activeTabKey === 'active' ? t('list.addButton') : null
          }
          onAction={
            !hasListFilters && activeTabKey === 'active'
              ? () => navigate('/proposals/new')
              : null
          }
        />
      )}

      {!isLoading && !error && proposals?.length > 0 && (
        <div
          className={cn(
            'mt-6 bg-white dark:bg-[#171717] rounded-2xl border border-neutral-200 dark:border-[#262626] overflow-hidden shadow-sm lg:rounded-lg transition-opacity',
            isFetching && !isLoading ? 'opacity-70' : ''
          )}
        >
          <Table
            columns={columns}
            data={sortedProposals}
            loading={isLoading}
            onRowClick={(row) => navigate(`/proposals/${row.id}`)}
            className="border-none"
            mobileCardLayout="inline"
          />
        </div>
      )}
    </PageContainer>
  );
}
