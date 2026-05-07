import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';
import {
  Check,
  Minus,
  Phone,
  Wifi,
  FileText,
  ListPlus,
  ClipboardList,
  RotateCcw,
  ArrowRight,
  CheckCircle,
  PhoneOff,
  Trash2,
  CalendarPlus,
  ChevronDown,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { RegionBadge } from './RegionBadge';
import { useCloseOperationsItem, useUpdateContactStatus } from '../hooks';
import { AddToPlanModal } from './AddToPlanModal';

const PRIORITY_VARIANT = {
  low: 'default',
  normal: 'info',
  high: 'warning',
  urgent: 'error',
};

// ── Status Timeline ──────────────────────────────────────────────────────────

function StatusTimeline({ contactStatus, hasWorkOrder, isClosed }) {
  const { t } = useTranslation('operations');

  const steps = [
    { key: 'created', done: true, partial: false },
    {
      key: 'contacted',
      done: contactStatus === 'confirmed',
      partial: contactStatus === 'no_answer',
    },
    { key: 'woCreated', done: hasWorkOrder, partial: false },
    { key: 'closed', done: isClosed, partial: false },
  ];

  return (
    <div className="flex items-start mb-3">
      {steps.map((step, i) => (
        <div key={step.key} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                'w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                step.done
                  ? 'bg-primary-600 border-primary-600'
                  : step.partial
                    ? 'bg-warning-400 border-warning-400'
                    : 'bg-white dark:bg-[#171717] border-neutral-300 dark:border-neutral-600'
              )}
            >
              {step.done && <Check className="w-2.5 h-2.5 text-white" />}
              {!step.done && step.partial && <Minus className="w-2.5 h-2.5 text-white" />}
            </div>
            <span className="text-[9px] leading-tight text-neutral-400 dark:text-neutral-500 mt-0.5 text-center whitespace-nowrap">
              {t(`timeline.${step.key}`)}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={cn(
                'flex-1 h-px mx-1 mb-3.5',
                step.done ? 'bg-primary-600' : 'bg-neutral-200 dark:bg-neutral-700'
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Overflow "More" Menu ─────────────────────────────────────────────────────

function MoreMenu({ items }) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation('operations');

  if (!items || items.length === 0) return null;

  return (
    <div className="relative shrink-0">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        rightIcon={<ChevronDown className="w-3 h-3" />}
        onClick={() => setOpen((v) => !v)}
      >
        {t('actions.more')}
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 bottom-full mb-1 z-50 w-48 bg-white dark:bg-[#171717] border border-neutral-200 dark:border-[#262626] rounded-lg shadow-xl py-1">
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className={cn(
                  'w-full px-3 py-2 text-left text-sm flex items-center gap-2',
                  item.danger
                    ? 'text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/20'
                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                )}
              >
                {item.Icon && <item.Icon className="w-3.5 h-3.5" />}
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Contextual Action Bar ────────────────────────────────────────────────────

function CardActionBar({ request, onOpenCloseOutcome, onOpenBoomerang, onDelete }) {
  const { t } = useTranslation('operations');
  const navigate = useNavigate();
  const [showAddToPlan, setShowAddToPlan] = useState(false);
  const contactMutation = useUpdateContactStatus();
  const closeMutation = useCloseOperationsItem();

  const hasWorkOrder = !!request.work_order_id;
  const isConfirmed = request.contact_status === 'confirmed';
  const isScheduled = hasWorkOrder;

  const handleContact = (status) => {
    contactMutation.mutate({ id: request.id, contactStatus: status });
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
    const params = new URLSearchParams();
    if (request.customer_id) params.set('customerId', request.customer_id);
    if (request.site_id) params.set('siteId', request.site_id);
    if (request.description) params.set('description', request.description);
    params.set('sourceItemId', request.id);
    navigate(`/proposals/new?${params.toString()}`);
  };

  const handleResolvedRemotely = () => {
    closeMutation.mutate({ id: request.id, outcomeType: 'remote_resolved' });
  };

  const commonMoreItems = [
    {
      key: 'addToPlan',
      label: t('actions.addToDailyPlan'),
      Icon: ListPlus,
      onClick: () => setShowAddToPlan(true),
    },
    ...(onOpenCloseOutcome
      ? [
          {
            key: 'close',
            label: t('actions.closeWithOutcome'),
            Icon: ClipboardList,
            onClick: onOpenCloseOutcome,
          },
        ]
      : []),
    ...(onDelete
      ? [
          {
            key: 'delete',
            label: t('actions.delete'),
            Icon: Trash2,
            onClick: () => onDelete(request.id),
            danger: true,
          },
        ]
      : []),
  ];

  // ── State: scheduled (work order exists) ──
  if (isScheduled) {
    return (
      <>
        <div className="border-t border-neutral-100 dark:border-[#262626] px-4 py-3 flex items-center gap-2">
          <Button
            type="button"
            variant="danger"
            size="sm"
            className="flex-1 min-h-[40px] md:min-h-0"
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            onClick={onOpenBoomerang}
          >
            {t('actions.visitFailed')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-[40px] md:min-h-0"
            leftIcon={<ArrowRight className="w-3.5 h-3.5" />}
            onClick={() => navigate(`/work-orders/${request.work_order_id}`)}
          >
            {t('actions.viewWorkOrder')}
          </Button>
          <MoreMenu items={commonMoreItems} />
        </div>
        <AddToPlanModal
          open={showAddToPlan}
          onClose={() => setShowAddToPlan(false)}
          item={request}
        />
      </>
    );
  }

  // ── State: confirmed, no work order yet ──
  if (isConfirmed) {
    const moreItems = [
      {
        key: 'remote',
        label: t('actions.resolvedRemotely'),
        Icon: Wifi,
        onClick: handleResolvedRemotely,
      },
      ...commonMoreItems,
    ];

    return (
      <>
        <div className="border-t border-neutral-100 dark:border-[#262626] px-4 py-3 flex items-center gap-2">
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="flex-1 min-h-[40px] md:min-h-0"
            leftIcon={<CalendarPlus className="w-3.5 h-3.5" />}
            onClick={handleCreateWorkOrder}
          >
            {t('actions.createWorkOrder')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-[40px] md:min-h-0"
            leftIcon={<FileText className="w-3.5 h-3.5" />}
            onClick={handleCreateProposal}
          >
            {t('actions.createProposal')}
          </Button>
          <MoreMenu items={moreItems} />
        </div>
        <AddToPlanModal
          open={showAddToPlan}
          onClose={() => setShowAddToPlan(false)}
          item={request}
        />
      </>
    );
  }

  // ── State: not_contacted / no_answer ──
  return (
    <>
      <div className="border-t border-neutral-100 dark:border-[#262626] px-4 py-3 flex items-center gap-2">
        <Button
          type="button"
          variant="success"
          size="sm"
          className="flex-1 min-h-[40px] md:min-h-0"
          leftIcon={<CheckCircle className="w-3.5 h-3.5" />}
          loading={contactMutation.isPending}
          onClick={() => handleContact('confirmed')}
        >
          {t('contactStatus.confirmed')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="min-h-[40px] md:min-h-0"
          leftIcon={<PhoneOff className="w-3.5 h-3.5" />}
          loading={contactMutation.isPending}
          onClick={() => handleContact('no_answer')}
        >
          {t('contactStatus.no_answer')}
        </Button>
        <MoreMenu items={commonMoreItems} />
      </div>
      <AddToPlanModal
        open={showAddToPlan}
        onClose={() => setShowAddToPlan(false)}
        item={request}
      />
    </>
  );
}

// ── Main Card ────────────────────────────────────────────────────────────────

export function RequestCard({ request, onDelete, variant = 'default', onOpenCloseOutcome, onOpenBoomerang }) {
  const { t } = useTranslation('operations');
  const navigate = useNavigate();
  const isArchive = variant === 'archive';

  const customer = request.customers;
  const site = request.customer_sites;
  const isClosed = request.status === 'closed' || request.status === 'completed' || request.status === 'failed';
  const isRescheduled = (request.reschedule_count ?? 0) > 0;

  return (
    <div
      className={cn(
        'bg-white dark:bg-[#171717] rounded-lg border border-neutral-200 dark:border-[#262626] shadow-sm hover:shadow-md transition-shadow overflow-hidden',
        isRescheduled && !isArchive && 'border-l-[3px] border-l-warning-500'
      )}
    >
      <div className="p-4">
        {/* Header: Customer + Site + Priority */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 truncate">
              {customer?.company_name ?? '—'}
            </h4>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
              {site
                ? `${site.site_name}${site.account_no ? ` (${site.account_no})` : ''}`
                : t('card.noSite')}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            {request.priority !== 'normal' && (
              <Badge variant={PRIORITY_VARIANT[request.priority]} size="sm">
                {t(`priority.${request.priority}`)}
              </Badge>
            )}
            {isRescheduled && (
              <Badge variant="warning" size="sm">
                {t('failure.rescheduleCount', { count: request.reschedule_count })}
              </Badge>
            )}
          </div>
        </div>

        {/* Status Timeline */}
        <StatusTimeline
          contactStatus={request.contact_status}
          hasWorkOrder={!!request.work_order_id}
          isClosed={isClosed}
        />

        {/* Archive outcome badges */}
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

        {/* Meta row: region + work type + WO link */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <RegionBadge region={request.region} />
          <Badge variant="default" size="sm">
            {t(`workType.${request.work_type}`)}
          </Badge>
          {request.work_order_id && (
            <button
              type="button"
              onClick={() => navigate(`/work-orders/${request.work_order_id}`)}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium rounded bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100 dark:bg-primary-900/20 dark:text-primary-300 dark:border-primary-800 transition-colors"
            >
              <ClipboardList className="w-3 h-3" />
              {request.work_orders?.form_no
                ? `#${request.work_orders.form_no}`
                : t('card.workOrderLinked')}
            </button>
          )}
          {isArchive && (
            <span className="text-xs text-neutral-500 dark:text-neutral-400 ml-auto">
              {t(`contactStatus.${request.contact_status}`)}
            </span>
          )}
        </div>

        {/* Phone quick-copy */}
        {(customer?.phone || site?.contact_phone) && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-neutral-400 dark:text-neutral-500">
            <Phone className="w-3 h-3" />
            <span className="select-all">{site?.contact_phone ?? customer?.phone}</span>
          </div>
        )}
      </div>

      {/* Contextual Action Bar — pool cards only */}
      {!isArchive && (
        <CardActionBar
          request={request}
          onOpenCloseOutcome={onOpenCloseOutcome}
          onOpenBoomerang={onOpenBoomerang}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}
