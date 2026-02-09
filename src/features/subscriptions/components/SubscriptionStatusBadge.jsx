import { useTranslation } from 'react-i18next';
import { Badge } from '../../../components/ui';
import { subscriptionStatusVariant } from '../../../lib/utils';

export function SubscriptionStatusBadge({ status, size = 'md' }) {
  const { t } = useTranslation('subscriptions');

  return (
    <Badge variant={subscriptionStatusVariant[status] || 'default'} dot size={size}>
      {t(`statuses.${status}`)}
    </Badge>
  );
}
