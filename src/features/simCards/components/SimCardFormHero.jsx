import { Smartphone, ChevronLeft, MapPin, User, Signal } from 'lucide-react';
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
    <div className="space-y-4">
      {/* Breadcrumb + Actions */}
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

      {/* Hero Card */}
      <div className="rounded-[2rem] border border-neutral-200/60 dark:border-[#262626] bg-white dark:bg-[#171717] p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-5">
            <div className="p-4 rounded-2xl bg-primary-100 dark:bg-primary-950/40 flex-shrink-0 shadow-inner">
              <Smartphone className="w-8 h-8 text-primary-600 dark:text-primary-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-50 leading-tight tracking-tight">
                {title}
              </h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 font-medium">
                {subtitle}
              </p>
            </div>
          </div>

          {/* Contextual Stats (Customer) */}
          {selectedCustomer && (
            <div className="flex flex-wrap items-center gap-3 md:gap-4">
              <div className="flex items-center gap-3 px-5 py-2.5 bg-neutral-50 dark:bg-[#1a1a1a] rounded-2xl border border-neutral-100 dark:border-[#262626] shadow-sm">
                <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                  <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                    {t('simCards:list.columns.customer')}
                  </p>
                  <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100 max-w-[180px] truncate">
                    {selectedCustomer.company_name}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 px-5 py-2.5 bg-neutral-50 dark:bg-[#1a1a1a] rounded-2xl border border-neutral-100 dark:border-[#262626] shadow-sm">
                <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                  <Signal className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                    {t('simCards:stats.total')}
                  </p>
                  <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
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
