import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Users as UsersIcon, MapPin, Briefcase, FileText, Building2, Upload, Calendar, Radio } from 'lucide-react';
import { format } from 'date-fns';
import { useSearchInput } from '../../hooks/useSearchInput';
import { useCustomers } from './hooks';
import { useAllSites } from '../customerSites/hooks';
import { PageContainer, PageHeader } from '../../components/layout';
import { Button, SearchInput, Table, Badge, EmptyState, ErrorState } from '../../components/ui';
import { formatPhone, cn } from '../../lib/utils';
import { useRole } from '../../lib/roles';

export function CustomersListPage() {
  const { t } = useTranslation('customers');
  const navigate = useNavigate();
  const { isFieldWorker, canWrite } = useRole();
  const { search, setSearch, debouncedSearch } = useSearchInput({ debounceMs: 300 });
  const [view, setView] = useState('customers');

  const { data: customers, isLoading: customersLoading, error: customersError, refetch: customersRefetch } = useCustomers({ search: debouncedSearch });
  const { data: sites, isLoading: sitesLoading, error: sitesError, refetch: sitesRefetch } = useAllSites({ search: debouncedSearch, enabled: view === 'sites' });

  const isLoading = view === 'customers' ? customersLoading : sitesLoading;
  const error = view === 'customers' ? customersError : sitesError;
  const refetch = view === 'customers' ? customersRefetch : sitesRefetch;

  const handleCustomerClick = (customer) => {
    navigate(`/customers/${customer.id}`);
  };

  const handleSiteClick = (site) => {
    navigate(`/customers/${site.customer_id}`);
  };

  const handleAddCustomer = () => {
    navigate('/customers/new');
  };

  const handleImport = () => {
    navigate('/customers/import');
  };

  const allColumns = [
    {
      key: 'name',
      header: t('list.columns.name'),
      cellClassName: 'whitespace-normal',
      render: (_, customer) => (
        <div>
          <p className="font-medium text-neutral-900 dark:text-neutral-50 max-w-[200px] break-words">{customer.company_name}</p>
          {customer.subscriber_title && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 truncate max-w-[220px]" title={customer.subscriber_title}>
              {customer.subscriber_title}
            </p>
          )}
          {customer.account_number && (
            <Badge variant="outline" size="sm" className="mt-1 font-mono">
              {customer.account_number}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'contact',
      header: t('list.columns.contact'),
      render: (_, customer) => (
        <div>
          <p>{customer.phone ? formatPhone(customer.phone) : '-'}</p>
          <p className="text-xs text-muted-foreground truncate">{customer.email || ''}</p>
        </div>
      ),
    },
    {
      key: 'city',
      header: t('list.columns.city'),
      render: (_, customer) => (
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <span className="text-neutral-900 dark:text-neutral-50">
            {customer.city || '-'}
          </span>
        </div>
      ),
    },
    {
      key: 'site_count',
      header: t('list.columns.siteCount'),
      fieldWorkerHidden: true,
      render: (_, customer) => (
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold">{customer.site_count ?? 0}</span>
        </div>
      ),
    },
    {
      key: 'active_subscriptions_count',
      header: t('list.columns.activeSubscriptions'),
      fieldWorkerHidden: true,
      render: (_, customer) => (
        <div className="flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold">{customer.active_subscriptions_count ?? 0}</span>
        </div>
      ),
    },
    {
      key: 'open_work_orders_count',
      header: t('list.columns.openWorkOrders'),
      fieldWorkerHidden: true,
      render: (_, customer) => (
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold">{customer.open_work_orders_count ?? 0}</span>
        </div>
      ),
    },
  ];

  const columns = isFieldWorker
    ? allColumns.filter((col) => !col.fieldWorkerHidden)
    : allColumns;

  const siteColumns = [
    {
      key: 'site_name',
      header: t('list.siteColumns.customer'),
      cellClassName: 'whitespace-normal',
      render: (_, site) => (
        <div>
          <p className="font-medium text-neutral-900 dark:text-neutral-50 max-w-[200px] break-words">{site.customers?.company_name || '-'}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 truncate max-w-[220px]" title={site.site_name}>
            {site.site_name || '-'}
          </p>
          {site.account_no && (
            <Badge variant="outline" size="sm" className="mt-1 font-mono">
              {site.account_no}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'alarm_center',
      header: t('list.siteColumns.alarmCenter'),
      render: (_, site) => (
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-muted-foreground" />
          <span className="text-neutral-900 dark:text-neutral-50">{site.alarm_center || '-'}</span>
        </div>
      ),
    },
    {
      key: 'city',
      header: t('list.siteColumns.city'),
      render: (_, site) => (
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-muted-foreground" />
          <span className="text-neutral-900 dark:text-neutral-50">
            {[site.city, site.district].filter(Boolean).join(' / ') || '-'}
          </span>
        </div>
      ),
    },
    {
      key: 'connection_date',
      header: t('list.siteColumns.connectionDate'),
      render: (_, site) => (
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="text-neutral-900 dark:text-neutral-50">
            {site.connection_date
              ? format(new Date(site.connection_date), 'dd.MM.yyyy')
              : '-'}
          </span>
        </div>
      ),
    },
  ];

  return (
    <PageContainer maxWidth="full" padding="default">
      {/* Header */}
      <PageHeader
        title={t('list.title')}
        actions={
          canWrite && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                leftIcon={<Upload className="w-5 h-5" />}
                onClick={handleImport}
              >
                {t('list.importButton')}
              </Button>
              <Button
                variant="primary"
                leftIcon={<Plus className="w-5 h-5" />}
                onClick={handleAddCustomer}
              >
                {t('list.addButton')}
              </Button>
            </div>
          )
        }
      />

      {/* View Toggle + Search + Count */}
      <div className="mb-6 mt-6 flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Toggle */}
        <div className="flex items-center border border-neutral-200 dark:border-neutral-700 rounded-lg p-0.5 bg-neutral-50 dark:bg-neutral-800 shrink-0">
          <button
            onClick={() => setView('customers')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              view === 'customers'
                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-50 shadow-sm'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
            )}
          >
            <UsersIcon className="w-4 h-4" />
            {t('list.views.customers')}
          </button>
          <button
            onClick={() => setView('sites')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              view === 'sites'
                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-50 shadow-sm'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
            )}
          >
            <MapPin className="w-4 h-4" />
            {t('list.views.sites')}
          </button>
        </div>

        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t('list.searchPlaceholder')}
          className="max-w-md"
        />

        {!isLoading && (
          <span className="text-sm text-neutral-500 dark:text-neutral-400 shrink-0">
            {view === 'customers'
              ? customers != null && t('list.count', { count: customers.length })
              : sites != null && t('list.siteCount', { count: sites.length })}
          </span>
        )}
      </div>

      {/* Error State */}
      {error && !isLoading && (
        <ErrorState
          message={error.message}
          onRetry={() => refetch()}
        />
      )}

      {/* Table — always mounted so SearchInput keeps focus */}
      {!error && (
        view === 'customers' ? (
          <Table
            columns={columns}
            data={customers || []}
            loading={isLoading}
            onRowClick={handleCustomerClick}
            emptyState={
              <EmptyState
                icon={debouncedSearch ? null : UsersIcon}
                title={debouncedSearch ? t('list.noResults.title') : t('list.empty.title')}
                description={debouncedSearch ? t('list.noResults.description') : t('list.empty.description')}
                actionLabel={debouncedSearch ? null : t('list.empty.action')}
                onAction={debouncedSearch ? null : handleAddCustomer}
              />
            }
          />
        ) : (
          <Table
            columns={siteColumns}
            data={sites || []}
            loading={isLoading}
            onRowClick={handleSiteClick}
            emptyState={
              <EmptyState
                icon={debouncedSearch ? null : MapPin}
                title={debouncedSearch ? t('list.noResults.title') : t('list.empty.title')}
                description={debouncedSearch ? t('list.noResults.description') : t('list.empty.description')}
              />
            }
          />
        )
      )}
    </PageContainer>
  );
}
