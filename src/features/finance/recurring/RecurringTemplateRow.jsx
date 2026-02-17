import { useTranslation } from 'react-i18next';
import { Pencil, Pause, Play, Trash2 } from 'lucide-react';
import { Badge, IconButton } from '../../../components/ui';

function formatCurrency(amount) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

export function RecurringTemplateRow({ template, onEdit, onToggleActive, onDelete }) {
  const { t } = useTranslation('recurring');

  const categoryName = template.expense_categories?.name_tr || '-';

  return (
    <div className="border-b border-neutral-100 dark:border-[#222] last:border-b-0 hover:bg-neutral-50 dark:hover:bg-[#1a1a1a] transition-colors">
      {/* Desktop row */}
      <div className="hidden sm:grid sm:grid-cols-[3fr_2fr_1.5fr_1fr_1.5fr_1fr] gap-3 items-center px-4 py-3">
        {/* Name + variable badge */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-50 truncate">
            {template.name}
          </span>
          {template.is_variable && (
            <Badge variant="warning" size="sm">
              {t('pending.variable')}
            </Badge>
          )}
        </div>

        {/* Category */}
        <span className="text-sm text-neutral-600 dark:text-neutral-400 truncate">
          {categoryName}
        </span>

        {/* Amount */}
        <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 text-right tabular-nums">
          {formatCurrency(template.amount)}
          {template.is_variable && <span className="text-neutral-400">~</span>}
        </span>

        {/* Day of month */}
        <span className="text-sm text-neutral-600 dark:text-neutral-400 text-center">
          {template.day_of_month}.
        </span>

        {/* Status */}
        <span className="text-center">
          {template.is_active ? (
            <Badge variant="success" size="sm">{t('status.active')}</Badge>
          ) : (
            <Badge variant="secondary" size="sm">{t('status.paused')}</Badge>
          )}
        </span>

        {/* Actions */}
        <div className="flex items-center justify-end gap-0.5">
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

      {/* Mobile row */}
      <div className="sm:hidden flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-50 truncate">
              {template.name}
            </span>
            {template.is_variable && (
              <Badge variant="warning" size="sm">
                {t('pending.variable')}
              </Badge>
            )}
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            {categoryName} · {t('templates.dayPrefix')} {template.day_of_month}{t('templates.daySuffix')}
          </p>
        </div>

        <div className="text-right flex-shrink-0 mr-1">
          <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 tabular-nums">
            {formatCurrency(template.amount)}
          </span>
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          <IconButton
            icon={Pencil}
            size="sm"
            variant="ghost"
            onClick={() => onEdit(template)}
          />
          <IconButton
            icon={template.is_active ? Pause : Play}
            size="sm"
            variant="ghost"
            onClick={() => onToggleActive(template)}
          />
          <IconButton
            icon={Trash2}
            size="sm"
            variant="ghost"
            className="text-error-500 hover:text-error-600"
            onClick={() => onDelete(template)}
          />
        </div>
      </div>
    </div>
  );
}
