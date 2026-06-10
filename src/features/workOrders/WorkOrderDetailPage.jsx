import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Package,
  FileText,
  Calendar,
  Clock,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { PageContainer } from '../../components/layout';
import {
  Button,
  Card,
  Modal,
  Skeleton,
  ErrorState,
  Table,
} from '../../components/ui';
import { formatDate, formatCurrency } from '../../lib/utils';
import { calcVatTevkifatSummary } from '../../lib/proposalCalc';
import { useQueryClient } from '@tanstack/react-query';
import { useFinanceSettings } from '../finance/hooks';
import { useWorkOrder, useUpdateWorkOrderStatus, useDeleteWorkOrder, workOrderKeys } from './hooks';
import { useProposal, useProposalWorkOrders } from '../proposals/hooks';
import { useRole } from '../../lib/roles';
import { WorkOrderHero } from './components/WorkOrderHero';
import { WorkOrderStatusActions } from './components/WorkOrderStatusActions';
import { WorkOrderCompletionModal } from './components/WorkOrderCompletionModal';
import { WorkOrderSiteCard } from './components/WorkOrderSiteCard';
import { WorkOrderProposalCard } from './components/WorkOrderProposalCard';
import { WorkOrderActivityTimeline } from './components/WorkOrderActivityTimeline';
import { ParasutInvoicePanel } from '../finance/components/ParasutInvoicePanel';

function WorkOrderDetailSkeleton() {
  return (
    <PageContainer maxWidth="full" padding="default" className="space-y-6">
      <div className="space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-24" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-12" />
          </div>
        </div>
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
      <Skeleton className="h-16 w-full rounded-xl" />
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 order-2 lg:order-1 space-y-6">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
        <div className="col-span-12 lg:col-span-4 order-1 lg:order-2 space-y-6">
          <Skeleton className="h-44 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-36 w-full rounded-xl" />
        </div>
      </div>
    </PageContainer>
  );
}

export function WorkOrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation(['workOrders', 'common', 'materials', 'proposals']);
  const { t: tCommon } = useTranslation('common');

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [statusToUpdate, setStatusToUpdate] = useState(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  const queryClient = useQueryClient();
  const { canWrite } = useRole();
  const { data: workOrder, isLoading, error, refetch } = useWorkOrder(id);
  const updateStatusMutation = useUpdateWorkOrderStatus();
  const deleteMutation = useDeleteWorkOrder();
  const { data: financeSettings } = useFinanceSettings();

  // For ready-to-bill nudge: fetch sibling WOs and linked proposal status.
  // Both queries are gated on proposal_id so they fire only for proposal-linked WOs.
  const proposalId = workOrder?.proposal_id ?? null;
  const { data: linkedProposal } = useProposal(proposalId);
  const { data: siblingWorkOrders = [] } = useProposalWorkOrders(proposalId);

  if (isLoading) {
    return <WorkOrderDetailSkeleton />;
  }

  if (error || !workOrder) {
    return (
      <PageContainer maxWidth="full" padding="default">
        <ErrorState
          title={t('workOrders:detail.errorTitle')}
          message={error?.message || t('workOrders:detail.notFound')}
          onRetry={() => refetch()}
        />
        <div className="mt-6 flex justify-center">
          <Button onClick={() => navigate('/work-orders')}>{tCommon('actions.back')}</Button>
        </div>
      </PageContainer>
    );
  }

  const handleStatusUpdate = () => {
    if (statusToUpdate) {
      updateStatusMutation.mutate(
        { id, status: statusToUpdate },
        { onSuccess: () => setStatusToUpdate(null) }
      );
    }
  };

  const handleDelete = () => {
    if (!id) return;
    setIsDeleteModalOpen(false);
    deleteMutation.mutate(id, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: workOrderKeys.lists() });
        navigate('/work-orders');
      },
    });
  };

  const handleEdit = () => navigate(`/work-orders/${id}/edit`);
  const isStandalone = !workOrder.proposal_id;
  const canStartWork = ['pending', 'scheduled'].includes(workOrder.status);

  // M2 + M5: ready-to-bill nudge.
  // Cancelled WOs are excluded from the "all done" check (M5).
  const allSiblingsSettled =
    siblingWorkOrders.length > 0 &&
    siblingWorkOrders.every(
      (wo) => wo.status === 'completed' || wo.status === 'cancelled'
    );
  const showReadyToBillNudge =
    !isStandalone &&
    workOrder.status === 'completed' &&
    linkedProposal?.status === 'accepted' &&
    allSiblingsSettled;
  const canCompleteWork = workOrder.status === 'in_progress';

  const items = workOrder.work_order_materials || [];
  const discountPercent = Number(workOrder.materials_discount_percent) || 0;
  const currency = workOrder.currency ?? 'TRY';
  const subtotal = items.reduce((sum, row) => {
    const qty = parseFloat(row.quantity) || 0;
    const price = currency === 'USD'
      ? (parseFloat(row.unit_price_usd) || 0)
      : (parseFloat(row.unit_price) || 0);
    return sum + qty * price;
  }, 0);
  const discountAmount = subtotal * (discountPercent / 100);
  const grandTotal = subtotal - discountAmount;
  const totalCosts = items.reduce((sum, row) => {
    const qty = parseFloat(row.quantity) || 0;
    const cost = currency === 'USD'
      ? (parseFloat(row.cost_usd) || 0)
      : (parseFloat(row.cost) || 0);
    return sum + cost * qty;
  }, 0);
  const netProfit = grandTotal - totalCosts;

  const vatRate = Number(workOrder.vat_rate) || 0;
  const hasTevkifat = !!workOrder.has_tevkifat;
  const tevkifatNum = Number(financeSettings?.tevkifat_rate_numerator) || 9;
  const tevkifatDen = Number(financeSettings?.tevkifat_rate_denominator) || 10;
  const { vatAmount, withheldVat, totalPayable } = calcVatTevkifatSummary(
    grandTotal,
    vatRate,
    hasTevkifat,
    tevkifatNum,
    tevkifatDen,
  );
  const vatRateLabel = (Number(vatRate) || 0).toLocaleString('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  const materialColumns = [
    {
      key: 'description',
      header: t('proposals:items.material'),
      render: (val, row) => (
        <div>
          <p className="font-bold text-neutral-900 dark:text-neutral-100">
            {val || row.materials?.name || '-'}
          </p>
          {row.materials?.code && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{row.materials.code}</p>
          )}
        </div>
      ),
    },
    {
      key: 'quantity',
      header: t('proposals:items.quantity'),
      render: (val, row) => (
        <span className="font-mono font-bold">
          {Number(val)}{' '}
          <span className="text-[10px] text-neutral-400 font-normal uppercase">
            {row.unit || 'adet'}
          </span>
        </span>
      ),
    },
    {
      key: 'unit_price',
      header: t('proposals:items.unitPrice'),
      render: (val, row) => {
        const price = currency === 'USD'
          ? (parseFloat(row.unit_price_usd) || 0)
          : (parseFloat(row.unit_price) || 0);
        return new Intl.NumberFormat('tr-TR', {
          style: 'currency',
          currency: currency,
          minimumFractionDigits: 2,
        }).format(price);
      },
    },
    {
      key: 'total',
      header: t('proposals:items.total'),
      render: (_, row) => {
        const qty = parseFloat(row.quantity) || 0;
        const price = currency === 'USD'
          ? (parseFloat(row.unit_price_usd) || 0)
          : (parseFloat(row.unit_price) || 0);
        return new Intl.NumberFormat('tr-TR', {
          style: 'currency',
          currency: currency,
          minimumFractionDigits: 2,
        }).format(qty * price);
      },
    },
  ];

  return (
    <PageContainer maxWidth="full" padding="default" className="space-y-5 pb-24">
      {/* Hero */}
      <WorkOrderHero
        workOrder={workOrder}
        onEdit={handleEdit}
        onDelete={() => setIsDeleteModalOpen(true)}
      />

      {/* Status Actions (desktop only) */}
      <WorkOrderStatusActions
        workOrder={workOrder}
        setStatusToUpdate={setStatusToUpdate}
        onComplete={isStandalone ? () => setShowCompletionModal(true) : undefined}
      />

      <div className="grid grid-cols-12 gap-6">
        {/* Zone 1 — actionable (left desktop) */}
        <div className="col-span-12 lg:col-span-8 order-2 lg:order-1 space-y-6">
        {/* Description */}
        <Card
          header={
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary-600" />
              <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-xs">
                {t('workOrders:form.fields.description')}
              </h3>
            </div>
          }
          className="p-6"
        >
          <p className="text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed">
            {workOrder.description || t('workOrders:detail.noDescription')}
          </p>
        </Card>

        {/* Materials */}
        <Card
          header={
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary-600" />
              <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-xs">
                {t('workOrders:detail.materialsUsed')}
              </h3>
            </div>
          }
          padding="compact"
        >
          <Table
            columns={materialColumns}
            data={items}
            emptyMessage={t('workOrders:detail.noMaterials')}
          />
          {items.length > 0 && (
            <div className="pt-4 mt-4 border-t border-neutral-200 dark:border-[#262626] space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-600 dark:text-neutral-400">
                  {t('proposals:detail.subtotal')}
                </span>
                <span className="text-neutral-900 dark:text-neutral-100 tabular-nums">
                  {formatCurrency(subtotal, currency)}
                </span>
              </div>
              {discountPercent > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-600 dark:text-neutral-400">
                    {t('proposals:detail.pricingDiscount')}
                  </span>
                  <span className="text-neutral-900 dark:text-neutral-100 tabular-nums">
                    -{formatCurrency(discountAmount, currency)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-600 dark:text-neutral-400">
                  {t('proposals:detail.pricingNetExclVat')}
                </span>
                <span className="text-neutral-900 dark:text-neutral-100 tabular-nums">
                  {formatCurrency(grandTotal, currency)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-600 dark:text-neutral-400">
                  {t('proposals:detail.pricingVatAtRate', { rate: vatRateLabel })}
                </span>
                <span className="text-neutral-900 dark:text-neutral-100 tabular-nums">
                  {formatCurrency(vatAmount, currency)}
                </span>
              </div>
              {hasTevkifat && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-600 dark:text-neutral-400">
                    {t('proposals:detail.pricingWithholdingDeduction')}
                  </span>
                  <span className="text-neutral-900 dark:text-neutral-100 tabular-nums">
                    -{formatCurrency(withheldVat, currency)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-[#262626]">
                <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wide">
                  {t('proposals:detail.pricingGrandTotalPayable')}
                </span>
                <span className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">
                  {formatCurrency(totalPayable, currency)}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">
                  {t('proposals:detail.netProfit')} (Dahili)
                </span>
                <span
                  className={`text-base font-bold ${
                    netProfit >= 0
                      ? 'text-green-600 dark:text-green-500'
                      : 'text-error-600 dark:text-error-400'
                  }`}
                >
                  {formatCurrency(netProfit, currency)}
                </span>
              </div>
            </div>
          )}
        </Card>

        <WorkOrderProposalCard proposalId={workOrder.proposal_id} />

        {/* M2: ready-to-bill nudge — shown when all sibling WOs are settled and proposal is still open */}
        {showReadyToBillNudge && (
          <div className="flex items-start gap-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 px-4 py-3">
            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold text-green-800 dark:text-green-200">
                {t('workOrders:readyToBill.title')}
              </p>
              {canWrite ? (
                <Link
                  to={`/proposals/${workOrder.proposal_id}`}
                  className="text-sm text-green-700 dark:text-green-400 underline underline-offset-2"
                >
                  {t('workOrders:readyToBill.canWriteAction')}
                </Link>
              ) : (
                <p className="text-sm text-green-700 dark:text-green-400">
                  {t('workOrders:readyToBill.fieldWorkerAction')}
                </p>
              )}
            </div>
          </div>
        )}

        {canWrite && isStandalone && workOrder.status === 'completed' && (
          <ParasutInvoicePanel workOrderId={id} />
        )}

        {workOrder.notes && (
          <Card
            header={
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-warning-600" />
                <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-[10px]">
                  {t('workOrders:form.sections.notes')}
                </h3>
              </div>
            }
            className="p-4 bg-warning-50/30 dark:bg-warning-950/10 border-warning-100 dark:border-warning-900/20"
          >
            <p className="text-xs text-neutral-600 dark:text-neutral-400 italic leading-relaxed">
              {workOrder.notes}
            </p>
          </Card>
        )}
        </div>

        {/* Zone 2 — context (right desktop); first on mobile */}
        <div className="col-span-12 lg:col-span-4 order-1 lg:order-2 space-y-6">
          <WorkOrderSiteCard workOrder={workOrder} />
          <Card className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center text-neutral-500 dark:text-neutral-400">
                  <Calendar className="w-4 h-4 mr-2" />
                  <span className="text-xs uppercase font-bold tracking-wider">
                    {t('workOrders:form.fields.scheduledDate')}
                  </span>
                </div>
                <span className="font-bold text-neutral-900 dark:text-neutral-100">
                  {workOrder.scheduled_date ? formatDate(workOrder.scheduled_date) : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center text-neutral-500 dark:text-neutral-400">
                  <Clock className="w-4 h-4 mr-2" />
                  <span className="text-xs uppercase font-bold tracking-wider">
                    {t('workOrders:form.fields.scheduledTime')}
                  </span>
                </div>
                <span className="font-bold text-neutral-900 dark:text-neutral-100">
                  {workOrder.scheduled_time || '—'}
                </span>
              </div>
            </div>

            <div className="pt-6 border-t border-neutral-100 dark:border-neutral-800">
              <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-widest mb-4">
                {t('workOrders:form.fields.assignedTo')}
              </p>
              <div className="space-y-3">
                {workOrder.assigned_workers && workOrder.assigned_workers.length > 0 ? (
                  workOrder.assigned_workers.map((worker) => (
                    <div
                      key={worker.id}
                      className="flex items-center gap-3 bg-neutral-50 dark:bg-neutral-900/50 p-2 rounded-xl border border-neutral-100 dark:border-neutral-800"
                    >
                      <div className="h-8 w-8 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
                        <span className="text-xs font-bold text-primary-700 dark:text-primary-300 uppercase">
                          {worker.name?.charAt(0) || '?'}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-neutral-700 dark:text-neutral-200">
                        {worker.name || tCommon('labels.unknown')}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-neutral-500 italic">{t('workOrders:detail.notAssignedYet')}</p>
                )}
              </div>
            </div>

            <div className="pt-6 border-t border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-bold text-neutral-400 tracking-widest">
                  {t('common:fields.amount')}
                </span>
                {workOrder.amount && workOrder.amount > 0 ? (
                  <span className="text-xl font-black text-primary-600 dark:text-primary-400">
                    {formatCurrency(workOrder.amount, currency)}
                  </span>
                ) : (
                  <span className="text-sm text-neutral-500 italic">
                    {t('workOrders:detail.amountNotEntered')}
                  </span>
                )}
              </div>
            </div>
          </Card>
          <WorkOrderActivityTimeline workOrderId={workOrder.id} />
        </div>
      </div>

      {/* Mobile FAB */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-white/80 dark:bg-[#171717]/80 backdrop-blur-md border-t border-neutral-200 dark:border-[#262626] z-50 flex gap-3 lg:hidden">
        {canStartWork && (
          <Button className="flex-1" onClick={() => setStatusToUpdate('in_progress')}>
            {t('workOrders:actions.start')}
          </Button>
        )}
        {canCompleteWork && (
          <Button
            className="flex-1"
            variant="success"
            onClick={() => isStandalone ? setShowCompletionModal(true) : setStatusToUpdate('completed')}
          >
            {t('workOrders:actions.complete')}
          </Button>
        )}
        <Button variant="outline" className="flex-1" onClick={handleEdit}>
          {tCommon('actions.edit')}
        </Button>
      </div>

      {/* Status confirmation modal */}
      <Modal
        open={!!statusToUpdate}
        onClose={() => setStatusToUpdate(null)}
        title={tCommon('labels.statusUpdate')}
        size="sm"
        footer={
          <div className="flex gap-3 w-full">
            <Button variant="ghost" onClick={() => setStatusToUpdate(null)} className="flex-1">
              {tCommon('actions.cancel')}
            </Button>
            <Button
              onClick={handleStatusUpdate}
              loading={updateStatusMutation.isPending}
              className="flex-1"
            >
              {tCommon('actions.confirm')}
            </Button>
          </div>
        }
      >
        <p className="text-center py-4">
          {t(
            `workOrders:statusChange.${
              statusToUpdate === 'in_progress'
                ? 'startConfirm'
                : statusToUpdate === 'completed'
                  ? 'completeConfirm'
                  : 'cancelConfirm'
            }`
          )}
        </p>
        {statusToUpdate === 'completed' && !isStandalone && currency === 'USD' && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 px-4 py-3 mt-1">
            <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700 dark:text-amber-300 leading-relaxed">
              {t('workOrders:statusChange.proposalLinkedUsdNote')}
            </p>
          </div>
        )}
      </Modal>

      {/* Standalone WO completion modal (payment routing) */}
      <WorkOrderCompletionModal
        open={showCompletionModal}
        onClose={() => setShowCompletionModal(false)}
        workOrder={workOrder}
      />

      {/* Delete confirmation modal */}
      <Modal
        open={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={t('workOrders:delete.title')}
        size="sm"
        footer={
          <div className="flex gap-3 w-full">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsDeleteModalOpen(false)}
              className="flex-1"
            >
              {tCommon('actions.cancel')}
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDelete}
              loading={deleteMutation.isPending}
              className="flex-1"
            >
              {tCommon('actions.delete')}
            </Button>
          </div>
        }
      >
        <p>{t('workOrders:delete.message')}</p>
        <p className="mt-2 text-sm text-error-600 dark:text-error-400 font-bold">
          {t('workOrders:delete.warning')}
        </p>
      </Modal>
    </PageContainer>
  );
}
