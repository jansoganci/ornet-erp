import { useTranslation } from 'react-i18next';
import {
  RECURRING_TABLE_GRID_CLASS,
  RECURRING_AMOUNT_COLUMN_BORDER,
  RECURRING_ACTIONS_COLUMN_BORDER,
} from './recurringTableLayout';

export function RecurringTableHeader() {
  const { t } = useTranslation('recurring');

  return (
    <div
      className={`hidden md:grid ${RECURRING_TABLE_GRID_CLASS} gap-3 px-4 py-2.5 bg-neutral-50 dark:bg-[#111] text-xs font-medium text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-[#262626]`}
    >
      <span>{t('form.fields.name')}</span>
      <span>{t('form.fields.category')}</span>
      <span>{t('form.fields.burdenType')}</span>
      <span className={`text-right ${RECURRING_AMOUNT_COLUMN_BORDER}`}>{t('form.fields.amount')}</span>
      <span className="text-center">{t('form.fields.dayOfMonth')}</span>
      <span className="text-center">{t('form.fields.hasInvoice')}</span>
      <span className={RECURRING_ACTIONS_COLUMN_BORDER} aria-hidden="true" />
    </div>
  );
}
