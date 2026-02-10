import { useTranslation } from 'react-i18next';
import { Badge } from '../../../components/ui';
import { proposalStatusVariant } from '../../../lib/utils';

export function ProposalStatusBadge({ status, size = 'md' }) {
  const { t } = useTranslation('proposals');

  return (
    <Badge variant={proposalStatusVariant[status] || 'default'} dot size={size}>
      {t(`status.${status}`)}
    </Badge>
  );
}
