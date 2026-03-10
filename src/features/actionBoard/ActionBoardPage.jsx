import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/layout';
import { Button, Card, Badge, Spinner, ErrorState } from '../../components/ui';
import { formatDate, formatCurrency, cn } from '../../lib/utils';
import { useCurrentProfile } from '../subscriptions/hooks';
import { useActionBoardData } from './hooks';

/* ─────────────────────────────────────────────
   Section wrapper
───────────────────────────────────────────── */
function Section({ title, count, variant = 'error', children, empty, emptyText }) {
  const { t } = useTranslation('actionBoard');

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">{title}</h2>
        <Badge
          variant={empty ? 'success' : variant}
          size="sm"
          className="tabular-nums"
        >
          {count}
        </Badge>
      </div>

      {empty ? (
        <Card className="flex items-center gap-3 p-4 border-success-200 dark:border-success-800/40 bg-success-50 dark:bg-success-900/10">
          <CheckCircle2 className="w-4 h-4 text-success-600 dark:text-success-400 flex-shrink-0" />
          <p className="text-sm text-success-700 dark:text-success-300">{emptyText}</p>
        </Card>
      ) : (
        <div className="bg-white dark:bg-[#171717] rounded-2xl border border-neutral-200 dark:border-[#262626] overflow-hidden shadow-sm">
          {children}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Row components
───────────────────────────────────────────── */
function WorkOrderRow({ item, onClick }) {
  const { t } = useTranslation(['actionBoard', 'common']);

  return (
    <div
      className="flex items-center justify-between gap-4 px-4 py-3 border-b border-neutral-100 dark:border-[#262626] last:border-b-0 hover:bg-neutral-50 dark:hover:bg-[#1c1c1c] transition-colors cursor-pointer group"
      onClick={onClick}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50 truncate">
          {item.company_name}
        </p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
          {item.site_name} · {t(`common:workType.${item.work_type}`)}
        </p>
      </div>

      <div className="flex-shrink-0 text-right">
        <p className="text-xs text-neutral-500 dark:text-neutral-400">{formatDate(item.scheduled_date)}</p>
        <p className="text-xs font-medium text-error-600 dark:text-error-400">
          {t('actionBoard:columns.daysLate', { count: item.daysLate })}
        </p>
      </div>

      <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
    </div>
  );
}

function PaymentRow({ item, onClick }) {
  const { t } = useTranslation('actionBoard');

  return (
    <div
      className="flex items-center justify-between gap-4 px-4 py-3 border-b border-neutral-100 dark:border-[#262626] last:border-b-0 hover:bg-neutral-50 dark:hover:bg-[#1c1c1c] transition-colors cursor-pointer group"
      onClick={onClick}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50 truncate">
          {item.company_name}
        </p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
          {item.site_name}
        </p>
      </div>

      <div className="flex-shrink-0 text-right">
        <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
          {formatCurrency(item.amount)}
        </p>
        <p className="text-xs font-medium text-error-600 dark:text-error-400">
          {t('columns.daysOverdue', { count: item.daysOverdue })}
        </p>
      </div>

      <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
    </div>
  );
}

function ProposalRow({ item, onClick }) {
  const { t } = useTranslation('actionBoard');

  return (
    <div
      className="flex items-center justify-between gap-4 px-4 py-3 border-b border-neutral-100 dark:border-[#262626] last:border-b-0 hover:bg-neutral-50 dark:hover:bg-[#1c1c1c] transition-colors cursor-pointer group"
      onClick={onClick}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50 truncate">
          {item.customer_company_name}
        </p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
          #{item.proposal_no} · {item.title}
        </p>
      </div>

      <div className="flex-shrink-0 text-right">
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {formatDate(item.created_at)}
        </p>
      </div>

      <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main Page
───────────────────────────────────────────── */
export function ActionBoardPage() {
  const { t } = useTranslation('actionBoard');
  const navigate = useNavigate();
  const { data: profile } = useCurrentProfile();

  const {
    lateWorkOrders,
    overduePayments,
    pendingProposals,
    isLoading,
    errors,
    refetch,
  } = useActionBoardData();

  // Admin-only gate
  if (profile && profile.role !== 'admin') {
    return (
      <PageContainer maxWidth="lg" padding="default">
        <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
          <AlertCircle className="w-10 h-10 text-neutral-400" />
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Bu sayfa yalnızca yöneticiler tarafından görüntülenebilir.
          </p>
        </div>
      </PageContainer>
    );
  }

  const hasAnyError =
    errors.lateWorkOrders || errors.overduePayments || errors.pendingProposals;

  if (isLoading) {
    return (
      <PageContainer maxWidth="lg" padding="default">
        <div className="flex justify-center py-24">
          <Spinner size="lg" />
        </div>
      </PageContainer>
    );
  }

  if (hasAnyError) {
    return (
      <PageContainer maxWidth="lg" padding="default">
        <ErrorState onRetry={refetch} />
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="lg" padding="default" className="space-y-8 pb-12">
      <PageHeader title={t('title')} />

      {/* Section 1 — Late Work Orders */}
      <Section
        title={t('sections.lateWorkOrders.title')}
        count={lateWorkOrders.length}
        variant="error"
        empty={lateWorkOrders.length === 0}
        emptyText={t('sections.lateWorkOrders.empty')}
      >
        {lateWorkOrders.map((item) => (
          <WorkOrderRow
            key={item.id}
            item={item}
            onClick={() => navigate(`/work-orders/${item.id}/edit`)}
          />
        ))}
      </Section>

      {/* Section 2 — Overdue Payments */}
      <Section
        title={t('sections.overduePayments.title')}
        count={overduePayments.length}
        variant="error"
        empty={overduePayments.length === 0}
        emptyText={t('sections.overduePayments.empty')}
      >
        {overduePayments.map((item) => (
          <PaymentRow
            key={item.id}
            item={item}
            onClick={() => navigate(`/subscriptions/${item.subscription_id}`)}
          />
        ))}
      </Section>

      {/* Section 3 — Accepted Proposals Without WO */}
      <Section
        title={t('sections.pendingProposals.title')}
        count={pendingProposals.length}
        variant="warning"
        empty={pendingProposals.length === 0}
        emptyText={t('sections.pendingProposals.empty')}
      >
        {pendingProposals.map((item) => (
          <ProposalRow
            key={item.id}
            item={item}
            onClick={() => navigate(`/proposals/${item.id}`)}
          />
        ))}
      </Section>

      {/* Footer note */}
      <p className="text-xs text-neutral-400 dark:text-neutral-500 text-center pb-2">
        {t('realtimeNote')}
      </p>
    </PageContainer>
  );
}
