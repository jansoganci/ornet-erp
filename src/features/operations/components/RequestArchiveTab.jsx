import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Archive } from 'lucide-react';
import { Select } from '../../../components/ui/Select';
import { Spinner } from '../../../components/ui/Spinner';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { useOperationsItems } from '../hooks';
import { REGIONS, CONTACT_STATUSES, PRIORITIES } from '../schema';
import { RequestCard } from './RequestCard';

const ARCHIVE_STATUSES = ['completed', 'closed', 'failed'];

export function RequestArchiveTab() {
  const { t } = useTranslation(['operations', 'common']);

  const [regionFilter, setRegionFilter] = useState('all');
  const [contactFilter, setContactFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const filters = useMemo(
    () => ({
      statusIn: ARCHIVE_STATUSES,
      region: regionFilter,
      contactStatus: contactFilter,
      priority: priorityFilter,
    }),
    [regionFilter, contactFilter, priorityFilter]
  );

  const { data: requests = [], isLoading, isError, refetch } = useOperationsItems(filters);

  const regionOptions = [
    { value: 'all', label: t('operations:filters.allRegions') },
    ...REGIONS.map((r) => ({ value: r, label: t(`operations:regions.${r}`) })),
  ];
  const contactOptions = [
    { value: 'all', label: t('operations:filters.allStatuses') },
    ...CONTACT_STATUSES.map((s) => ({ value: s, label: t(`operations:contactStatus.${s}`) })),
  ];
  const priorityOptions = [
    { value: 'all', label: t('operations:filters.allPriorities') },
    ...PRIORITIES.map((p) => ({ value: p, label: t(`operations:priority.${p}`) })),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Select
          options={regionOptions}
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          wrapperClassName="w-40"
        />
        <Select
          options={contactOptions}
          value={contactFilter}
          onChange={(e) => setContactFilter(e.target.value)}
          wrapperClassName="w-36"
        />
        <Select
          options={priorityOptions}
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          wrapperClassName="w-36"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : isError ? (
        <ErrorState message={t('common:errors.loadFailed')} onRetry={() => refetch()} />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={Archive}
          title={t('operations:archive.empty.title')}
          description={t('operations:archive.empty.description')}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {requests.map((request) => (
            <RequestCard key={request.id} request={request} variant="archive" />
          ))}
        </div>
      )}
    </div>
  );
}
