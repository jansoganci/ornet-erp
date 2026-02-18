import { useTranslation } from 'react-i18next';
import { Send, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '../../../components/ui';

export function ProposalStatusActions({ proposal, setConfirmAction, statusMutation }) {
  const { t } = useTranslation(['proposals', 'common']);
  const status = proposal?.status;
  const isTerminal = ['completed', 'rejected', 'cancelled'].includes(status);

  if (isTerminal) return null;

  return (
    <div className="hidden lg:flex items-center gap-3 p-4 rounded-xl border border-neutral-200 dark:border-[#262626] bg-white dark:bg-[#171717]">
      {status === 'draft' && (
        <Button
          className="flex-1 max-w-xs"
          leftIcon={<Send className="w-4 h-4" />}
          onClick={() => setConfirmAction('sent')}
          loading={statusMutation?.isPending}
        >
          {t('proposals:detail.actions.markSent')}
        </Button>
      )}

      {status === 'sent' && (
        <>
          <Button
            variant="primary"
            className="flex-1 max-w-xs"
            leftIcon={<CheckCircle2 className="w-4 h-4" />}
            onClick={() => setConfirmAction('accepted')}
            loading={statusMutation?.isPending}
          >
            {t('proposals:detail.actions.accept')}
          </Button>
          <Button
            variant="ghost"
            leftIcon={<XCircle className="w-4 h-4" />}
            onClick={() => setConfirmAction('rejected')}
          >
            {t('proposals:detail.actions.reject')}
          </Button>
        </>
      )}

      {status === 'accepted' && (
        <Button
          variant="primary"
          className="flex-1 max-w-xs"
          leftIcon={<CheckCircle2 className="w-4 h-4" />}
          onClick={() => setConfirmAction('completed')}
          loading={statusMutation?.isPending}
        >
          {t('proposals:detail.actions.markComplete')}
        </Button>
      )}
    </div>
  );
}
