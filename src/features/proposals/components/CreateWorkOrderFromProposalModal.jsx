import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Button, Input, Select, Spinner, ErrorState } from '../../../components/ui';
import { useProposalItems, proposalKeys } from '../hooks';
import { useCreateWorkOrderFromProposal } from '../../workOrders/hooks';
import { WorkerSelector } from '../../workOrders/WorkerSelector';
import { useQueryClient } from '@tanstack/react-query';
import { WORK_TYPES } from '../../workOrders/schema';
import { getCurrencySymbol } from '../../../lib/utils';

export function CreateWorkOrderFromProposalModal({ open, onClose, proposal, onSuccess }) {
  const { t } = useTranslation(['proposals', 'common']);
  const queryClient = useQueryClient();
  const [workType, setWorkType] = useState('installation');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [assignedTo, setAssignedTo] = useState([]);

  const { data: items = [], isLoading: itemsLoading, error: itemsError, refetch: refetchItems } = useProposalItems(proposal?.id);
  const createMutation = useCreateWorkOrderFromProposal();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!proposal?.id || !proposal?.site_id) return;
    try {
      const result = await createMutation.mutateAsync({
        proposalId: proposal.id,
        siteId: proposal.site_id,
        workType,
        scheduledDate: scheduledDate || null,
        scheduledTime: scheduledTime || null,
        assignedTo,
        amount: proposal.total_amount ?? proposal.total_amount_usd ?? null,
        currency: proposal.currency ?? 'TRY',
        materialsDiscountPercent: proposal.materials_discount_percent ?? proposal.discount_percent ?? 0,
        description: proposal.title ?? null,
        notes: proposal.notes ?? null,
        items,
      });
      queryClient.invalidateQueries({ queryKey: proposalKeys.detail(proposal.id) });
      queryClient.invalidateQueries({ queryKey: proposalKeys.workOrders(proposal.id) });
      onSuccess?.(result?.id);
      onClose();
    } catch {
      // Toast handled by hook
    }
  };

  const workTypeOptions = WORK_TYPES.map((value) => ({
    value,
    label: t(`common:workType.${value}`),
  }));

  const currencySymbol = getCurrencySymbol(proposal?.currency ?? 'TRY');
  const amountDisplay = proposal?.total_amount != null
    ? proposal.total_amount
    : proposal?.total_amount_usd;

  const content = () => {
    if (itemsLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <Spinner size="lg" />
          <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
            {t('createWorkOrder.loadingItems')}
          </p>
        </div>
      );
    }

    if (itemsError) {
      return (
        <ErrorState
          message={itemsError?.message || t('common:errors.loadFailed')}
          onRetry={refetchItems}
        />
      );
    }

    return (
      <form id="create-wo-from-proposal-form" onSubmit={handleSubmit} className="space-y-6">
        {/* Read-only summary */}
        <div className="rounded-xl bg-neutral-50 dark:bg-[#1a1a1a] p-4 space-y-2 text-sm">
          {(proposal?.company_name || proposal?.site_name) && (
            <p className="font-medium text-neutral-900 dark:text-neutral-50">
              {[proposal.company_name, proposal.site_name].filter(Boolean).join(' · ')}
            </p>
          )}
          <p className="text-neutral-600 dark:text-neutral-400">
            {t('createWorkOrder.itemsCount', { count: items.length })}
          </p>
          {amountDisplay != null && (
            <p className="font-semibold text-neutral-900 dark:text-neutral-50">
              {currencySymbol} {Number(amountDisplay).toLocaleString('tr-TR')}
            </p>
          )}
        </div>

        {/* User inputs */}
        <Select
          label={t('createWorkOrder.workTypeLabel')}
          options={workTypeOptions}
          value={workType}
          onChange={(e) => setWorkType(e.target.value)}
          required
        />
        <Input
          label={t('createWorkOrder.scheduledDate')}
          type="date"
          value={scheduledDate}
          onChange={(e) => setScheduledDate(e.target.value)}
        />
        <Input
          label={t('createWorkOrder.scheduledTime')}
          type="time"
          value={scheduledTime}
          onChange={(e) => setScheduledTime(e.target.value)}
        />
        <WorkerSelector
          value={assignedTo}
          onChange={setAssignedTo}
        />
      </form>
    );
  };

  const isSubmitting = createMutation.isPending;
  const canSubmit = !itemsLoading && !itemsError && proposal?.site_id;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('createWorkOrder.title')}
      size="lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t('common:actions.cancel')}
          </Button>
          <Button
            type="submit"
            form="create-wo-from-proposal-form"
            variant="primary"
            loading={isSubmitting}
            disabled={!canSubmit || isSubmitting}
          >
            {t('createWorkOrder.submit')}
          </Button>
        </>
      }
    >
      {content()}
    </Modal>
  );
}
