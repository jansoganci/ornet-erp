import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, CreditCard, Tag, TrendingUp, TrendingDown, Minus, Users, Pause, AlertTriangle, FileSpreadsheet, Receipt, Wallet, Building2, Calendar, ChevronLeft, ChevronRight, X, PauseCircle } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/layout';
import {
  Button,
  SearchInput,
  ListboxSelect,
  Table,
  Badge,
  Card,
  EmptyState,
  Skeleton,
  ErrorState,
  TableSkeleton,
  DateRangeFilter,
} from '../../components/ui';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { formatCurrency, formatDate, getSubscriptionListSubtotal, getSubscriptionListTotalWithVat } from '../../lib/utils';
import { useSubscriptionsPaginated, useSubscriptionStats, useCurrentProfile } from './hooks';
import { KpiCard } from '../../components/ui';
import { SubscriptionStatusBadge } from './components/SubscriptionStatusBadge';
import { ComplianceAlert } from './components/ComplianceAlert';
import { SERVICE_TYPES } from './schema';
export function SubscriptionsListPage() {
  const { t } = useTranslation(['subscriptions', 'common']);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const searchFromUrl = searchParams.get('search') || '';
  const [localSearch, setLocalSearch] = useState(searchFromUrl);
  const debouncedSearch = useDebouncedValue(localSearch, 300);
  const status = searchParams.get('status') || 'all';
  const serviceType = searchParams.get('service_type') || 'all';
  const billingFrequency = searchParams.get('billing_frequency') || 'all';
  const yearParam = searchParams.get('year') || '';
  const monthParam = searchParams.get('month') || '';
  const overdue = searchParams.get('overdue') === 'true';
  const page = Number(searchParams.get('page') || '0');
  const pageSize = Number(searchParams.get('per_page') || '50');

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

  const filters = {
    search: debouncedSearch,
    status,
    service_type: serviceType === 'all' ? undefined : serviceType,
    billing_frequency: billingFrequency === 'all' ? undefined : billingFrequency,
    year: yearParam || undefined,
    month: monthParam || undefined,
    overdue: overdue || undefined,
  };

  const {
    data: subscriptions,
    isLoading,
    error,
    refetch,
    totalCount,
    pageCount,
    isFetching,
  } = useSubscriptionsPaginated(filters, page, pageSize);
  const { data: stats } = useSubscriptionStats();
  const { data: currentProfile } = useCurrentProfile();
  const isAdmin = currentProfile?.role === 'admin';

  const getTrend = (current, previous) => {
    if (!previous || previous === 0) return null;
    const diff = current - previous;
    const percent = (diff / previous) * 100;
    const value = Math.abs(Math.round(percent));
    if (value === 0) return null;
    return {
      value,
      isPositive: diff > 0,
    };
  };

  const mrrTrend = getTrend(Number(stats?.mrr) || 0, Number(stats?.mrr_previous_month) || 0);
  const activeTrend = getTrend(stats?.active_count ?? 0, stats?.active_count_previous_month ?? 0);

  const handleSearch = (value) => setLocalSearch(value ?? '');

  const handleFilterChange = (key, value) => {
    setSearchParams((prev) => {
      if (value && value !== 'all') prev.set(key, value);
      else prev.delete(key);
      prev.delete('page'); // reset to first page on any filter change
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

  const handleToggleOverdue = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (overdue) next.delete('overdue');
      else next.set('overdue', 'true');
      next.delete('page');
      return next;
    });
  };

  const handlePageSizeChange = (newSize) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('per_page', String(newSize));
      next.delete('page'); // reset to first page when page size changes
      return next;
    });
  };

  const statusOptions = [
    { value: 'all', label: t('subscriptions:list.filters.allStatuses') },
    { value: 'active', label: t('subscriptions:statuses.active') },
    { value: 'paused', label: t('subscriptions:statuses.paused') },
    { value: 'cancelled', label: t('subscriptions:statuses.cancelled') },
  ];

  const billingFrequencyOptions = [
    { value: 'all', label: t('subscriptions:list.filters.allFrequencies') },
    { value: 'monthly', label: t('subscriptions:form.fields.monthly') },
    { value: '3_month', label: t('subscriptions:form.fields.3_month') },
    { value: '6_month', label: t('subscriptions:form.fields.6_month') },
    { value: 'yearly', label: t('subscriptions:form.fields.yearly') },
  ];

  const serviceTypeOptions = [
    { value: 'all', label: t('common:filters.all') },
    ...SERVICE_TYPES.map((v) => ({ value: v, label: t(`subscriptions:serviceTypes.${v}`) })),
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
      header: t('subscriptions:list.columns.customer'),
      accessor: 'company_name',
      minWidth: 160,
      maxWidth: 220,
      headerClassName: 'whitespace-normal',
      cellClassName: 'whitespace-normal align-top',
      render: (value, row) => (
        <div className="min-w-0 break-words">
          <p className="font-bold text-neutral-900 dark:text-neutral-100">{value}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{row.site_name}</p>
          {row.account_no && (
            <p className="text-[10px] font-mono text-neutral-400 mt-0.5">{row.account_no}</p>
          )}
        </div>
      ),
    },
    {
      header: t('subscriptions:list.columns.city'),
      accessor: 'city',
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
      header: t('subscriptions:list.columns.serviceType'),
      accessor: 'service_type',
      render: (value) => (
        <span className="text-sm text-neutral-700 dark:text-neutral-300">
          {value ? t(`subscriptions:serviceTypes.${value}`) : '—'}
        </span>
      ),
    },
    {
      header: t('subscriptions:list.columns.startDate'),
      accessor: 'start_date',
      render: (value) => (
        <div className="flex items-center gap-1.5 text-sm text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
          <Calendar className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          {value ? formatDate(value) : '-'}
        </div>
      ),
    },
    {
      header: t('subscriptions:list.columns.billingFrequency'),
      accessor: 'billing_frequency',
      render: (value) => {
        if (!value) return <span className="text-neutral-400">—</span>;
        const key = value === '6_month' ? '6_month' : value;
        return (
          <Badge variant="info" size="sm">
            {t(`subscriptions:form.fields.${key}`)}
          </Badge>
        );
      },
    },
    {
      header: t('subscriptions:list.columns.monthly'),
      accessor: 'base_price',
      align: 'right',
      minWidth: 100,
      maxWidth: 100,
      render: (value) => (
        <span className="font-bold text-neutral-900 dark:text-neutral-100">
          {formatCurrency(value ?? 0)}
        </span>
      ),
    },
    {
      header: t('subscriptions:list.columns.lineTl'),
      accessor: 'line_fee',
      align: 'right',
      minWidth: 100,
      maxWidth: 100,
      render: (value) => (
        <span className="text-neutral-900 dark:text-neutral-50">
          {formatCurrency(value ?? 0)}
        </span>
      ),
    },
    {
      header: t('subscriptions:list.columns.simTl'),
      accessor: 'sim_amount',
      align: 'right',
      minWidth: 100,
      maxWidth: 100,
      render: (value) => (
        <span className="text-neutral-900 dark:text-neutral-50">
          {formatCurrency(value ?? 0)}
        </span>
      ),
    },
    {
      key: 'totalAmountCalc',
      header: t('subscriptions:list.columns.totalAmountCalc'),
      align: 'right',
      minWidth: 100,
      maxWidth: 100,
      render: (_, row) => {
        const toplamTutar = getSubscriptionListSubtotal(row);
        return (
          <span className="text-neutral-900 dark:text-neutral-50">
            {formatCurrency(toplamTutar)}
          </span>
        );
      },
    },
    {
      key: 'totalWithVatCalc',
      header: t('subscriptions:list.columns.totalWithVatCalc'),
      align: 'right',
      minWidth: 100,
      maxWidth: 100,
      render: (_, row) => {
        const kdvDahilToplam = getSubscriptionListTotalWithVat(row);
        return (
          <span className="font-bold text-neutral-900 dark:text-neutral-100">
            {formatCurrency(kdvDahilToplam)}
          </span>
        );
      },
    },
    {
      header: t('subscriptions:list.columns.cost'),
      accessor: 'cost',
      align: 'right',
      minWidth: 100,
      maxWidth: 100,
      render: (value) => (
        <span className="text-neutral-600 dark:text-neutral-400">
          {formatCurrency(value ?? 0)}
        </span>
      ),
    },
    {
      header: t('subscriptions:list.columns.status'),
      accessor: 'status',
      render: (value) => <SubscriptionStatusBadge status={value} />,
    },
  ];

  return (
    <PageContainer maxWidth="full" padding="default" className="space-y-6">
      <PageHeader
        title={t('subscriptions:list.title')}
        actions={
          <div className="flex gap-2">
            {isAdmin && (
              <Button
                variant="outline"
                onClick={() => navigate('/subscriptions/price-revision')}
                leftIcon={<Receipt className="w-4 h-4" />}
                className="hidden md:inline-flex"
              >
                {t('subscriptions:priceRevision.title')}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => navigate('/subscriptions/import')}
              leftIcon={<FileSpreadsheet className="w-4 h-4" />}
              className="hidden md:inline-flex"
            >
              {t('common:import.bulkImportButton')}
            </Button>
            {/* Desktop: full button | Mobile: icon-only */}
            <Button
              variant="primary"
              onClick={() => navigate('/subscriptions/new')}
              leftIcon={<Plus className="w-4 h-4" />}
              className="hidden md:inline-flex"
            >
              {t('subscriptions:list.addButton')}
            </Button>
            <button
              type="button"
              onClick={() => navigate('/subscriptions/new')}
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-primary-600 text-white active:scale-95 transition-transform shadow-lg shadow-primary-600/20"
              aria-label={t('subscriptions:list.addButton')}
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        }
      />

      <ComplianceAlert />

      {/* Mobile KPI Strip — compact 2x2 grid, md:hidden */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 md:hidden">
          <div className="bg-white dark:bg-[#171717] rounded-xl p-4 flex flex-col justify-between h-24 border border-neutral-200/60 dark:border-[#262626]">
            <span className="text-[10px] uppercase tracking-widest text-neutral-500 dark:text-neutral-400 font-bold">
              {t('subscriptions:stats.activeCount')}
            </span>
            <div className="flex items-end justify-between">
              <span className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 tracking-tighter">
                {stats.active_count ?? 0}
              </span>
              {activeTrend && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  activeTrend.isPositive
                    ? 'text-success-600 dark:text-success-400 bg-success-50 dark:bg-success-950/30'
                    : 'text-error-600 dark:text-error-400 bg-error-50 dark:bg-error-950/30'
                }`}>
                  {activeTrend.isPositive ? '+' : '-'}{activeTrend.value}%
                </span>
              )}
            </div>
          </div>
          <div className="bg-white dark:bg-[#171717] rounded-xl p-4 flex flex-col justify-between h-24 border border-neutral-200/60 dark:border-[#262626]">
            <span className="text-[10px] uppercase tracking-widest text-neutral-500 dark:text-neutral-400 font-bold">
              {t('subscriptions:stats.overdueCount')}
            </span>
            <div className="flex items-end justify-between">
              <span className="text-2xl font-bold text-error-600 dark:text-error-400 tracking-tighter">
                {stats.overdue_invoice_count ?? 0}
              </span>
              {(stats.overdue_invoice_count ?? 0) > 0 && (
                <AlertTriangle className="w-4 h-4 text-error-500 dark:text-error-400" />
              )}
            </div>
          </div>
          <div className="bg-white dark:bg-[#171717] rounded-xl p-4 flex flex-col justify-between h-24 border border-neutral-200/60 dark:border-[#262626]">
            <span className="text-[10px] uppercase tracking-widest text-neutral-500 dark:text-neutral-400 font-bold">
              {t('subscriptions:stats.mrr')}
            </span>
            <div className="flex items-end justify-between">
              <span className="text-2xl font-bold text-primary-600 dark:text-primary-400 tracking-tighter">
                {formatCurrency(stats.mrr || 0)}
              </span>
              {mrrTrend && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  mrrTrend.isPositive
                    ? 'text-success-600 dark:text-success-400 bg-success-50 dark:bg-success-950/30'
                    : 'text-error-600 dark:text-error-400 bg-error-50 dark:bg-error-950/30'
                }`}>
                  {mrrTrend.isPositive ? '+' : '-'}{mrrTrend.value}%
                </span>
              )}
            </div>
          </div>
          <div className="bg-white dark:bg-[#171717] rounded-xl p-4 flex flex-col justify-between h-24 border border-neutral-200/60 dark:border-[#262626]">
            <span className="text-[10px] uppercase tracking-widest text-neutral-500 dark:text-neutral-400 font-bold">
              {t('subscriptions:stats.pausedCount')}
            </span>
            <div className="flex items-end justify-between">
              <span className="text-2xl font-bold text-neutral-400 dark:text-neutral-500 tracking-tighter">
                {stats.paused_count ?? 0}
              </span>
              <PauseCircle className="w-4 h-4 text-neutral-400 dark:text-neutral-500" />
            </div>
          </div>
        </div>
      )}

      {/* Desktop KPI Cards — hidden on mobile */}
      {stats && (
        <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <KpiCard
            title={t('subscriptions:stats.mrr')}
            value={formatCurrency(stats.mrr || 0)}
            icon={TrendingUp}
            subtitle={t('subscriptions:stats.fromCustomers', {
              count: stats.distinct_customer_count ?? 0,
            })}
            trend={mrrTrend ? `${mrrTrend.isPositive ? '+' : '-'}${mrrTrend.value}%` : undefined}
            trendType={mrrTrend?.isPositive ? 'up' : mrrTrend ? 'down' : 'neutral'}
            href="/subscriptions"
          />
          <KpiCard
            title={t('subscriptions:stats.activeCount')}
            value={stats.active_count ?? 0}
            icon={Users}
            subtitle={t('subscriptions:stats.customers', {
              count: stats.distinct_customer_count ?? 0,
            })}
            trend={activeTrend ? `${activeTrend.isPositive ? '+' : '-'}${activeTrend.value}%` : undefined}
            trendType={activeTrend?.isPositive ? 'up' : activeTrend ? 'down' : 'neutral'}
            href="/subscriptions?status=active"
          />
          <KpiCard
            title={t('subscriptions:stats.pausedCount')}
            value={stats.paused_count ?? 0}
            icon={Pause}
            href="/subscriptions?status=paused"
          />
          <KpiCard
            title={t('subscriptions:stats.overdueCount')}
            value={stats.overdue_invoice_count ?? 0}
            icon={AlertTriangle}
            subtitle={t('subscriptions:stats.overdueHint')}
            variant={(stats.overdue_invoice_count ?? 0) > 0 ? 'alert' : 'default'}
            onClick={() =>
              document.getElementById('compliance-alert')?.scrollIntoView?.({ behavior: 'smooth' })
            }
          />
          <KpiCard
            title={t('subscriptions:stats.unpaidCount')}
            value={stats.unpaid_count ?? 0}
            icon={Wallet}
            subtitle={t('subscriptions:stats.unpaidHint')}
            variant={(stats.unpaid_count ?? 0) > 0 ? 'alert' : 'default'}
            href="/subscriptions?overdue=true"
          />
        </div>
      )}

      {/* Mobile Search + Filter Chips — md:hidden */}
      <div className="md:hidden space-y-3 sticky top-0 z-20 -mx-4 px-4 pt-3 pb-2 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-xl">
        <SearchInput
          placeholder={t('subscriptions:list.searchPlaceholder')}
          value={localSearch}
          onChange={handleSearch}
          className="w-full"
          size="sm"
        />
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {[
            { key: 'all', label: t('subscriptions:list.filters.allStatuses'), isActive: status === 'all' && !overdue },
            { key: 'active', label: t('subscriptions:statuses.active'), isActive: status === 'active' && !overdue },
            { key: 'overdue', label: t('subscriptions:list.filters.overduePayments'), isActive: overdue },
            { key: 'paused', label: t('subscriptions:statuses.paused'), isActive: status === 'paused' && !overdue },
            { key: 'cancelled', label: t('subscriptions:statuses.cancelled'), isActive: status === 'cancelled' && !overdue },
          ].map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => {
                if (chip.key === 'overdue') {
                  // Clear status filter, toggle overdue
                  setSearchParams((prev) => {
                    const next = new URLSearchParams(prev);
                    next.delete('status');
                    if (!overdue) next.set('overdue', 'true');
                    else next.delete('overdue');
                    next.delete('page');
                    return next;
                  });
                } else {
                  // Clear overdue, set status
                  setSearchParams((prev) => {
                    const next = new URLSearchParams(prev);
                    next.delete('overdue');
                    if (chip.key !== 'all') next.set('status', chip.key);
                    else next.delete('status');
                    next.delete('page');
                    return next;
                  });
                }
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                chip.isActive
                  ? 'bg-primary-600/10 text-primary-600 dark:text-primary-400 border border-primary-600/20'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border border-transparent'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <ListboxSelect
          className="w-full"
          options={serviceTypeOptions}
          value={serviceType}
          onChange={(v) => handleFilterChange('service_type', v)}
          placeholder={t('subscriptions:list.filters.serviceType')}
          size="sm"
        />
      </div>

      {/* Desktop Filters — hidden on mobile */}
      <Card className="hidden md:block p-3 border-neutral-200/60 dark:border-neutral-800/60">
        {overdue && (
          <div className="flex items-center gap-2 mb-3 px-1">
            <button
              onClick={handleToggleOverdue}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-error-100 dark:bg-error-950/40 text-error-700 dark:text-error-400 text-xs font-medium border border-error-200 dark:border-error-800/40 hover:bg-error-200 dark:hover:bg-error-900/40 transition-colors"
            >
              <AlertTriangle className="w-3 h-3" />
              {t('subscriptions:list.filters.overduePayments')}
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
        <div className="flex flex-col lg:flex-row items-end gap-3">
          <div className="flex-1 min-w-[200px] w-full">
            <SearchInput
              placeholder={t('subscriptions:list.searchPlaceholder')}
              value={localSearch}
              onChange={handleSearch}
              className="w-full"
              size="sm"
            />
          </div>
          <div className="flex flex-wrap items-end gap-3 w-full lg:w-auto">
            <div className="w-full sm:flex-1 md:w-40">
              <ListboxSelect
                options={statusOptions}
                value={status}
                onChange={(v) => handleFilterChange('status', v)}
                placeholder={t('subscriptions:list.filters.status')}
                size="sm"
              />
            </div>
            <div className="w-full sm:flex-1 md:w-44">
              <ListboxSelect
                options={billingFrequencyOptions}
                value={billingFrequency}
                onChange={(v) => handleFilterChange('billing_frequency', v)}
                placeholder={t('subscriptions:list.filters.billingFrequency')}
                size="sm"
              />
            </div>
            <div className="w-full sm:flex-1 min-w-[12rem] md:min-w-0 md:w-56 lg:w-60">
              <ListboxSelect
                options={serviceTypeOptions}
                value={serviceType}
                onChange={(v) => handleFilterChange('service_type', v)}
                placeholder={t('subscriptions:list.filters.serviceType')}
                size="sm"
              />
            </div>
            <div className="w-full sm:flex-1 md:w-32">
              <ListboxSelect
                options={yearOptions}
                value={yearParam || 'all'}
                onChange={(v) => handleFilterChange('year', v)}
                placeholder={t('subscriptions:list.filters.selectYear')}
                size="sm"
              />
            </div>
            <div className="w-full sm:flex-1 md:w-36">
              <ListboxSelect
                options={monthOptions}
                value={monthParam || 'all'}
                onChange={(v) => handleFilterChange('month', v)}
                placeholder={t('subscriptions:list.filters.selectMonth')}
                size="sm"
              />
            </div>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <>
          {/* Mobile skeleton */}
          <div className="md:hidden space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-[#171717] rounded-xl p-5 border border-neutral-200/60 dark:border-[#262626] space-y-3 animate-pulse">
                <div className="flex justify-between">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-20" />
                <div className="flex justify-between pt-1">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-5 w-20" />
                </div>
              </div>
            ))}
          </div>
          {/* Desktop skeleton */}
          <div className="hidden md:block mt-6">
            <TableSkeleton cols={8} />
          </div>
        </>
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : subscriptions.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title={t('subscriptions:list.empty.title')}
          description={t('subscriptions:list.empty.description')}
          actionLabel={t('subscriptions:list.addButton')}
          onAction={() => navigate('/subscriptions/new')}
        />
      ) : (
        <>
          {/* Mobile Card List — md:hidden */}
          <div className={`md:hidden space-y-3 transition-opacity ${isFetching && !isLoading ? 'opacity-70' : ''}`}>
            {subscriptions.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => navigate(`/subscriptions/${row.id}`)}
                className={`w-full text-left bg-white dark:bg-[#1f1f1f] rounded-xl p-5 border border-neutral-200/60 dark:border-[#262626] shadow-sm transition-all active:scale-[0.98] ${
                  overdue ? 'border-l-4 border-l-error-500 dark:border-l-error-500' : ''
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-50 leading-tight truncate pr-3">
                    {row.company_name}
                  </h3>
                  <span className="shrink-0">
                    <SubscriptionStatusBadge status={row.status} />
                  </span>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3 truncate">
                  {row.site_name}
                </p>
                <div className="flex items-end justify-between">
                  <div className="space-y-1 min-w-0">
                    {row.account_no && (
                      <code className="text-[10px] text-primary-600/70 dark:text-primary-400/70 font-mono tracking-widest">
                        {row.account_no}
                      </code>
                    )}
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 uppercase tracking-tight flex items-center gap-1">
                      {row.service_type && (
                        <span>{t(`subscriptions:serviceTypes.${row.service_type}`)}</span>
                      )}
                      {row.service_type && row.billing_frequency && (
                        <span className="w-1 h-1 rounded-full bg-neutral-300 dark:bg-neutral-600" />
                      )}
                      {row.billing_frequency && (
                        <span>{t(`subscriptions:form.fields.${row.billing_frequency}`)}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0 pl-3">
                    <span className="text-xl font-extrabold text-neutral-900 dark:text-neutral-50 tracking-tighter">
                      {formatCurrency(getSubscriptionListTotalWithVat(row))}
                    </span>
                  </div>
                </div>
              </button>
            ))}

            {/* Mobile Pagination */}
            {totalCount > 0 && (
              <div className="flex items-center justify-between pt-2 pb-4">
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalCount)} / {totalCount}
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
                    {page + 1} / {Math.max(pageCount, 1)}
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

          {/* Desktop Table — hidden on mobile */}
          <div className={`hidden md:block bg-white dark:bg-[#171717] rounded-2xl border border-neutral-200 dark:border-[#262626] overflow-hidden shadow-sm transition-opacity ${isFetching && !isLoading ? 'opacity-70' : ''}`}>
            <Table
              columns={columns}
              data={subscriptions}
              onRowClick={(row) => navigate(`/subscriptions/${row.id}`)}
              className="border-none"
            />
            {totalCount > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200 dark:border-neutral-800 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-neutral-500 dark:text-neutral-400">
                    {totalCount > 0
                      ? `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, totalCount)} / ${totalCount} ${t('subscriptions:list.pagination.subscriptions')}`
                      : ''}
                  </span>
                  <select
                    value={pageSize}
                    onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                    className="text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg px-2 py-1 bg-white dark:bg-[#171717] text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  >
                    {[25, 50, 100].map((n) => (
                      <option key={n} value={n}>
                        {t('subscriptions:list.pagination.perPage', { count: n })}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 0}
                    className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-neutral-600 dark:text-neutral-400 px-2">
                    {page + 1} / {Math.max(pageCount, 1)}
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
        </>
      )}

    </PageContainer>
  );
}
