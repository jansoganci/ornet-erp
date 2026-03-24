import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Pencil, Pause, Play, Trash2 } from 'lucide-react';
import { Badge, IconButton } from '../../../components/ui';

function formatCurrency(amount) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function formatLastGenerated(dateStr) {
  if (!dateStr) return null;
  return format(parseISO(dateStr), 'MMM yyyy', { locale: tr });
}

export function RecurringTemplateRow({ template, lastGenerated, onEdit, onToggleActive, onDelete }) {
  const { t } = useTranslation('recurring');

  const categoryName = template.expense_categories?.name_tr || '-';

  const handleRowClick = () => onEdit(template);
  const stopPropagation = (e) => e.stopPropagation();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleRowClick}
      onKeyDown={(e) => e.key === 'Enter' && handleRowClick()}
      className="border-b border-neutral-100 dark:border-[#222] last:border-b-0 hover:bg-neutral-50 dark:hover:bg-[#1a1a1a] transition-colors cursor-pointer"
    >
      {/* Desktop row */}
      <div className="hidden md:grid md:grid-cols-[3fr_2fr_1.5fr_1fr_1.5fr_1fr] gap-3 items-center px-4 py-3">
        {/* Name + variable badge + last generated */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-50 truncate">
              {template.name}
            </span>
            {template.is_variable && (
              <Badge variant="warning" size="sm">
                {t('badges.variable')}
              </Badge>
            )}
          </div>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
            {lastGenerated
              ? t('templates.lastGenerated', { date: formatLastGenerated(lastGenerated) })
              : t('templates.neverGenerated')}
          </p>
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

        {/* Invoice / Status */}
        <span className="text-center">
          {!template.is_active ? (
            <Badge variant="secondary" size="sm">{t('status.paused')}</Badge>
          ) : template.has_invoice ? (
            <Badge variant="success" size="sm">{t('form.fields.hasInvoice')}</Badge>
          ) : (
            <span className="text-xs text-neutral-400">—</span>
          )}
        </span>

        {/* Actions */}
        <div className="flex items-center justify-end gap-0.5" onClick={stopPropagation}>
          <IconButton
            icon={Pencil}
            size="sm"
            variant="ghost"
            onClick={(e) => { e.stopPropagation(); onEdit(template); }}
            aria-label={t('common:actions.edit')}
          />
          <IconButton
            icon={template.is_active ? Pause : Play}
            size="sm"
            variant="ghost"
            onClick={(e) => { e.stopPropagation(); onToggleActive(template); }}
            aria-label={template.is_active ? t('actions.deactivate') : t('actions.activate')}
          />
          <IconButton
            icon={Trash2}
            size="sm"
            variant="ghost"
            className="text-error-500 hover:text-error-600"
            onClick={(e) => { e.stopPropagation(); onDelete(template); }}
            aria-label={t('common:actions.delete')}
          />
        </div>
      </div>

      {/* Mobile row */}
      <div className="md:hidden bg-white dark:bg-[#1a1a1a] p-4 active:bg-neutral-50 dark:active:bg-[#262626]">
        <div className="flex justify-between items-start mb-2">
          <div className="min-w-0 flex-1 mr-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-neutral-900 dark:text-neutral-50 truncate">
                {template.name}
              </span>
              {template.is_variable && (
                <Badge variant="warning" size="sm">
                  {t('badges.variable')}
                </Badge>
              )}
              {!template.is_active && (
                <Badge variant="secondary" size="sm">{t('status.paused')}</Badge>
              )}
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              {categoryName} · {t('templates.dayPrefix')} {template.day_of_month}{t('templates.daySuffix')}
            </p>
          </div>
          <span className="text-red-400 font-bold text-lg shrink-0 tabular-nums">
            {formatCurrency(template.amount)}
            {template.is_variable && <span className="text-neutral-400 text-sm">~</span>}
          </span>
        </div>
        <div className="flex items-center justify-between mt-3">
          <p className="text-[0.625rem] text-neutral-400 dark:text-neutral-500">
            {lastGenerated
              ? t('templates.lastGenerated', { date: formatLastGenerated(lastGenerated) })
              : t('templates.neverGenerated')}
          </p>
          <div className="flex items-center gap-0.5" onClick={stopPropagation}>
            <IconButton
              icon={template.is_active ? Pause : Play}
              size="sm"
              variant="ghost"
              onClick={(e) => { e.stopPropagation(); onToggleActive(template); }}
            />
            <IconButton
              icon={Trash2}
              size="sm"
              variant="ghost"
              className="text-error-500 hover:text-error-600"
              onClick={(e) => { e.stopPropagation(); onDelete(template); }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
