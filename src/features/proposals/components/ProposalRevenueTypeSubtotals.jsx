import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { calcRevenueByType, PROPOSAL_REVENUE_TYPE_KEYS } from '../../../lib/proposalCalc';
import { cn, formatCurrency } from '../../../lib/utils';

export function ProposalRevenueTypeSubtotals({
  items = [],
  sections = [],
  currency = 'USD',
  className,
}) {
  const { t } = useTranslation('proposals');

  const byType = useMemo(
    () => calcRevenueByType(items, sections, currency),
    [items, sections, currency],
  );

  const rows = PROPOSAL_REVENUE_TYPE_KEYS.filter((type) => byType[type] > 0);
  if (rows.length === 0) return null;

  return (
    <div
      className={cn(
        'rounded-lg border border-neutral-200 dark:border-[#333] bg-neutral-50/80 dark:bg-[#171717]/60 px-4 py-3 space-y-2',
        className,
      )}
    >
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          {t('items.revenueTypeSubtotals.title')}
        </h4>
        <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5">
          {t('items.revenueTypeSubtotals.hint')}
        </p>
      </div>
      {rows.map((type) => (
        <div key={type} className="flex items-center justify-between text-sm">
          <span className="text-neutral-600 dark:text-neutral-400">
            {t(`items.revenueTypes.${type}`)}
          </span>
          <span className="font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
            {formatCurrency(byType[type], currency)}
          </span>
        </div>
      ))}
    </div>
  );
}
