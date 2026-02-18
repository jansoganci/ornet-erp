import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Package,
  FileText,
  Calendar,
  Clock,
  Info,
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
import { useWorkOrder, useUpdateWorkOrderStatus, useDeleteWorkOrder } from './hooks';
import { WorkOrderHero } from './components/WorkOrderHero';
import { WorkOrderStatusActions } from './components/WorkOrderStatusActions';
import { WorkOrderSiteCard } from './components/WorkOrderSiteCard';
import { WorkOrderProposalCard } from './components/WorkOrderProposalCard';

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
        <Skeleton className="h-36 w-full rounded-xl" />
      </div>
      <Skeleton className="h-16 w-full rounded-xl" />
      <div className="space-y-6">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
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

  const { data: workOrder, isLoading, error, refetch } = useWorkOrder(id);
  const updateStatusMutation = useUpdateWorkOrderStatus();
  const deleteMutation = useDeleteWorkOrder();

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
      onSuccess: () => window.location.replace('/work-orders'),
    });
  };

  const handleEdit = () => navigate(`/work-orders/${id}/edit`);

  const items = workOrder.work_order_materials || [];
  const discountPercent = Number(workOrder.materials_discount_percent) || 0;
  const currency = workOrder.currency ?? 'TRY';
  const subtotal = items.reduce((sum, row) => {
    const qty = parseFloat(row.quantity) || 0;
    const price = parseFloat(row.unit_price ?? row.unit_price_usd) || 0;
    return sum + qty * price;
  }, 0);
  const discountAmount = subtotal * (discountPercent / 100);
  const grandTotal = subtotal - discountAmount;
  const totalCosts = items.reduce((sum, row) => {
    const qty = parseFloat(row.quantity) || 0;
    const cost = parseFloat(row.cost ?? row.cost_usd) || 0;
    return sum + cost * qty;
  }, 0);
  const netProfit = grandTotal - totalCosts;

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
        const price = parseFloat(val ?? row.unit_price_usd ?? 0);
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
        const price = parseFloat(row.unit_price ?? row.unit_price_usd) || 0;
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
      />

      {/* Content sections — single column */}
      <div className="space-y-6">
        {/* Lokasyon + Planlama kartları — desktop: 1x2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <WorkOrderSiteCard workOrder={workOrder} />
          {/* Planlama & Atama */}
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
                  <span className="text-xl font-black text-primary-600">
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
        </div>

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
                <span className="text-neutral-900 dark:text-neutral-100">
                  {formatCurrency(subtotal, currency)}
                </span>
              </div>
              {discountPercent > 0 && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-600 dark:text-neutral-400">
                      {t('proposals:form.fields.discountPercent')}
                    </span>
                    <span className="text-neutral-900 dark:text-neutral-100">{discountPercent}%</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-600 dark:text-neutral-400">
                      {t('proposals:detail.discountAmount')}
                    </span>
                    <span className="text-neutral-900 dark:text-neutral-100">
                      -{formatCurrency(discountAmount, currency)}
                    </span>
                  </div>
                </>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-[#262626]">
                <span className="text-sm font-bold text-neutral-700 dark:text-neutral-300 uppercase">
                  {t('proposals:detail.total')}
                </span>
                <span className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  {formatCurrency(grandTotal, currency)}
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

      {/* Mobile FAB */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-[#171717]/80 backdrop-blur-md border-t border-neutral-200 dark:border-[#262626] z-50 flex gap-3 lg:hidden">
        {workOrder.status === 'pending' && (
          <Button className="flex-1" onClick={() => setStatusToUpdate('in_progress')}>
            {t('workOrders:actions.start')}
          </Button>
        )}
        {workOrder.status === 'in_progress' && (
          <Button
            className="flex-1"
            variant="success"
            onClick={() => setStatusToUpdate('completed')}
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
      </Modal>

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
