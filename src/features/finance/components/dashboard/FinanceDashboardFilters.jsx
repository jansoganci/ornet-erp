import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Select } from '../../../../components/ui';
import { ViewModeToggle } from '../ViewModeToggle';

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

export function FinanceDashboardFilters({ year, month, viewMode, onYearChange, onMonthChange, onViewModeChange }) {
  const { t } = useTranslation('finance');

  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(() => {
    const years = [];
    for (let y = currentYear; y >= currentYear - 4; y--) {
      years.push({ value: String(y), label: String(y) });
    }
    return years;
  }, [currentYear]);

  const monthOptions = useMemo(() => {
    const opts = [{ value: '', label: t('dashboardV2.filters.allMonths') }];
    MONTH_NAMES.forEach((name, i) => {
      opts.push({ value: String(i + 1), label: name });
    });
    return opts;
  }, [t]);

  return (
    <Card className="p-4 border-neutral-200/60 dark:border-neutral-800/60">
      <div className="flex flex-col md:flex-row gap-3 flex-wrap items-end">
        <div className="w-full md:w-28">
          <Select
            label={t('dashboardV2.filters.year')}
            options={yearOptions}
            value={String(year)}
            onChange={(e) => onYearChange(Number(e.target.value))}
          />
        </div>
        <div className="w-full md:w-36">
          <Select
            label={t('dashboardV2.filters.month')}
            options={monthOptions}
            value={month ? String(month) : ''}
            onChange={(e) => onMonthChange(e.target.value ? Number(e.target.value) : null)}
          />
        </div>
        <div className="flex items-end">
          <ViewModeToggle value={viewMode} onChange={onViewModeChange} size="md" />
        </div>
      </div>
    </Card>
  );
}
