import { useEffect, useRef, useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  Edit,
  Trash2,
  ChevronLeft,
  Send,
  CheckCircle2,
  XCircle,
  Info,
  MoreVertical,
  GitBranch,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button, IconButton } from '../../../components/ui';
import { cn, formatDate, formatCurrency } from '../../../lib/utils';
import { ProposalStatusBadge } from './ProposalStatusBadge';

function InfoChip({ label, value, valueClassName }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-100 dark:border-[#333] px-3 py-1.5 text-sm">
      <span className="text-neutral-500 dark:text-neutral-400 shrink-0">{label}</span>
      <span className={cn('font-semibold text-neutral-900 dark:text-neutral-100 tabular-nums', valueClassName)}>
        {value || '—'}
      </span>
    </div>
  );
}

function MetaSeparator() {
  return <span className="text-neutral-300 dark:text-neutral-600 select-none" aria-hidden>·</span>;
}

export function ProposalHero({
  proposal,
  grandTotal,
  netProfit,
  linkedWorkOrders = [],
  onEdit,
  onRevise,
  onDelete,
  onDownloadPdf,
  isExporting,
  onDownloadSupplierList,
  onFlowAction,
  flowLoading,
}) {
  const { t } = useTranslation(['proposals', 'common']);
  const status = proposal?.status;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const currency = proposal.currency ?? 'USD';
  const completedCount = linkedWorkOrders.filter((wo) => wo.status === 'completed').length;
  const totalCount = linkedWorkOrders.length;
  const openWorkOrdersCount = linkedWorkOrders.filter(
    (wo) => wo.status !== 'completed' && wo.status !== 'cancelled',
  ).length;
  const workOrdersStr =
    totalCount > 0
      ? t('proposals:detail.workOrderCount', { completed: completedCount, total: totalCount })
      : '—';

  const customerDisplayName =
    proposal.customer_company_name || proposal.company_name || '—';
  const siteDisplayName = proposal.site_name?.trim() || '';
  const addressParts = [proposal.site_address, proposal.city].filter(Boolean);
  const addressLine = addressParts.join(', ');

  const acceptedOrRejectedValue = proposal.accepted_at
    ? formatDate(proposal.accepted_at)
    : proposal.rejected_at
      ? formatDate(proposal.rejected_at)
      : null;
  const canEdit = status === 'draft' || status === 'sent';
  const canRevise = status === 'accepted' || status === 'completed';

  useEffect(() => {
    if (!menuOpen) return undefined;

    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [menuOpen]);

  return (
    <div className="space-y-3">
      {/* Breadcrumb + Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/proposals"
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          {t('common:nav.proposals')}
        </Link>

        <div className="flex items-center gap-2 flex-wrap">
          {status === 'draft' && (
            <Button
              size="sm"
              leftIcon={<Send className="w-4 h-4" />}
              onClick={() => onFlowAction?.('sent')}
              loading={flowLoading}
            >
              {t('proposals:detail.actions.markSent')}
            </Button>
          )}
          {status === 'sent' && (
            <>
              <Button
                size="sm"
                leftIcon={<CheckCircle2 className="w-4 h-4" />}
                onClick={() => onFlowAction?.('accepted')}
                loading={flowLoading}
              >
                {t('proposals:detail.actions.accept')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<XCircle className="w-4 h-4" />}
                onClick={() => onFlowAction?.('rejected')}
              >
                {t('proposals:detail.actions.reject')}
              </Button>
            </>
          )}
          {status === 'accepted' && (
            <Button
              size="sm"
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
              onClick={() => onFlowAction?.('completed')}
              loading={flowLoading}
            >
              {t('proposals:detail.actions.markComplete')}
            </Button>
          )}
          {status === 'completed' && onDownloadSupplierList && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<FileSpreadsheet className="w-4 h-4" />}
              type="button"
              onClick={onDownloadSupplierList}
            >
              {t('proposals:detail.actions.downloadSupplierList')}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Download className="w-4 h-4" />}
            onClick={onDownloadPdf}
            loading={isExporting}
          >
            {t('proposals:detail.actions.downloadPdf')}
          </Button>
          <div className="relative" ref={menuRef}>
            <IconButton
              icon={MoreVertical}
              variant="ghost"
              size="sm"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={t('common:actions.more')}
            />
            {menuOpen && (
              <div className="absolute right-0 top-full z-20 mt-2 min-w-[12rem] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl dark:border-[#262626] dark:bg-[#171717]">
                {canEdit && (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-neutral-800 transition-colors hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-[#1f1f1f]"
                    onClick={() => {
                      setMenuOpen(false);
                      onEdit?.();
                    }}
                  >
                    <Edit className="w-4 h-4" />
                    {t('proposals:detail.actions.edit')}
                  </button>
                )}
                {canRevise && (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-neutral-800 transition-colors hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-[#1f1f1f]"
                    onClick={() => {
                      setMenuOpen(false);
                      onRevise?.();
                    }}
                  >
                    <GitBranch className="w-4 h-4" />
                    {t('proposals:detail.actions.revise')}
                  </button>
                )}
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-error-700 transition-colors hover:bg-error-50 dark:text-error-300 dark:hover:bg-error-950/20"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete?.();
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                  {t('common:actions.delete')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {(status === 'accepted' || status === 'completed') && openWorkOrdersCount > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-neutral-200/80 dark:border-[#333] bg-neutral-50/70 dark:bg-[#1a1a1a]/80 px-3 py-2">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-primary-600 dark:text-primary-400" aria-hidden />
          <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            {t('proposals:detail.openWorkOrdersHint', { count: openWorkOrdersCount })}
          </p>
        </div>
      )}

      {/* Compact summary card */}
      <div className="rounded-xl border border-neutral-200 dark:border-[#262626] bg-white dark:bg-[#171717] px-5 py-4 shadow-sm space-y-3">
        {/* Row 1 — identity */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-50 leading-snug truncate max-w-full">
            {proposal.title}
          </h1>
          {proposal.proposal_no && (
            <>
              <MetaSeparator />
              <span className="text-base font-mono text-neutral-500 dark:text-neutral-400 shrink-0">
                {proposal.proposal_no}
              </span>
            </>
          )}
          <ProposalStatusBadge status={proposal.status} size="md" />
        </div>

        {/* Row 2 — customer & location */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-base leading-relaxed text-neutral-700 dark:text-neutral-300 min-w-0">
          {proposal.customer_id ? (
            <Link
              to={`/customers/${proposal.customer_id}`}
              className="font-medium text-neutral-900 dark:text-neutral-100 hover:text-primary-600 dark:hover:text-primary-400 transition-colors truncate max-w-full"
              title={t('proposals:detail.customerCard.viewCustomer')}
            >
              {customerDisplayName}
            </Link>
          ) : (
            <span className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
              {customerDisplayName}
            </span>
          )}
          {siteDisplayName && (
            <>
              <MetaSeparator />
              <span className="truncate">{siteDisplayName}</span>
            </>
          )}
          {addressLine && (
            <>
              <MetaSeparator />
              <span className="text-neutral-500 dark:text-neutral-400 truncate">{addressLine}</span>
            </>
          )}
          {!siteDisplayName && !addressLine && (
            <>
              <MetaSeparator />
              <span className="text-neutral-400 dark:text-neutral-500 italic">
                {t('proposals:detail.customerCard.noLocation')}
              </span>
            </>
          )}
        </div>

        {/* Row 3 — metrics & meta chips */}
        <div className="flex flex-wrap gap-2 pt-3 border-t border-neutral-100 dark:border-[#262626]">
          <InfoChip
            label={t('proposals:detail.total')}
            value={formatCurrency(grandTotal, currency)}
          />
          <InfoChip
            label={t('proposals:detail.netProfit')}
            value={formatCurrency(netProfit, currency)}
          />
          <InfoChip
            label={t('proposals:detail.workOrders')}
            value={workOrdersStr}
          />
          <InfoChip
            label={t('proposals:detail.summary.createdAt')}
            value={proposal.created_at ? formatDate(proposal.created_at) : null}
          />
          <InfoChip
            label={t('proposals:detail.summary.sentAt')}
            value={proposal.sent_at ? formatDate(proposal.sent_at) : null}
          />
          <InfoChip
            label={t('proposals:detail.summary.acceptedOrRejectedAt')}
            value={acceptedOrRejectedValue}
          />
          {(proposal.authorized_person || proposal.customer_representative) && (
            <>
              {proposal.authorized_person && (
                <InfoChip
                  label={t('proposals:form.fields.authorizedPerson')}
                  value={proposal.authorized_person}
                />
              )}
              {proposal.customer_representative && (
                <InfoChip
                  label={t('proposals:form.fields.customerRepresentative')}
                  value={proposal.customer_representative}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
