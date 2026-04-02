import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarPlus, MoreVertical, Trash2, X as XIcon, Phone, Wifi, FileText, ListPlus, ClipboardList } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { ContactStatusBadge } from './ContactStatusBadge';
import { RegionBadge } from './RegionBadge';
import { useCloseOperationsItem } from '../hooks';
import { AddToPlanModal } from './AddToPlanModal';

const PRIORITY_VARIANT = {
  low: 'default',
  normal: 'info',
  high: 'warning',
  urgent: 'error',
};

export function RequestCard({ request, onDelete, variant = 'default', onOpenCloseOutcome }) {
  const { t } = useTranslation('operations');
  const isArchive = variant === 'archive';
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [showAddToPlan, setShowAddToPlan] = useState(false);
  const closeMutation = useCloseOperationsItem();

  const customer = request.customers;
  const site = request.customer_sites;
  const isConfirmed = request.contact_status === 'confirmed';

  const handleResolvedRemotely = async () => {
    await closeMutation.mutateAsync({
      id: request.id,
      outcomeType: 'remote_resolved',
    });
  };

  const handleCreateWorkOrder = () => {
    const params = new URLSearchParams();
    if (request.customer_id) params.set('customerId', request.customer_id);
    if (request.site_id) params.set('siteId', request.site_id);
    if (request.description) params.set('description', request.description);
    params.set('sourceItemId', request.id);
    params.set('status', 'scheduled');
    navigate(`/work-orders/new?${params.toString()}`);
  };

  const handleCreateProposal = () => {
    const searchParams = new URLSearchParams();
    if (request.customer_id) searchParams.set('customerId', request.customer_id);
    if (request.site_id) searchParams.set('siteId', request.site_id);
    if (request.description) searchParams.set('description', request.description);
    searchParams.set('sourceItemId', request.id);

    navigate(`/proposals/new?${searchParams.toString()}`);
  };

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
            {/* Menu — pool / active items only */}
            {!isArchive && (
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
                    {request.status === 'open' && onOpenCloseOutcome && (
                      <button
                        type="button"
                        onClick={() => { setShowMenu(false); onOpenCloseOutcome(); }}
                        className="w-full px-3 py-2 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center gap-2"
                      >
                        <XIcon className="w-3.5 h-3.5" />
                        {t('actions.closeWithOutcome')}
                      </button>
                    )}
                    {isConfirmed && (
                      <button
                        type="button"
                        onClick={() => { setShowMenu(false); handleCreateWorkOrder(); }}
                        className="w-full px-3 py-2 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center gap-2"
                      >
                        <CalendarPlus className="w-3.5 h-3.5" />
                        {t('actions.createWorkOrder')}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => { setShowMenu(false); setShowAddToPlan(true); }}
                      className="w-full px-3 py-2 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center gap-2"
                    >
                      <ListPlus className="w-3.5 h-3.5" />
                      {t('actions.addToDailyPlan')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowMenu(false); handleCreateProposal(); }}
                      className="w-full px-3 py-2 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center gap-2"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      {t('actions.createProposal')}
                    </button>
                    {isConfirmed && (
                      <button
                        type="button"
                        onClick={() => { setShowMenu(false); handleResolvedRemotely(); }}
                        className="w-full px-3 py-2 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center gap-2"
                      >
                        <Wifi className="w-3.5 h-3.5" />
                        {t('actions.resolvedRemotely')}
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
            )}
          </div>
        </div>

        {isArchive && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            <Badge variant="default" size="sm">
              {t(`status.${request.status}`)}
            </Badge>
            {request.outcome_type ? (
              <Badge variant="info" size="sm">
                {t(`outcome.${request.outcome_type}`)}
              </Badge>
            ) : null}
          </div>
        )}

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
            {request.work_order_id && (
              <button
                type="button"
                onClick={() => navigate(`/work-orders/${request.work_order_id}`)}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium rounded bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100 dark:bg-primary-900/20 dark:text-primary-300 dark:border-primary-800 transition-colors"
              >
                <ClipboardList className="w-3 h-3" />
                {request.work_orders?.form_no ? `#${request.work_orders.form_no}` : t('card.workOrderLinked')}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isArchive ? (
              <>
                <ContactStatusBadge requestId={request.id} status={request.contact_status} />
                {isConfirmed && (
                  <Button
                    type="button"
                    variant="success"
                    size="sm"
                    leftIcon={<Wifi className="w-3.5 h-3.5" />}
                    onClick={handleResolvedRemotely}
                    loading={closeMutation.isPending}
                  >
                    {t('actions.resolvedRemotely')}
                  </Button>
                )}
              </>
            ) : (
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {t(`contactStatus.${request.contact_status}`)}
              </span>
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

      {!isArchive && (
        <>
          <AddToPlanModal
            open={showAddToPlan}
            onClose={() => setShowAddToPlan(false)}
            item={request}
          />
        </>
      )}
    </div>
  );
}
