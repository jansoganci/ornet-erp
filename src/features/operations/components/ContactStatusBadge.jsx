import { useTranslation } from 'react-i18next';
import { Badge } from '../../../components/ui/Badge';

const VARIANT_MAP = {
  not_contacted: 'error',
  no_answer: 'warning',
  confirmed: 'success',
  cancelled: 'default',
};

export function ContactStatusBadge({ status, size = 'sm' }) {
  const { t } = useTranslation('operations');

  return (
    <Badge variant={VARIANT_MAP[status] ?? 'default'} size={size} dot>
      {t(`contactStatus.${status}`)}
    </Badge>
  );
}
