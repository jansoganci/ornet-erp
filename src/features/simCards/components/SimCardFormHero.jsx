import { Smartphone, ChevronLeft, User, Signal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '../../../components/ui';

/**
 * Hero header for SIM Card create/edit form.
 * Matches design language from CustomerDetailPage / WorkOrderFormPage.
 */
export function SimCardFormHero({ isEdit, onCancel, onSave, isSaving, selectedCustomer }) {
  const { t } = useTranslation(['simCards', 'common', 'customers']);

  const title = isEdit ? t('simCards:form.editTitle') : t('simCards:form.addTitle');
  const subtitle = isEdit
    ? t('simCards:form.editSubtitle', 'SIM kart bilgilerini güncelleyin')
    : t('simCards:form.addSubtitle', 'Hat numarası ve operatör bilgilerini girin');

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/sim-cards"
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          {t('simCards:list.title')}
        </Link>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            {t('common:actions.cancel')}
          </Button>
          <Button size="sm" onClick={onSave} loading={isSaving}>
            {isEdit ? t('common:actions.save') : t('common:actions.create')}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200/70 bg-white px-5 py-4 shadow-sm dark:border-[#262626] dark:bg-[#171717]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-primary-50 p-3 text-primary-600 dark:bg-primary-950/40 dark:text-primary-400">
              <Smartphone className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
                {title}
              </h1>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                {subtitle}
              </p>
            </div>
          </div>

          {selectedCustomer && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:min-w-[420px]">
              <div className="flex items-center gap-3 rounded-2xl border border-neutral-200/70 bg-neutral-50 px-4 py-3 dark:border-[#303030] dark:bg-[#1a1a1a]">
                <div className="rounded-lg bg-blue-50 p-1.5 dark:bg-blue-950/30">
                  <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400 dark:text-neutral-500">
                    {t('simCards:list.columns.customer')}
                  </p>
                  <p className="max-w-[220px] truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {selectedCustomer.company_name}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-2xl border border-neutral-200/70 bg-neutral-50 px-4 py-3 dark:border-[#303030] dark:bg-[#1a1a1a]">
                <div className="rounded-lg bg-emerald-50 p-1.5 dark:bg-emerald-950/30">
                  <Signal className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400 dark:text-neutral-500">
                    {t('simCards:stats.total')}
                  </p>
                  <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {selectedCustomer.sim_count || 0}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
