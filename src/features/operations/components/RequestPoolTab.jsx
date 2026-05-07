import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardList, PhoneCall, RotateCcw } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { Select } from '../../../components/ui/Select';
import { Spinner } from '../../../components/ui/Spinner';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Button } from '../../../components/ui/Button';
import { useOperationsItems, useDeleteOperationsItem, useCloseOperationsItem } from '../hooks';
import { CloseOutcomeModal } from './CloseOutcomeModal';
import { BoomerangModal } from './BoomerangModal';
import { REGIONS, CONTACT_STATUSES, PRIORITIES } from '../schema';
import { QuickEntryRow } from './QuickEntryRow';
import { RequestCard } from './RequestCard';
import { CallQueueModal } from './CallQueueModal';

export function RequestPoolTab() {
  const { t } = useTranslation(['operations', 'common']);

  const [regionFilter, setRegionFilter] = useState('all');
  const [contactFilter, setContactFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [rescheduledOnly, setRescheduledOnly] = useState(false);
  const [showCallQueue, setShowCallQueue] = useState(false);

  /** Lifted so modals are not unmounted when the list re-renders / refetches. */
  const [closeOutcomeItemId, setCloseOutcomeItemId] = useState(null);
  const [boomerangItemId, setBoomerangItemId] = useState(null);

  const closeOutcomeMutation = useCloseOperationsItem();

  const filters = useMemo(
    () => ({
      statusIn: ['open', 'scheduled'],
      region: regionFilter,
      contactStatus: contactFilter,
      priority: priorityFilter,
    }),
    [regionFilter, contactFilter, priorityFilter]
  );

  const { data: allRequests = [], isLoading, isError, refetch } = useOperationsItems(filters);

  // Client-side filter for rescheduled items (reschedule_count > 0)
  const requests = useMemo(
    () => (rescheduledOnly ? allRequests.filter((r) => (r.reschedule_count ?? 0) > 0) : allRequests),
    [allRequests, rescheduledOnly]
  );

  const deleteMutation = useDeleteOperationsItem();

  const handleDelete = (id) => {
    if (window.confirm(t('operations:delete.message'))) {
      deleteMutation.mutate(id);
    }
  };

  const notContactedCount = allRequests.filter(
    (r) => r.contact_status === 'not_contacted' || r.contact_status === 'no_answer'
  ).length;

  const rescheduledCount = allRequests.filter((r) => (r.reschedule_count ?? 0) > 0).length;

  const regionOptions = [
    { value: 'all', label: t('operations:filters.allRegions') },
    ...REGIONS.map((r) => ({ value: r, label: t(`operations:regions.${r}`) })),
  ];
  const contactOptions = [
    { value: 'all', label: t('operations:filters.allStatuses') },
    ...CONTACT_STATUSES.filter((s) => s !== 'cancelled').map((s) => ({
      value: s,
      label: t(`operations:contactStatus.${s}`),
    })),
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

        {/* Rescheduled filter chip */}
        <button
          type="button"
          onClick={() => setRescheduledOnly((v) => !v)}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
            rescheduledOnly
              ? 'bg-warning-100 border-warning-400 text-warning-800 dark:bg-warning-900/30 dark:border-warning-600 dark:text-warning-300'
              : 'bg-white dark:bg-[#171717] border-neutral-300 dark:border-neutral-600 text-neutral-600 dark:text-neutral-400 hover:border-warning-400 hover:text-warning-700 dark:hover:border-warning-600 dark:hover:text-warning-400'
          )}
        >
          <RotateCcw className="w-3 h-3" />
          {t('operations:filters.rescheduledOnly')}
          {rescheduledCount > 0 && (
            <span
              className={cn(
                'inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold',
                rescheduledOnly
                  ? 'bg-warning-500 text-white'
                  : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400'
              )}
            >
              {rescheduledCount}
            </span>
          )}
        </button>

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
              onOpenBoomerang={() => setBoomerangItemId(request.id)}
            />
          ))}
        </div>
      )}

      {/* Call Queue Modal */}
      {showCallQueue && (
        <CallQueueModal
          requests={allRequests.filter(
            (r) => r.contact_status === 'not_contacted' || r.contact_status === 'no_answer'
          )}
          onClose={() => setShowCallQueue(false)}
        />
      )}

      {/* Close Outcome Modal — lifted to avoid unmount on list refetch */}
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

      {/* Boomerang Modal — lifted to avoid unmount on list refetch */}
      <BoomerangModal
        open={boomerangItemId != null}
        itemId={boomerangItemId}
        onClose={() => setBoomerangItemId(null)}
      />
    </div>
  );
}
