import { useTranslation } from 'react-i18next';
import { Pencil, Pause, Play, Trash2 } from 'lucide-react';
import { Badge, IconButton } from '../../../components/ui';
import { cn } from '../../../lib/utils';

function formatCurrency(amount) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

export function RecurringTemplateCard({ template, onEdit, onToggleActive, onDelete }) {
  const { t } = useTranslation('recurring');

  const categoryName = template.expense_categories?.name_tr || '-';

  return (
    <div
      className={cn(
        'rounded-xl border p-4 flex flex-col gap-3 transition-colors',
        template.is_active
          ? 'border-neutral-200 dark:border-[#262626] bg-white dark:bg-[#171717]'
          : 'border-neutral-100 dark:border-[#1f1f1f] bg-neutral-50 dark:bg-[#111] opacity-60'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 truncate">
            {template.name}
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">
            {categoryName}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {template.is_variable && (
            <Badge variant="warning" size="sm">
              {t('pending.variable')}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-baseline gap-1">
        <span className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
          {formatCurrency(template.amount)}
        </span>
        {template.is_variable && (
          <span className="text-xs text-neutral-400 dark:text-neutral-500">~</span>
        )}
      </div>

      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        {t('templates.dayPrefix')} {template.day_of_month}{t('templates.daySuffix')}
      </p>

      <div className="flex items-center gap-1 pt-1 border-t border-neutral-100 dark:border-[#222]">
        <IconButton
          icon={Pencil}
          size="sm"
          variant="ghost"
          onClick={() => onEdit(template)}
          aria-label={t('common:actions.edit')}
        />
        <IconButton
          icon={template.is_active ? Pause : Play}
          size="sm"
          variant="ghost"
          onClick={() => onToggleActive(template)}
          aria-label={template.is_active ? t('actions.deactivate') : t('actions.activate')}
        />
        <IconButton
          icon={Trash2}
          size="sm"
          variant="ghost"
          className="text-error-500 hover:text-error-600"
          onClick={() => onDelete(template)}
          aria-label={t('common:actions.delete')}
        />
      </div>
    </div>
  );
}
