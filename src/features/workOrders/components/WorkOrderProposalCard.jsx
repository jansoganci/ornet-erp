import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { FileCheck, ChevronRight } from 'lucide-react';
import { Card } from '../../../components/ui';

export function WorkOrderProposalCard({ proposalId }) {
  const { t } = useTranslation('workOrders');

  if (!proposalId) return null;

  return (
    <Card className="p-4 bg-primary-50/50 dark:bg-primary-950/10 border-primary-100 dark:border-primary-900/20">
      <Link
        to={`/proposals/${proposalId}`}
        className="flex items-center gap-3 group"
      >
        <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
          <FileCheck className="w-4 h-4 text-primary-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase font-bold text-primary-500 tracking-widest">
            {t('detail.proposalLink', 'Teklif')}
          </p>
          <p className="text-sm font-bold text-primary-700 dark:text-primary-300 group-hover:text-primary-600 transition-colors truncate">
            {t('detail.viewProposal', 'Teklifi Görüntüle')}
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-primary-400 group-hover:text-primary-600 transition-colors" />
      </Link>
    </Card>
  );
}
