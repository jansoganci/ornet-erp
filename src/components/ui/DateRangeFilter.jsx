import { useTranslation } from 'react-i18next';
import { Input } from './Input';

/**
 * Reusable date range filter with two date inputs side by side.
 * Props: dateFrom, dateTo, onFromChange, onToChange
 */
export function DateRangeFilter({ dateFrom, dateTo, onFromChange, onToChange }) {
  const { t } = useTranslation('common');

  return (
    <div className="flex flex-col lg:flex-row items-end gap-3">
      <div className="w-full lg:w-40">
        <Input
          type="date"
          label={t('filters.dateFrom')}
          value={dateFrom}
          onChange={(e) => onFromChange(e.target.value)}
          size="sm"
        />
      </div>
      <div className="w-full lg:w-40">
        <Input
          type="date"
          label={t('filters.dateTo')}
          value={dateTo}
          onChange={(e) => onToChange(e.target.value)}
          size="sm"
        />
      </div>
    </div>
  );
}
