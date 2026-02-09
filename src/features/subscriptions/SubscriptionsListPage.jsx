import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, CreditCard, Filter, Tag, TrendingUp, Users, Pause, AlertTriangle, FileSpreadsheet, Receipt } from 'lucide-react';
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
} from '../../components/ui';
import { formatCurrency } from '../../lib/utils';
import { useSubscriptions, useSubscriptionStats, useCurrentProfile } from './hooks';
import { SUBSCRIPTION_TYPES } from './schema';
import { SubscriptionStatusBadge } from './components/SubscriptionStatusBadge';
import { ComplianceAlert } from './components/ComplianceAlert';
import { SubscriptionImportModal } from './components/SubscriptionImportModal';

function SubscriptionsSkeleton() {
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

function StatCard({ icon: Icon, label, value, color = 'text-neutral-900 dark:text-neutral-100' }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-950/20">
          <Icon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        </div>
        <div>
          <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">{label}</p>
          <p className={`text-lg font-black ${color}`}>{value}</p>
        </div>
      </div>
    </Card>
  );
}

export function SubscriptionsListPage() {
  const { t } = useTranslation(['subscriptions', 'common']);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [importModalOpen, setImportModalOpen] = useState(false);

  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || 'all';
  const type = searchParams.get('type') || 'all';

  const { data: subscriptions = [], isLoading, error, refetch } = useSubscriptions({ search, status, type });
  const { data: stats } = useSubscriptionStats();
  const { data: currentProfile } = useCurrentProfile();
  const isAdmin = currentProfile?.role === 'admin';

  const handleSearch = (value) => {
    setSearchParams((prev) => {
      if (value) prev.set('search', value);
      else prev.delete('search');
      return prev;
    });
  };

  const handleFilterChange = (key, value) => {
    setSearchParams((prev) => {
      if (value && value !== 'all') prev.set(key, value);
      else prev.delete(key);
      return prev;
    });
  };

  const statusOptions = [
    { value: 'all', label: t('common:filters.all') },
    { value: 'active', label: t('subscriptions:statuses.active') },
    { value: 'paused', label: t('subscriptions:statuses.paused') },
    { value: 'cancelled', label: t('subscriptions:statuses.cancelled') },
  ];

  const typeOptions = [
    { value: 'all', label: t('common:filters.all') },
    ...SUBSCRIPTION_TYPES.map((tp) => ({
      value: tp,
      label: t(`subscriptions:types.${tp}`),
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
      header: t('subscriptions:list.columns.type'),
      accessor: 'subscription_type',
      render: (value) => (
        <Badge variant="outline" size="sm">
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
              onClick={() => navigate('/subscriptions/new')}
              leftIcon={<Plus className="w-4 h-4" />}
              className="shadow-lg shadow-primary-600/20"
            >
              {t('subscriptions:list.addButton')}
            </Button>
          </div>
        }
      />

      <ComplianceAlert />

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={TrendingUp}
            label={t('subscriptions:stats.mrr')}
            value={formatCurrency(stats.mrr || 0)}
            color="text-primary-700 dark:text-primary-300"
          />
          <StatCard
            icon={Users}
            label={t('subscriptions:stats.activeCount')}
            value={stats.active_count || 0}
            color="text-success-600 dark:text-success-400"
          />
          <StatCard
            icon={Pause}
            label={t('subscriptions:stats.pausedCount')}
            value={stats.paused_count || 0}
            color="text-warning-600 dark:text-warning-400"
          />
          <StatCard
            icon={AlertTriangle}
            label={t('subscriptions:stats.overdueCount')}
            value={stats.overdue_count || 0}
            color="text-error-600 dark:text-error-400"
          />
        </div>
      )}

      {/* Filters */}
      <Card className="p-4 border-neutral-200/60 dark:border-neutral-800/60">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <SearchInput
              placeholder={t('subscriptions:list.searchPlaceholder')}
              value={search}
              onChange={handleSearch}
              className="w-full"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 w-full md:w-auto md:min-w-[400px]">
            <Select
              options={statusOptions}
              value={status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              leftIcon={<Filter className="w-4 h-4" />}
            />
            <Select
              options={typeOptions}
              value={type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              leftIcon={<Tag className="w-4 h-4" />}
            />
          </div>
        </div>
      </Card>

      {isLoading ? (
        <SubscriptionsSkeleton />
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
