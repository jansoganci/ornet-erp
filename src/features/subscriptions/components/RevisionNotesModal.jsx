import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Button, Input, Textarea, Spinner } from '../../../components/ui';
import { useRevisionNotes, useCreateRevisionNote } from '../hooks';
import { formatDate } from '../../../lib/utils';

const defaultRevisionDate = () => `${new Date().getFullYear()}-01-01`;

export function RevisionNotesModal({ open, onClose, subscription }) {
  const { t } = useTranslation(['subscriptions', 'common']);
  const subscriptionId = subscription?.id;
  const { data: notes = [], isLoading } = useRevisionNotes(subscriptionId);
  const createMutation = useCreateRevisionNote();

  const [noteText, setNoteText] = useState('');
  const [revisionDate, setRevisionDate] = useState(defaultRevisionDate());

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subscriptionId || !noteText.trim()) return;
    await createMutation.mutateAsync({
      subscription_id: subscriptionId,
      note: noteText.trim(),
      revision_date: revisionDate,
    });
    setNoteText('');
    setRevisionDate(defaultRevisionDate());
  };

  const title = subscription
    ? [subscription.company_name, subscription.site_name].filter(Boolean).join(' — ')
    : '';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${t('subscriptions:priceRevision.notes.title')}${title ? ` — ${title}` : ''}`}
      size="md"
      footer={
        <div className="flex gap-3 w-full">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            {t('common:actions.close')}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Timeline */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
            {t('subscriptions:priceRevision.notes.timelineTitle')}
          </h3>
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Spinner size="md" />
            </div>
          ) : notes.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400 py-4">
              {t('subscriptions:priceRevision.notes.empty')}
            </p>
          ) : (
            <ul className="space-y-3 max-h-48 overflow-y-auto">
              {notes.map((n) => (
                <li
                  key={n.id}
                  className="text-sm border-l-2 border-neutral-200 dark:border-[#262626] pl-3 py-1"
                >
                  <span className="font-medium text-neutral-700 dark:text-neutral-300">
                    {formatDate(n.revision_date)}
                  </span>
                  <p className="text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap mt-0.5">
                    {n.note}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Add form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-4 border-t border-neutral-200 dark:border-[#262626]">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            {t('subscriptions:priceRevision.notes.add')}
          </h3>
          <Input
            label={t('subscriptions:priceRevision.notes.revisionDate')}
            type="date"
            value={revisionDate}
            onChange={(e) => setRevisionDate(e.target.value)}
          />
          <Textarea
            label={t('subscriptions:priceRevision.notes.noteLabel')}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder={t('subscriptions:priceRevision.notes.noteLabel')}
            rows={3}
          />
          <Button
            type="submit"
            variant="primary"
            disabled={!noteText.trim() || createMutation.isPending}
            loading={createMutation.isPending}
          >
            {t('subscriptions:priceRevision.notes.add')}
          </Button>
        </form>
      </div>
    </Modal>
  );
}
