import { useTranslation } from 'react-i18next';
import { AlertTriangle, MapPin } from 'lucide-react';
import { Button } from '../../../components/ui';
import { cn } from '../../../lib/utils';

/**
 * Read-only Merkez + ACC from the selected site, with edit affordance.
 * Source of truth is customer_sites — not subscriptions.alarm_center*.
 */
export function SubscriptionSiteAlarmCard({
  site = null,
  onEdit,
  disabled = false,
  hasSiteSelected = false,
  loading = false,
}) {
  const { t } = useTranslation(['subscriptions', 'common']);

  if (!hasSiteSelected) {
    return (
      <div className="rounded-2xl border border-neutral-100 dark:border-[#262626] bg-neutral-50/50 dark:bg-neutral-900/30 p-5">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {t('subscriptions:form.hints.selectSiteFirst')}
        </p>
      </div>
    );
  }

  // Site data for the currently selected site is still loading — avoid
  // acting on stale/undefined data (e.g. opening the edit modal as "create").
  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-4 w-40 rounded bg-neutral-100 dark:bg-neutral-800" />
        <div className="h-20 rounded-2xl border border-neutral-100 dark:border-[#262626] bg-neutral-50/50 dark:bg-neutral-900/30" />
      </div>
    );
  }

  const alarmCenter = site?.alarm_center?.trim() || '';
  const accountNo = site?.account_no?.trim() || '';
  const missingAccountNo = !accountNo;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">
            {t('subscriptions:form.sections.siteAlarmInfo')}
          </p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {t('subscriptions:form.hints.alarmFromSite')}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={onEdit}
          className="shrink-0 rounded-xl"
        >
          <MapPin className="w-3.5 h-3.5 mr-1.5" />
          {t('subscriptions:form.buttons.editSite')}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 rounded-2xl border border-neutral-100 dark:border-[#262626] bg-neutral-50/50 dark:bg-neutral-900/30">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
            {t('subscriptions:form.fields.alarmCenter')}
          </p>
          <p className="mt-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
            {alarmCenter || '—'}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
            {t('subscriptions:form.fields.alarmCenterAccount')}
          </p>
          <p className="mt-1 text-sm font-mono font-semibold text-neutral-900 dark:text-neutral-100 truncate">
            {accountNo || '—'}
          </p>
        </div>
      </div>

      {missingAccountNo && (
        <div
          className={cn(
            'flex items-center justify-between gap-4 p-4 rounded-2xl border shadow-sm',
            'bg-amber-50/50 dark:bg-amber-950/10 border-amber-100 dark:border-amber-900/20',
          )}
        >
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold tracking-tight text-amber-900 dark:text-amber-100">
                {t('subscriptions:form.warnings.missingSiteAccountNo')}
              </p>
              <p className="text-xs font-medium opacity-80 mt-0.5 text-amber-700 dark:text-amber-400">
                {t('subscriptions:form.warnings.missingSiteAccountNoHint')}
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={disabled}
            onClick={onEdit}
            className="shrink-0"
          >
            {t('common:actions.add')}
          </Button>
        </div>
      )}
    </div>
  );
}
