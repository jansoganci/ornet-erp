import { useTranslation } from 'react-i18next';
import { Badge } from '../../../components/ui/Badge';
import { ownershipVariant } from '../schema';

export function OwnershipBadge({ type, size = 'xs', className = '', ...props }) {
  const { t } = useTranslation('siteAssets');

  if (!type || type === 'customer_owned') return null;

  return (
    <Badge 
      variant={ownershipVariant[type] || 'indigo'} 
      size={size} 
      className={`font-bold tracking-wider ${className}`}
      {...props}
    >
      {t(`ownerships.${type}`).toUpperCase()}
    </Badge>
  );
}
