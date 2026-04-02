import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardList, PhoneCall } from 'lucide-react';
import { Select } from '../../../components/ui/Select';
import { Spinner } from '../../../components/ui/Spinner';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Button } from '../../../components/ui/Button';
import { useOperationsItems, useDeleteOperationsItem, useCloseOperationsItem } from '../hooks';
import { CloseOutcomeModal } from './CloseOutcomeModal';
import { REGIONS, CONTACT_STATUSES, PRIORITIES } from '../schema';
import { QuickEntryRow } from './QuickEntryRow';
import { RequestCard } from './RequestCard';
import { CallQueueModal } from './CallQueueModal';

export function RequestPoolTab() {
  const { t } = useTranslation(['operations', 'common']);

  const [regionFilter, setRegionFilter] = useState('all');
  const [contactFilter, setContactFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [showCallQueue, setShowCallQueue] = useState(false);
  /** Lifted from RequestCard so the modal is not unmounted when the list re-renders / refetches. */
  const [closeOutcomeItemId, setCloseOutcomeItemId] = useState(null);
  const closeOutcomeMutation = useCloseOperationsItem();

  const filters = useMemo(() => ({
    statusIn: ['open', 'scheduled'],
    region: regionFilter,
    contactStatus: contactFilter,
    priority: priorityFilter,
  }), [regionFilter, contactFilter, priorityFilter]);

  const { data: requests = [], isLoading, isError, refetch } = useOperationsItems(filters);

  const deleteMutation = useDeleteOperationsItem();

  const handleDelete = (id) => {
    if (window.confirm(t('operations:delete.message'))) {
      deleteMutation.mutate(id);
    }
  };

  // Count not_contacted for call queue badge
  const notContactedCount = requests.filter((r) => r.contact_status === 'not_contacted' || r.contact_status === 'no_answer').length;

  const regionOptions = [
    { value: 'all', label: t('operations:filters.allRegions') },
    ...REGIONS.map((r) => ({ value: r, label: t(`operations:regions.${r}`) })),
  ];
  const contactOptions = [
    { value: 'all', label: t('operations:filters.allStatuses') },
    ...CONTACT_STATUSES.filter((s) => s !== 'cancelled').map((s) => ({ value: s, label: t(`operations:contactStatus.${s}`) })),
  ];
  const priorityOptions = [
    { value: 'all', label: t('operations:filters.allPriorities') },
    ...PRIORITIES.map((p) => ({ value: p, label: t(`operations:priority.${p}`) })),
  ];

  return (
    <div className="space-y-4">
      {/* Quick Entry */}
      <QuickEntryRow />

      {/* Filter Bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select options={regionOptions} value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)} wrapperClassName="w-40" />
        <Select options={contactOptions} value={contactFilter} onChange={(e) => setContactFilter(e.target.value)} wrapperClassName="w-36" />
        <Select options={priorityOptions} value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} wrapperClassName="w-36" />

        <div className="ml-auto">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<PhoneCall className="w-4 h-4" />}
            onClick={() => setShowCallQueue(true)}
            disabled={notContactedCount === 0}
          >
            {t('operations:actions.callQueue')}
            {notContactedCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-error-500 rounded-full">
                {notContactedCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Request List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : isError ? (
        <ErrorState message={t('common:errors.loadFailed')} onRetry={refetch} />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={t('operations:empty.title')}
          description={t('operations:empty.description')}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {requests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              onDelete={handleDelete}
              onOpenCloseOutcome={() => setCloseOutcomeItemId(request.id)}
            />
          ))}
        </div>
      )}

      {/* Call Queue Modal */}
      {showCallQueue && (
        <CallQueueModal
          requests={requests.filter((r) => r.contact_status === 'not_contacted' || r.contact_status === 'no_answer')}
          onClose={() => setShowCallQueue(false)}
        />
      )}

      <CloseOutcomeModal
        open={closeOutcomeItemId != null}
        onClose={() => setCloseOutcomeItemId(null)}
        onConfirm={async ({ outcomeType, contactNotes }) => {
          if (!closeOutcomeItemId) return false;
          await closeOutcomeMutation.mutateAsync({
            id: closeOutcomeItemId,
            outcomeType,
            contactNotes,
          });
          setCloseOutcomeItemId(null);
        }}
        isSubmitting={closeOutcomeMutation.isPending}
      />
    </div>
  );
}
