import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarPlus, MoreVertical, Trash2, X as XIcon, Phone } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { ContactStatusBadge } from './ContactStatusBadge';
import { RegionBadge } from './RegionBadge';
import { InlineScheduler } from './InlineScheduler';
const PRIORITY_VARIANT = {
  low: 'default',
  normal: 'info',
  high: 'warning',
  urgent: 'error',
};

export function RequestCard({ request, onCancel, onDelete }) {
  const { t } = useTranslation('operations');
  const [showScheduler, setShowScheduler] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const customer = request.customers;
  const site = request.customer_sites;
  const isConfirmed = request.contact_status === 'confirmed';

  return (
    <div className="bg-white dark:bg-[#171717] rounded-lg border border-neutral-200 dark:border-[#262626] shadow-sm hover:shadow-md transition-shadow">
      <div className="p-4">
        {/* Header: Customer + Priority + Menu */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 truncate">
              {customer?.company_name ?? '—'}
            </h4>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
              {site ? `${site.site_name}${site.account_no ? ` (${site.account_no})` : ''}` : t('card.noSite')}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {request.priority !== 'normal' && (
              <Badge variant={PRIORITY_VARIANT[request.priority]} size="sm">
                {t(`priority.${request.priority}`)}
              </Badge>
            )}
            {/* Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMenu(!showMenu)}
                className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 w-40 bg-white dark:bg-[#171717] border border-neutral-200 dark:border-[#262626] rounded-lg shadow-xl py-1">
                    {onCancel && request.status === 'open' && (
                      <button
                        type="button"
                        onClick={() => { setShowMenu(false); onCancel(request.id); }}
                        className="w-full px-3 py-2 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center gap-2"
                      >
                        <XIcon className="w-3.5 h-3.5" />
                        {t('actions.cancel')}
                      </button>
                    )}
                    {onDelete && (
                      <button
                        type="button"
                        onClick={() => { setShowMenu(false); onDelete(request.id); }}
                        className="w-full px-3 py-2 text-left text-sm text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/20 flex items-center gap-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {t('actions.delete')}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-neutral-700 dark:text-neutral-300 line-clamp-2 mb-3">
          {request.description}
        </p>

        {/* Bottom row: badges + actions */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <RegionBadge region={request.region} />
            <Badge variant="default" size="sm">
              {t(`workType.${request.work_type}`)}
            </Badge>
            {request.reschedule_count > 0 && (
              <Badge variant="warning" size="sm">
                {t('card.attempt', { count: request.reschedule_count + 1 })}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ContactStatusBadge status={request.contact_status} />
            {isConfirmed && !showScheduler && (
              <button
                type="button"
                onClick={() => setShowScheduler(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                {t('actions.schedule')}
              </button>
            )}
          </div>
        </div>

        {/* Phone quick-copy */}
        {(customer?.phone || site?.contact_phone) && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-neutral-400 dark:text-neutral-500">
            <Phone className="w-3 h-3" />
            <span className="select-all">{site?.contact_phone || customer?.phone}</span>
          </div>
        )}
      </div>

      {/* Inline Scheduler — expandable */}
      {showScheduler && (
        <InlineScheduler
          request={request}
          onClose={() => setShowScheduler(false)}
        />
      )}
    </div>
  );
}
