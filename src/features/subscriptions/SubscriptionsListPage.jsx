import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, CreditCard, Filter, Tag, TrendingUp, TrendingDown, Minus, Users, Pause, AlertTriangle, FileSpreadsheet, Receipt, Wallet, Building2, Calendar } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/layout';
import {
  Button,
  SearchInput,
  Select,
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
import { formatCurrency, formatDate } from '../../lib/utils';
import { useSubscriptions, useSubscriptionStats, useCurrentProfile } from './hooks';
import { SUBSCRIPTION_TYPES } from './schema';
import { StatCard } from './components/StatCard';
import { SubscriptionStatusBadge } from './components/SubscriptionStatusBadge';
import { ComplianceAlert } from './components/ComplianceAlert';
import { SubscriptionImportModal } from './components/SubscriptionImportModal';

export function SubscriptionsListPage() {
  const { t } = useTranslation(['subscriptions', 'common']);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [importModalOpen, setImportModalOpen] = useState(false);

  const searchFromUrl = searchParams.get('search') || '';
  const [localSearch, setLocalSearch] = useState(searchFromUrl);
  const debouncedSearch = useDebouncedValue(localSearch, 300);
  const status = searchParams.get('status') || 'all';
  const type = searchParams.get('type') || 'all';
  const billingFrequency = searchParams.get('billing_frequency') || 'all';
  const yearParam = searchParams.get('year') || '';
  const monthParam = searchParams.get('month') || '';

  // Sync local search from URL
  useEffect(() => {
    setLocalSearch(searchFromUrl);
  }, [searchFromUrl]);
  // Sync debounced search to URL — setState in effect is intentional
  useEffect(() => {
    if (searchFromUrl === debouncedSearch) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (debouncedSearch) next.set('search', debouncedSearch);
      else next.delete('search');
      return next;
    });
  }, [debouncedSearch, searchFromUrl, setSearchParams]);

  const { data: subscriptions = [], isLoading, error, refetch } = useSubscriptions({
    search: debouncedSearch,
    status,
    type,
    billing_frequency: billingFrequency === 'all' ? undefined : billingFrequency,
    year: yearParam || undefined,
    month: monthParam || undefined,
  });
  const { data: stats } = useSubscriptionStats();
  const { data: currentProfile } = useCurrentProfile();
  const isAdmin = currentProfile?.role === 'admin';

  const getTrend = (current, previous) => {
    if (!previous || previous === 0) return null;
    const diff = current - previous;
    const percent = (diff / previous) * 100;
    return {
      value: Math.abs(Math.round(percent)),
      isPositive: diff > 0,
    };
  };

  const handleSearch = (value) => setLocalSearch(value);

  const handleFilterChange = (key, value) => {
    setSearchParams((prev) => {
      if (value && value !== 'all') prev.set(key, value);
      else prev.delete(key);
      return prev;
    });
  };

  const statusOptions = [
    { value: 'all', label: t('subscriptions:list.filters.allStatuses') },
    { value: 'active', label: t('subscriptions:statuses.active') },
    { value: 'paused', label: t('subscriptions:statuses.paused') },
    { value: 'cancelled', label: t('subscriptions:statuses.cancelled') },
  ];

  const typeOptions = [
    { value: 'all', label: t('subscriptions:list.filters.allTypes') },
    ...SUBSCRIPTION_TYPES.map((tp) => ({
      value: tp,
      label: t(`subscriptions:types.${tp}`),
    })),
  ];

  const billingFrequencyOptions = [
    { value: 'all', label: t('subscriptions:list.filters.allFrequencies') },
    { value: 'monthly', label: t('subscriptions:form.fields.monthly') },
    { value: '3_month', label: t('subscriptions:form.fields.3_month') },
    { value: '6_month', label: t('subscriptions:form.fields.6_month') },
    { value: 'yearly', label: t('subscriptions:form.fields.yearly') },
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
      render: (value, row) => (
        <div className="min-w-[150px]">
          <p className="font-bold text-neutral-900 dark:text-neutral-100 truncate">{value}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{row.site_name}</p>
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
      header: t('subscriptions:list.columns.type'),
      accessor: 'subscription_type',
      render: (value) => (
        <Badge variant="default" size="sm">
          {t(`subscriptions:types.${value}`)}
        </Badge>
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
      accessor: 'total_amount',
      render: (value) => (
        <span className="font-bold text-neutral-900 dark:text-neutral-100">
          {formatCurrency(value)}
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
    <PageContainer maxWidth="xl" padding="default" className="space-y-6">
      <PageHeader
        title={t('subscriptions:list.title')}
        actions={
          <div className="flex gap-2">
            {isAdmin && (
              <Button
                variant="outline"
                onClick={() => navigate('/subscriptions/price-revision')}
                leftIcon={<Receipt className="w-4 h-4" />}
              >
                {t('subscriptions:priceRevision.title')}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setImportModalOpen(true)}
              leftIcon={<FileSpreadsheet className="w-4 h-4" />}
            >
              {t('subscriptions:import.title')}
            </Button>
            <Button
              variant="primary"
              onClick={() => navigate('/subscriptions/new')}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              {t('subscriptions:list.addButton')}
            </Button>
          </div>
        }
      />

      <ComplianceAlert />

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard
            icon={TrendingUp}
            label={t('subscriptions:stats.mrr')}
            value={formatCurrency(stats.mrr || 0)}
            color="text-primary-700 dark:text-primary-300"
            subtitle={t('subscriptions:stats.fromCustomers', {
              count: stats.distinct_customer_count ?? 0,
            })}
            trend={getTrend(
              Number(stats.mrr) || 0,
              Number(stats.mrr_previous_month) || 0
            )}
            hint={t('subscriptions:stats.mrrHint')}
          />
          <StatCard
            icon={Users}
            label={t('subscriptions:stats.activeCount')}
            value={stats.active_count || 0}
            color="text-success-600 dark:text-success-400"
            subtitle={t('subscriptions:stats.customers', {
              count: stats.distinct_customer_count ?? 0,
            })}
            trend={getTrend(
              stats.active_count ?? 0,
              stats.active_count_previous_month ?? 0
            )}
            onClick={() => navigate('/subscriptions?status=active')}
          />
          <StatCard
            icon={Pause}
            label={t('subscriptions:stats.pausedCount')}
            value={stats.paused_count || 0}
            color="text-warning-600 dark:text-warning-400"
            onClick={() => navigate('/subscriptions?status=paused')}
          />
          <StatCard
            icon={AlertTriangle}
            label={t('subscriptions:stats.overdueCount')}
            value={stats.overdue_invoice_count ?? 0}
            color="text-error-600 dark:text-error-400"
            subtitle={t('subscriptions:stats.overdueHint')}
            onClick={() =>
              document.getElementById('compliance-alert')?.scrollIntoView?.({ behavior: 'smooth' })
            }
          />
          <StatCard
            icon={Wallet}
            label={t('subscriptions:stats.unpaidCount')}
            value={stats.unpaid_count ?? 0}
            color="text-error-600 dark:text-error-400"
            subtitle={t('subscriptions:stats.unpaidHint')}
            onClick={() => navigate('/subscriptions')}
          />
        </div>
      )}

      {/* Filters */}
      <Card className="p-3 border-neutral-200/60 dark:border-neutral-800/60">
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
              <Select
                label={t('subscriptions:list.filters.status')}
                options={statusOptions}
                value={status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                leftIcon={<Filter className="w-4 h-4" />}
                size="sm"
              />
            </div>
            <div className="w-full sm:flex-1 md:w-40">
              <Select
                label={t('subscriptions:list.filters.type')}
                options={typeOptions}
                value={type}
                onChange={(e) => handleFilterChange('type', e.target.value)}
                leftIcon={<Tag className="w-4 h-4" />}
                size="sm"
              />
            </div>
            <div className="w-full sm:flex-1 md:w-44">
              <Select
                label={t('subscriptions:list.filters.billingFrequency')}
                options={billingFrequencyOptions}
                value={billingFrequency}
                onChange={(e) => handleFilterChange('billing_frequency', e.target.value)}
                leftIcon={<Calendar className="w-4 h-4" />}
                size="sm"
              />
            </div>
            <div className="w-full sm:flex-1 md:w-32">
              <Select
                label={t('subscriptions:list.filters.selectYear')}
                options={yearOptions}
                value={yearParam}
                onChange={(e) => handleFilterChange('year', e.target.value)}
                size="sm"
              />
            </div>
            <div className="w-full sm:flex-1 md:w-36">
              <Select
                label={t('subscriptions:list.filters.selectMonth')}
                options={monthOptions}
                value={monthParam}
                onChange={(e) => handleFilterChange('month', e.target.value)}
                size="sm"
              />
            </div>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="mt-6">
          <TableSkeleton cols={8} />
        </div>
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
        <div className="bg-white dark:bg-[#171717] rounded-2xl border border-neutral-200 dark:border-[#262626] overflow-hidden shadow-sm">
          <Table
            columns={columns}
            data={subscriptions}
            onRowClick={(row) => navigate(`/subscriptions/${row.id}`)}
            className="border-none"
          />
        </div>
      )}

      <SubscriptionImportModal open={importModalOpen} onClose={() => setImportModalOpen(false)} />
    </PageContainer>
  );
}
