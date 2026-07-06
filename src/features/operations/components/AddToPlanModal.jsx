import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Modal, Select, Textarea } from '../../../components/ui';
import { PLAN_ITEM_TYPES } from '../schema';
import { useCreatePlanItem } from '../planItemsHooks';

const todayIso = () => new Date().toISOString().slice(0, 10);

export function AddToPlanModal({ open, onClose, item }) {
  const { t } = useTranslation(['operations', 'common']);
  const createPlanItem = useCreatePlanItem();
  const [planDate, setPlanDate] = useState(todayIso());
  const [notes, setNotes] = useState('');
  const [itemType, setItemType] = useState('office');

  const handleClose = () => {
    setPlanDate(todayIso());
    setNotes('');
    setItemType('office');
    onClose();
  };

  const handleSubmit = async () => {
    if (!planDate || !item) return;

    await createPlanItem.mutateAsync({
      plan_date: planDate,
      description: item.description,
      notes: notes.trim() || null,
      item_type: itemType,
      operations_item_id: item.id,
    });

    handleClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('operations:addToPlan.title')}
      footer={(
        <>
          <Button type="button" variant="outline" onClick={handleClose}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="button" onClick={handleSubmit} loading={createPlanItem.isPending}>
            {t('operations:addToPlan.confirm')}
          </Button>
        </>
      )}
    >
      <div className="space-y-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            {t('operations:addToPlan.sourceLabel')}
          </p>
          <p className="mt-1 text-sm text-neutral-800 dark:text-neutral-200">
            {item?.description}
          </p>
        </div>

        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {t('operations:addToPlan.date')}
          <input
            type="date"
            value={planDate}
            onChange={(e) => setPlanDate(e.target.value)}
            className="mt-1 block h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 shadow-sm focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20 dark:border-[#262626] dark:bg-[#171717] dark:text-neutral-50"
          />
        </label>

        <Select
          label={t('operations:addToPlan.itemType')}
          options={PLAN_ITEM_TYPES.map((value) => ({
            value,
            label: t(`operations:plan.itemType.${value}`),
          }))}
          value={itemType}
          onChange={(e) => setItemType(e.target.value)}
        />

        <Textarea
          label={t('operations:addToPlan.notes')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('operations:addToPlan.notesPlaceholder')}
          rows={3}
        />
      </div>
    </Modal>
  );
}
