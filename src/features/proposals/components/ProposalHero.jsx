import {
  FileText,
  Download,
  Edit,
  Trash2,
  ChevronLeft,
  DollarSign,
  TrendingUp,
  ClipboardList,
  Calendar,
  Send,
  CheckCircle2,
  XCircle,
  Receipt,
  Plus,
  MapPin,
  Info,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button, IconButton } from '../../../components/ui';
import { cn, formatDate, formatCurrency } from '../../../lib/utils';
import { ProposalStatusBadge } from './ProposalStatusBadge';

function customerInitials(name) {
  if (!name || !String(name).trim()) return '?';
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  const s = parts[0];
  return (s.length >= 2 ? s.slice(0, 2) : s).toUpperCase();
}

export function ProposalHero({
  proposal,
  grandTotal,
  netProfit,
  linkedWorkOrders = [],
  onEdit,
  onDelete,
  onDownloadPdf,
  isExporting,
  onFlowAction,
  onFaturalandir,
  onCreateWorkOrder,
  flowLoading,
}) {
  const { t } = useTranslation(['proposals', 'common']);
  const status = proposal?.status;

  const currency = proposal.currency ?? 'USD';
  const completedCount = linkedWorkOrders.filter((wo) => wo.status === 'completed').length;
  const totalCount = linkedWorkOrders.length;
  const openWorkOrdersCount = linkedWorkOrders.filter(
    (wo) => wo.status !== 'completed' && wo.status !== 'cancelled'
  ).length;
  const workOrdersStr =
    totalCount > 0
      ? t('proposals:detail.workOrderCount', { completed: completedCount, total: totalCount })
      : '—';

  const hasDate = proposal.accepted_at || proposal.rejected_at || proposal.sent_at;
  const dateLabel = hasDate
    ? proposal.accepted_at
      ? t('proposals:dateLabels.accepted')
      : proposal.rejected_at
        ? t('proposals:dateLabels.rejected')
        : t('proposals:dateLabels.sent')
    : t('proposals:detail.summary.sentAt', 'Tarih');
  const dateValue = hasDate
    ? formatDate(proposal.accepted_at || proposal.rejected_at || proposal.sent_at)
    : '—';

  const customerDisplayName =
    proposal.customer_company_name || proposal.company_name || '—';
  const siteDisplayName = proposal.site_name?.trim() || '';

  return (
    <div className="space-y-4">
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
          {/* Akış butonu — PDF'nin solunda */}
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
          {(status === 'accepted' || status === 'completed') && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              leftIcon={
                proposal?.site_id ? (
                  <Plus className="w-4 h-4" />
                ) : (
                  <MapPin className="w-4 h-4" />
                )
              }
              disabled={!proposal?.site_id && !proposal?.customer_id}
              title={
                !proposal?.site_id && proposal?.customer_id
                  ? t('proposals:detail.addSiteAndWorkOrder')
                  : undefined
              }
              onClick={() => onCreateWorkOrder?.()}
            >
              {t('proposals:detail.actions.createWorkOrder')}
            </Button>
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
          {status === 'completed' && (
            <Button
              size="sm"
              variant="success"
              leftIcon={<Receipt className="w-4 h-4" />}
              onClick={onFaturalandir}
            >
              {t('proposals:detail.actions.bill')}
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
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Edit className="w-4 h-4" />}
            onClick={onEdit}
          >
            {t('proposals:detail.actions.edit')}
          </Button>
          <IconButton
            icon={Trash2}
            variant="ghost"
            size="sm"
            onClick={onDelete}
            aria-label={t('common:actions.delete')}
            className="text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-950/30"
          />
        </div>
      </div>

      {(status === 'accepted' || status === 'completed') && openWorkOrdersCount > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-neutral-200/80 dark:border-[#333] bg-neutral-50/70 dark:bg-[#1a1a1a]/80 px-3 py-2">
          <Info className="w-5 h-5 shrink-0 mt-0.5 text-primary-600 dark:text-primary-400" aria-hidden />
          <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            {t('proposals:detail.openWorkOrdersHint', { count: openWorkOrdersCount })}
          </p>
        </div>
      )}

      {/* Hero Card */}
      <div className="rounded-xl border border-neutral-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-5 shadow-sm">
        {/* Identity row */}
        <div className="flex items-start gap-4 mb-5">
          <div className="p-3 rounded-xl bg-primary-100 dark:bg-primary-950/40 flex-shrink-0">
            <FileText className="w-7 h-7 text-primary-600 dark:text-primary-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-50 leading-tight truncate">
                  {proposal.title}
                </h1>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5 font-mono truncate">
                  {proposal.proposal_no || '—'}
                </p>
              </div>
              <div className="flex items-center flex-shrink-0">
                <ProposalStatusBadge status={proposal.status} size="sm" />
              </div>
            </div>

            <div
              className={cn(
                'mt-4 flex gap-3 rounded-xl border border-neutral-200/90 dark:border-[#333]',
                'bg-neutral-50/90 dark:bg-[#141414] p-4'
              )}
            >
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-950/50 text-sm font-bold text-primary-800 dark:text-primary-200"
                aria-hidden
              >
                {customerInitials(customerDisplayName)}
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                    {t('proposals:detail.customerCard.customerLabel')}
                  </p>
                  {proposal.customer_id ? (
                    <Link
                      to={`/customers/${proposal.customer_id}`}
                      className="mt-0.5 block text-lg font-semibold leading-snug text-neutral-900 dark:text-neutral-50 hover:text-primary-600 dark:hover:text-primary-400 transition-colors truncate"
                      title={t('proposals:detail.customerCard.viewCustomer')}
                    >
                      {customerDisplayName}
                    </Link>
                  ) : (
                    <p className="mt-0.5 text-lg font-semibold leading-snug text-neutral-900 dark:text-neutral-50 truncate">
                      {customerDisplayName}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                    {t('proposals:detail.customerCard.locationLabel')}
                  </p>
                  <p
                    className={cn(
                      'mt-0.5 text-base leading-snug',
                      siteDisplayName
                        ? 'text-neutral-800 dark:text-neutral-200'
                        : 'text-neutral-400 dark:text-neutral-500 italic'
                    )}
                  >
                    {siteDisplayName || t('proposals:detail.customerCard.noLocation')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
            <DollarSign className="w-4 h-4 text-neutral-500 dark:text-neutral-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-wider">
                {t('proposals:detail.total')}
              </p>
              <p className="text-sm font-bold text-neutral-900 dark:text-neutral-50 mt-0.5 tabular-nums">
                {formatCurrency(grandTotal, currency)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
            <TrendingUp className="w-4 h-4 text-neutral-500 dark:text-neutral-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-wider">
                {t('proposals:detail.netProfit')}
              </p>
              <p className="text-sm font-bold text-neutral-900 dark:text-neutral-50 mt-0.5 tabular-nums">
                {formatCurrency(netProfit, currency)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
            <ClipboardList className="w-4 h-4 text-neutral-500 dark:text-neutral-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-wider">
                {t('proposals:detail.workOrders')}
              </p>
              <p className="text-sm font-bold text-neutral-900 dark:text-neutral-50 mt-0.5">
                {workOrdersStr}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
            <Calendar className="w-4 h-4 text-neutral-500 dark:text-neutral-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-wider">
                {dateLabel || t('proposals:dateLabels.sent')}
              </p>
              <p className="text-sm font-bold text-neutral-900 dark:text-neutral-50 mt-0.5 tabular-nums">
                {dateValue}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
