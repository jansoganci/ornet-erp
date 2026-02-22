import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Users as UsersIcon, MapPin, Briefcase, FileText, Building2 } from 'lucide-react';
import { useSearchInput } from '../../hooks/useSearchInput';
import { useCustomers } from './hooks';
import { PageContainer, PageHeader } from '../../components/layout';
import { Button, SearchInput, Table, Badge, EmptyState, ErrorState, TableSkeleton } from '../../components/ui';
import { formatPhone } from '../../lib/utils';

export function CustomersListPage() {
  const { t } = useTranslation('customers');
  const navigate = useNavigate();
  const { search, setSearch, debouncedSearch } = useSearchInput({ debounceMs: 300 });

  const { data: customers, isLoading, error, refetch } = useCustomers({ search: debouncedSearch });

  const handleCustomerClick = (customer) => {
    navigate(`/customers/${customer.id}`);
  };

  const handleAddCustomer = () => {
    navigate('/customers/new');
  };

  const columns = [
    {
      key: 'name',
      header: t('list.columns.name'),
      render: (_, customer) => (
        <div>
          <p className="font-medium text-neutral-900 dark:text-neutral-50">{customer.company_name}</p>
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
      render: (_, customer) => (
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold">{customer.open_work_orders_count ?? 0}</span>
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
          <Button
            variant="primary"
            leftIcon={<Plus className="w-5 h-5" />}
            onClick={handleAddCustomer}
          >
            {t('list.addButton')}
          </Button>
        }
      />

      {/* Search */}
      <div className="mb-6 mt-6">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t('list.searchPlaceholder')}
          className="max-w-md"
        />
      </div>

      {/* Error State */}
      {error && !isLoading && (
        <ErrorState
          message={error.message}
          onRetry={() => refetch()}
        />
      )}

      {/* Customer Table — always mounted so SearchInput keeps focus */}
      {!error && (
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
      )}
    </PageContainer>
  );
}
