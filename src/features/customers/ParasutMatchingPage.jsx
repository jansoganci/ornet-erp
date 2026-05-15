import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageContainer, PageHeader } from '../../components/layout';
import { Badge, Button, Card, EmptyState, Select, Spinner } from '../../components/ui';
import { useRole } from '../../lib/roles';
import {
  useAcceptMatch,
  useMatchCandidates,
  useRejectMatch,
  useRunBulkMatch,
} from './parasutMatchingHooks';

const STATUS_OPTIONS = [
  { value: 'pending', labelKey: 'parasutMatching.filters.pending' },
  { value: 'accepted', labelKey: 'parasutMatching.filters.accepted' },
  { value: 'rejected', labelKey: 'parasutMatching.filters.rejected' },
  { value: 'all', labelKey: 'parasutMatching.filters.all' },
];

export function ParasutMatchingPage() {
  const { t } = useTranslation(['customers', 'common']);
  const { isAdmin } = useRole();
  const [status, setStatus] = useState('pending');
  const { data: candidates = [], isLoading } = useMatchCandidates(status);
  const runBulkMatch = useRunBulkMatch();
  const acceptMatch = useAcceptMatch();
  const rejectMatch = useRejectMatch();

  if (!isAdmin) {
    return (
      <PageContainer>
        <EmptyState title={t('common:errors.forbidden')} />
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="6xl" padding="default">
      <PageHeader
        title={t('customers:parasutMatching.title')}
        description={t('customers:parasutMatching.description')}
        actions={
          <Button
            type="button"
            variant="primary"
            leftIcon={<RefreshCw className="h-4 w-4" />}
            loading={runBulkMatch.isPending}
            onClick={() => runBulkMatch.mutate()}
          >
            {t('customers:parasutMatching.runBulkMatch')}
          </Button>
        }
      />

      <div className="mt-6 max-w-xs">
        <Select
          label={t('customers:parasutMatching.statusFilter')}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          options={STATUS_OPTIONS.map((option) => ({
            value: option.value,
            label: t(`customers:${option.labelKey}`),
          }))}
        />
      </div>

      <Card className="mt-6 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : candidates.length === 0 ? (
          <EmptyState
            title={t('customers:parasutMatching.emptyTitle')}
            description={t('customers:parasutMatching.emptyDescription')}
          />
        ) : (
          <div className="divide-y divide-neutral-200 dark:divide-[#262626]">
            {candidates.map((candidate) => (
              <div key={candidate.id} className="grid gap-4 p-4 lg:grid-cols-[1fr_1fr_auto] lg:items-center">
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    {t('customers:parasutMatching.ornetCustomer')}
                  </p>
                  <Link
                    to={`/customers/${candidate.customer_id}`}
                    className="font-medium text-neutral-900 hover:underline dark:text-neutral-50"
                  >
                    {candidate.customers?.company_name || '-'}
                  </Link>
                  <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                    {candidate.customers?.tax_number || '-'} · {candidate.customers?.identity_type || '-'}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    {t('customers:parasutMatching.parasutContact')}
                  </p>
                  <p className="font-medium text-neutral-900 dark:text-neutral-50">
                    {candidate.parasut_contact_name || candidate.parasut_contact_id}
                  </p>
                  <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                    {candidate.parasut_tax_number || '-'} · {candidate.parasut_contact_id}
                  </p>
                </div>

                <div className="flex items-center gap-2 lg:justify-end">
                  <Badge variant={candidate.match_type === 'name_only' ? 'warning' : 'success'}>
                    {t(`customers:parasutMatching.matchTypes.${candidate.match_type}`)}
                  </Badge>
                  {candidate.status === 'pending' && (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        leftIcon={<Check className="h-4 w-4" />}
                        loading={acceptMatch.isPending}
                        onClick={() => acceptMatch.mutate(candidate)}
                      >
                        {t('common:actions.accept')}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        leftIcon={<X className="h-4 w-4" />}
                        loading={rejectMatch.isPending}
                        onClick={() => rejectMatch.mutate(candidate.id)}
                      >
                        {t('common:actions.reject')}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
