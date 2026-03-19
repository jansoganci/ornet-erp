import { useTranslation } from 'react-i18next';
import { Badge } from '../../../components/ui/Badge';

const VARIANT_MAP = {
  istanbul_europe: 'info',
  istanbul_anatolia: 'primary',
  outside_istanbul: 'default',
};

export function RegionBadge({ region, size = 'sm' }) {
  const { t } = useTranslation('operations');

  return (
    <Badge variant={VARIANT_MAP[region] ?? 'default'} size={size}>
      {t(`regions.${region}`)}
    </Badge>
  );
}
