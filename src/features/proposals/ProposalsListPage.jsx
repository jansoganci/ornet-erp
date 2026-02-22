import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Building2, Calendar } from 'lucide-react';
import { useSearchInput } from '../../hooks/useSearchInput';
import { useProposals } from './hooks';
import { PageContainer, PageHeader } from '../../components/layout';
import {
  Button,
  SearchInput,
  Select,
  Card,
  Table,
  Badge,
  Spinner,
  Skeleton,
  EmptyState,
  ErrorState,
} from '../../components/ui';
import { formatDate, formatCurrency } from '../../lib/utils';
import { ProposalStatusBadge } from './components/ProposalStatusBadge';

const STATUS_OPTIONS = [
  { value: '', labelKey: 'filters.allStatuses' },
  { value: 'draft', labelKey: 'status.draft' },
  { value: 'sent', labelKey: 'status.sent' },
  { value: 'accepted', labelKey: 'status.accepted' },
  { value: 'rejected', labelKey: 'status.rejected' },
  { value: 'cancelled', labelKey: 'status.cancelled' },
];

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
  const { search, setSearch, debouncedSearch } = useSearchInput({ debounceMs: 300 });
  const [status, setStatus] = useState('');

  const { data: proposals, isLoading, error, refetch } = useProposals({ search: debouncedSearch, status });

  const statusOptions = STATUS_OPTIONS.map((opt) => ({
    value: opt.value,
    label: t(opt.labelKey),
  }));

  const columns = [
    {
      header: t('list.columns.customer'),
      accessor: 'customer_company_name',
      render: (value, row) => (
        <div className="min-w-[150px]">
          <p className="font-medium text-neutral-900 dark:text-neutral-50 truncate">
            {value ?? row.company_name ?? '—'}
          </p>
          {row.site_name && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
              {row.site_name}
            </p>
          )}
        </div>
      ),
    },
    {
      header: t('list.columns.createdAt'),
      accessor: 'created_at',
      render: (value) => (
        <div className="text-sm text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
          {value ? formatDate(value) : '-'}
        </div>
      ),
    },
    {
      header: t('list.columns.city'),
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
      header: t('list.columns.title'),
      accessor: 'title',
      render: (value) => (
        <div className="min-w-[200px] max-w-[400px]">
          <p className="font-medium text-neutral-900 dark:text-neutral-50 whitespace-normal break-words">
            {value || '—'}
          </p>
        </div>
      ),
    },
    {
      header: t('list.columns.amount'),
      accessor: 'total_amount',
      align: 'right',
      render: (value, row) => (
        <div className="text-right">
          <span className="font-bold text-neutral-900 dark:text-neutral-100">
            {value || row.total_amount_usd
              ? formatCurrency(value ?? row.total_amount_usd, row.currency ?? 'USD')
              : '-'}
          </span>
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
    <PageContainer maxWidth="xl" padding="default">
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

      {/* Filters */}
      <Card className="p-4 border-neutral-200/60 dark:border-neutral-800/60">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={t('list.searchPlaceholder')}
              className="w-full"
            />
          </div>
          <div className="w-full md:w-48">
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={statusOptions}
              placeholder={t('filters.allStatuses')}
              className="w-full"
            />
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
          title={debouncedSearch || status ? t('list.noResults.title') : t('list.empty.title')}
          description={debouncedSearch || status ? t('list.noResults.description') : t('list.empty.description')}
          actionLabel={!debouncedSearch && !status ? t('list.addButton') : null}
          onAction={!debouncedSearch && !status ? () => navigate('/proposals/new') : null}
        />
      )}

      {!isLoading && !error && proposals?.length > 0 && (
        <Table
          columns={columns}
          data={proposals}
          loading={isLoading}
          onRowClick={(row) => navigate(`/proposals/${row.id}`)}
        />
      )}
    </PageContainer>
  );
}
