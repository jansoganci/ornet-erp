import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Building2, DollarSign } from 'lucide-react';
import { useProposals } from './hooks';
import { PageContainer, PageHeader } from '../../components/layout';
import {
  Button,
  SearchInput,
  Select,
  Card,
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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <Card key={i} className="p-4 space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-5 w-full" />
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export function ProposalsListPage() {
  const { t } = useTranslation('proposals');
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const { data: proposals, isLoading, error, refetch } = useProposals({ search, status });

  const statusOptions = STATUS_OPTIONS.map((opt) => ({
    value: opt.value,
    label: t(opt.labelKey),
  }));

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
      <div className="flex flex-col sm:flex-row gap-3 mb-6 mt-6">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t('list.searchPlaceholder')}
          className="flex-1 max-w-md"
        />
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={statusOptions}
          placeholder={t('filters.allStatuses')}
          className="w-full sm:w-48"
        />
      </div>

      {isLoading && <ListSkeleton />}

      {error && (
        <ErrorState
          message={error.message}
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !error && proposals?.length === 0 && (
        <EmptyState
          title={search || status ? t('list.noResults.title') : t('list.empty.title')}
          description={search || status ? t('list.noResults.description') : t('list.empty.description')}
          actionLabel={!search && !status ? t('list.addButton') : null}
          onAction={!search && !status ? () => navigate('/proposals/new') : null}
        />
      )}

      {!isLoading && !error && proposals?.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {proposals.map((proposal) => (
            <Card
              key={proposal.id}
              variant="interactive"
              onClick={() => navigate(`/proposals/${proposal.id}`)}
              className="p-4"
            >
              {/* Company + Site */}
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-4 h-4 text-neutral-400 shrink-0" />
                <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400 truncate">
                  {proposal.customer_company_name ?? proposal.company_name ?? '—'}
                  {proposal.site_name && (
                    <span className="text-neutral-400 dark:text-neutral-500"> / {proposal.site_name}</span>
                  )}
                </span>
              </div>

              {/* Title */}
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-50 mb-3 line-clamp-2">
                {proposal.title}
              </h3>

              {/* Bottom row: amount, status, date */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-neutral-400" />
                    {formatCurrency(proposal.total_amount ?? proposal.total_amount_usd, proposal.currency ?? 'USD')}
                  </span>
                </div>
                <ProposalStatusBadge status={proposal.status} size="sm" />
              </div>

              <div className="mt-2 text-xs text-neutral-400">
                {formatDate(proposal.created_at)}
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
