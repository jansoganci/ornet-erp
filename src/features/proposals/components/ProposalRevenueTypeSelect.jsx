import { useTranslation } from 'react-i18next';
import { buildGroupedRevenueTypeOptions } from '../revenueTypeGroups';
import { cn } from '../../../lib/utils';

export function ProposalRevenueTypeSelect({
  value,
  onChange,
  onBlur,
  className,
  id,
}) {
  const { t } = useTranslation('proposals');
  const groups = buildGroupedRevenueTypeOptions(t);
  const resolvedValue = value ?? 'other';

  return (
    <select
      id={id}
      value={resolvedValue}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      className={cn(
        'block w-full rounded-lg border shadow-sm text-sm appearance-none cursor-pointer',
        'bg-white dark:bg-[#171717] text-neutral-900 dark:text-neutral-50',
        'border-neutral-300 dark:border-neutral-500',
        className,
      )}
    >
      {groups.map((group) => (
        <optgroup key={group.id} label={group.label}>
          {group.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
