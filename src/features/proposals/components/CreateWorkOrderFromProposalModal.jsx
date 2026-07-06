import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Modal, Button, Input, Select } from '../../../components/ui';
import { WorkerSelector } from '../../workOrders/WorkerSelector';
import { WORK_TYPES } from '../../workOrders/schema';

export function CreateWorkOrderFromProposalModal({ open, onClose, proposal }) {
  const navigate = useNavigate();
  const { t } = useTranslation(['proposals', 'common']);
  const [workType, setWorkType] = useState('installation');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [assignedTo, setAssignedTo] = useState([]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!proposal?.id) return;

    const params = new URLSearchParams({
      mode: 'linked',
      proposalId: proposal.id,
    });

    if (proposal.customer_id) params.set('customerId', proposal.customer_id);
    if (proposal.site_id) params.set('siteId', proposal.site_id);
    if (proposal.title) params.set('description', proposal.title);
    if (workType) params.set('workType', workType);
    if (scheduledDate) params.set('date', scheduledDate);
    if (scheduledTime) params.set('time', scheduledTime);
    if (assignedTo.length > 0) params.set('assignedTo', assignedTo.join(','));

    onClose();
    navigate(`/work-orders/new?${params.toString()}`);
  };

  const workTypeOptions = WORK_TYPES.map((value) => ({
    value,
    label: t(`common:workType.${value}`),
  }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('createWorkOrder.title')}
      size="lg"
      footer={(
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('common:actions.cancel')}
          </Button>
          <Button
            type="submit"
            form="create-wo-from-proposal-form"
            variant="primary"
            disabled={!proposal?.id}
          >
            {t('createWorkOrder.submit')}
          </Button>
        </>
      )}
    >
      <form id="create-wo-from-proposal-form" onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl bg-neutral-50 p-4 text-sm dark:bg-[#1a1a1a]">
          <p className="font-medium text-neutral-900 dark:text-neutral-50">
            {[proposal?.proposal_no, proposal?.title].filter(Boolean).join(' · ')}
          </p>
          <p className="mt-1 text-neutral-600 dark:text-neutral-400">
            {[
              proposal?.customer_company_name || proposal?.company_name,
              proposal?.site_name,
            ].filter(Boolean).join(' · ')}
          </p>
          <p className="mt-3 text-neutral-500 dark:text-neutral-400">
            {t('createWorkOrder.redirectHint')}
          </p>
        </div>

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
    </Modal>
  );
}
