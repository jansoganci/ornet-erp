import { Wrench, ChevronLeft, MapPin, Hash } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '../../../components/ui';

/**
 * Hero header for Work Order create/edit form.
 * Matches design language from CustomerDetailPage / WorkOrderDetailPage.
 */
export function WorkOrderFormHero({ isEdit, onCancel, onSave, isSaving, selectedSite }) {
  const { t } = useTranslation(['workOrders', 'common', 'customers']);

  const title = isEdit ? t('workOrders:form.editTitle') : t('workOrders:form.addTitle');
  const subtitle = isEdit
    ? t('workOrders:form.editSubtitle', 'İş emri bilgilerini güncelleyin')
    : t('workOrders:form.addSubtitle', 'Müşteri ve lokasyon seçerek başlayın');

  return (
    <div className="space-y-4">
      {/* Breadcrumb + Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/work-orders"
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          {t('common:nav.workOrders')}
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
      <div className="rounded-xl border border-neutral-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-primary-100 dark:bg-primary-950/40 flex-shrink-0">
              <Wrench className="w-7 h-7 text-primary-600 dark:text-primary-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-50 leading-tight">
                {title}
              </h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                {subtitle}
              </p>
            </div>
          </div>

          {/* Contextual Stats (Account No, Site Address) */}
          {selectedSite && (
            <div className="flex flex-wrap items-center gap-3 md:gap-6">
              {selectedSite.account_no && (
                <div className="flex items-center gap-3 px-4 py-2 bg-neutral-50 dark:bg-[#1a1a1a] rounded-xl border border-neutral-100 dark:border-[#262626]">
                  <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                    <Hash className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                      {t('customers:sites.fields.accountNo')}
                    </p>
                    <p className="text-sm font-mono font-bold text-neutral-900 dark:text-neutral-100">
                      {selectedSite.account_no}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 px-4 py-2 bg-neutral-50 dark:bg-[#1a1a1a] rounded-xl border border-neutral-100 dark:border-[#262626]">
                <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                  <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                    {t('customers:sites.fields.location')}
                  </p>
                  <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100 max-w-[150px] truncate">
                    {selectedSite.site_name || selectedSite.district || t('common:unknown')}
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
