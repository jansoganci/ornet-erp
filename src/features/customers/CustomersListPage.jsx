import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Phone, Mail, MapPin, Users as UsersIcon } from 'lucide-react';
import { useCustomers } from './hooks';
import { PageContainer, PageHeader } from '../../components/layout';
import { Button, SearchInput, Card, Spinner, Badge, EmptyState, Skeleton, ErrorState } from '../../components/ui';
import { formatPhone } from '../../lib/utils';

function CustomersSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <Card key={i} className="p-4 space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export function CustomersListPage() {
  const { t } = useTranslation('customers');
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data: customers, isLoading, error, refetch } = useCustomers({ search });

  const handleCustomerClick = (customer) => {
    navigate(`/customers/${customer.id}`);
  };

  const handleAddCustomer = () => {
    navigate('/customers/new');
  };

  return (
    <PageContainer maxWidth="xl" padding="default">
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

      {/* Loading State */}
      {isLoading && <CustomersSkeleton />}

      {/* Error State */}
      {error && (
        <ErrorState
          message={error.message}
          onRetry={() => refetch()}
        />
      )}

      {/* Empty State */}
      {!isLoading && !error && customers?.length === 0 && (
        <EmptyState
          icon={search ? null : UsersIcon}
          title={search ? t('list.noResults.title') : t('list.empty.title')}
          description={search ? t('list.noResults.description') : t('list.empty.description')}
          actionLabel={search ? null : t('list.empty.action')}
          onAction={search ? null : handleAddCustomer}
        />
      )}

      {/* Customer List */}
      {!isLoading && !error && customers?.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {customers.map((customer) => (
            <Card
              key={customer.id}
              variant="interactive"
              onClick={() => handleCustomerClick(customer)}
              className="p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-medium text-neutral-900 dark:text-neutral-50">
                    {customer.name}
                  </h3>
                  <Badge variant="default" size="sm" className="mt-1">
                    {customer.account_number}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
                {customer.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-neutral-400 dark:text-neutral-500" />
                    <span>{formatPhone(customer.phone)}</span>
                  </div>
                )}
                {customer.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-neutral-400 dark:text-neutral-500" />
                    <span className="truncate">{customer.email}</span>
                  </div>
                )}
                {(customer.city || customer.district) && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-neutral-400 dark:text-neutral-500" />
                    <span>
                      {[customer.district, customer.city]
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
