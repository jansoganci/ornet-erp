import { useTranslation } from 'react-i18next';
import { Calendar, User } from 'lucide-react';
import { Card } from '../../../components/ui';
import { formatDate } from '../../../lib/utils';

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-neutral-100 dark:border-neutral-800 last:border-0">
      <span className="text-[10px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-widest">
        {label}
      </span>
      <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 text-right">
        {value || '—'}
      </span>
    </div>
  );
}

export function ProposalSummaryCard({ proposal }) {
  const { t } = useTranslation(['proposals']);

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-4 h-4 text-primary-600" />
        <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-xs">
          {t('proposals:detail.summaryTitle', 'Özet Bilgiler')}
        </h3>
      </div>
      <div className="space-y-0">
        <SummaryRow
          label={t('proposals:detail.summary.createdAt', 'Oluşturulma')}
          value={proposal.created_at ? formatDate(proposal.created_at) : null}
        />
        <SummaryRow
          label={t('proposals:detail.summary.sentAt', 'Gönderim')}
          value={proposal.sent_at ? formatDate(proposal.sent_at) : null}
        />
        <SummaryRow
          label={t('proposals:detail.summary.acceptedOrRejectedAt', 'Onay / Red')}
          value={
            proposal.accepted_at
              ? formatDate(proposal.accepted_at)
              : proposal.rejected_at
                ? formatDate(proposal.rejected_at)
                : null
          }
        />
      </div>
      <div className="flex items-center gap-2 mt-6 mb-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
        <User className="w-4 h-4 text-primary-600" />
        <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-xs">
          {t('proposals:detail.summary.contacts', 'İletişim')}
        </h3>
      </div>
      <div className="space-y-0">
        <SummaryRow
          label={t('proposals:form.fields.authorizedPerson')}
          value={proposal.authorized_person}
        />
        <SummaryRow
          label={t('proposals:form.fields.customerRepresentative')}
          value={proposal.customer_representative}
        />
      </div>
    </Card>
  );
}
