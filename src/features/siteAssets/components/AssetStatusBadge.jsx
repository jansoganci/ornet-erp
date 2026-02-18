import { useTranslation } from 'react-i18next';
import { Badge } from '../../../components/ui/Badge';
import { assetStatusVariant } from '../schema';

export function AssetStatusBadge({ status, size = 'sm', ...props }) {
  const { t } = useTranslation('siteAssets');

  return (
    <Badge variant={assetStatusVariant[status] || 'default'} size={size} dot {...props}>
      {t(`statuses.${status}`)}
    </Badge>
  );
}
