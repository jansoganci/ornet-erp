import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Edit,
  Trash2,
  Phone,
  MapPin,
  Calendar,
  User,
  Package,
  FileText,
  Clock,
  Building2,
  Info,
  Hash,
  ChevronRight,
  FileCheck
} from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/layout';
import { 
  Button, 
  Badge, 
  Spinner, 
  Card, 
  Modal,
  IconButton,
  Skeleton,
  ErrorState,
  Table
} from '../../components/ui';
import { 
  formatDate, 
  formatCurrency,
  workOrderStatusVariant, 
} from '../../lib/utils';
import { useWorkOrder, useUpdateWorkOrderStatus, useDeleteWorkOrder } from './hooks';

function WorkOrderDetailSkeleton() {
  return (
    <PageContainer maxWidth="lg" padding="default" className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Skeleton className="w-12 h-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-48" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="h-48 w-full" />
          <Card className="h-64 w-full" />
        </div>
        <div className="space-y-6">
          <Card className="h-96 w-full" />
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

  const { data: workOrder, isLoading, error, refetch } = useWorkOrder(id);
  const updateStatusMutation = useUpdateWorkOrderStatus();
  const deleteMutation = useDeleteWorkOrder();

  useEffect(() => {
    console.log('[WORK_ORDER_DETAIL] isDeleteModalOpen değişti:', isDeleteModalOpen);
  }, [isDeleteModalOpen]);

  if (isLoading) {
    return <WorkOrderDetailSkeleton />;
  }

  if (error || !workOrder) {
    return (
      <PageContainer maxWidth="lg" padding="default">
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
        {
          onSuccess: () => setStatusToUpdate(null)
        }
      );
    }
  };

  const handleDelete = () => {
    console.log('[WORK_ORDER_DETAIL] handleDelete çağrıldı, id:', id, 'tip:', typeof id);
    if (!id) {
      console.error('[WORK_ORDER_DETAIL] handleDelete: id yok, çıkıyorum');
      return;
    }
    setIsDeleteModalOpen(false);
    console.log('[WORK_ORDER_DETAIL] Modal kapatıldı, deleteMutation.mutate çağrılıyor...');
    deleteMutation.mutate(id, {
      onSuccess: () => {
        console.log('[WORK_ORDER_DETAIL] mutate onSuccess - yönlendiriliyor');
        // Tam sayfa yönlendirme: liste kesin yenilensin
        window.location.replace('/work-orders');
      },
      onError: (err) => {
        console.error('[WORK_ORDER_DETAIL] mutate onError:', err);
      }
    });
  };

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
      header: t('proposals:items.material'),
      accessor: 'description',
      render: (val, row) => (
        <div>
          <p className="font-bold text-neutral-900 dark:text-neutral-100">{val || row.materials?.name || '-'}</p>
          {row.materials?.code && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{row.materials.code}</p>
          )}
        </div>
      )
    },
    {
      header: t('proposals:items.quantity'),
      accessor: 'quantity',
      render: (val, row) => (
        <span className="font-mono font-bold">
          {Number(val)} <span className="text-[10px] text-neutral-400 font-normal uppercase">{row.unit || 'adet'}</span>
        </span>
      )
    },
    {
      header: t('proposals:items.unitPrice'),
      accessor: 'unit_price',
      render: (val, row) => {
        const price = parseFloat(val ?? row.unit_price_usd ?? 0);
        return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: currency, minimumFractionDigits: 2 }).format(price);
      }
    },
    {
      header: t('proposals:items.total'),
      accessor: 'total',
      render: (_, row) => {
        const qty = parseFloat(row.quantity) || 0;
        const price = parseFloat(row.unit_price ?? row.unit_price_usd) || 0;
        return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: currency, minimumFractionDigits: 2 }).format(qty * price);
      }
    }
  ];

  return (
    <PageContainer maxWidth="lg" padding="default" className="space-y-6 pb-24">
      {/* Header */}
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <span>{tCommon(`workType.${workOrder.work_type}`)}</span>
            {workOrder.form_no && (
              <Badge variant="default" className="font-mono text-sm">#{workOrder.form_no}</Badge>
            )}
          </div>
        }
        description={
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={workOrderStatusVariant[workOrder.status]} dot>
              {tCommon(`status.${workOrder.status}`)}
            </Badge>
            <span className="text-neutral-300 dark:text-neutral-700">|</span>
            <Badge variant="outline" size="sm" className="uppercase tracking-wider">
              {t(`workOrders:priorities.${workOrder.priority}`)}
            </Badge>
          </div>
        }
        breadcrumbs={[
          { label: tCommon('nav.workOrders'), to: '/work-orders' },
          { label: workOrder.company_name, to: `/customers/${workOrder.customer_id}` },
          { label: workOrder.site_name || workOrder.site_address },
          { label: workOrder.form_no ? `WO-${workOrder.form_no}` : `#${id?.slice(0, 8)}` }
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              leftIcon={<Edit className="w-4 h-4" />}
              onClick={() => navigate(`/work-orders/${id}/edit`)}
            >
              {tCommon('actions.edit')}
            </Button>
            <IconButton 
              type="button"
              variant="danger" 
              icon={Trash2}
              onClick={(e) => {
                console.log('[WORK_ORDER_DETAIL] Çöp kutusu tıklandı');
                e.preventDefault();
                e.stopPropagation();
                setIsDeleteModalOpen(true);
                console.log('[WORK_ORDER_DETAIL] Modal açıldı (isDeleteModalOpen=true)');
              }}
              aria-label={tCommon('actions.delete')}
            />
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
        {/* Left Column: Core Info */}
        <div className="lg:col-span-2 space-y-8">
          {/* Site & Company Info */}
          <Card className="overflow-hidden border-primary-100 dark:border-primary-900/20">
            <div className="bg-primary-50/50 dark:bg-primary-950/10 px-6 py-4 border-b border-primary-100 dark:border-primary-900/20 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-primary-600" />
                <h3 className="font-bold text-primary-900 dark:text-primary-100 uppercase tracking-wider text-xs">
                  {t('workOrders:detail.siteInfo')}
                </h3>
              </div>
              <Badge variant="info" className="font-mono">{workOrder.account_no || '---'}</Badge>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-widest mb-1">
                    {t('workOrders:detail.companyInfo')}
                  </p>
                  <Link to={`/customers/${workOrder.customer_id}`} className="group flex items-center">
                    <span className="font-bold text-neutral-900 dark:text-neutral-100 group-hover:text-primary-600 transition-colors">
                      {workOrder.company_name}
                    </span>
                    <ChevronRight className="w-4 h-4 ml-1 text-neutral-300 group-hover:text-primary-600 transition-colors" />
                  </Link>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-widest mb-1">
                    {t('customers:sites.fields.siteName')}
                  </p>
                  <p className="font-medium text-neutral-700 dark:text-neutral-300">
                    {workOrder.site_name || '---'}
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-widest mb-1">
                    {t('customers:sites.fields.address')}
                  </p>
                  <div className="flex items-start">
                    <MapPin className="w-4 h-4 mr-2 mt-0.5 text-neutral-400 shrink-0" />
                    <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                      {workOrder.site_address}<br />
                      {workOrder.district} {workOrder.city}
                    </p>
                  </div>
                </div>
                {workOrder.site_phone && (
                  <div>
                    <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-widest mb-1">
                      {t('customers:sites.fields.contactPhone')}
                    </p>
                    <a href={`tel:${workOrder.site_phone}`} className="flex items-center text-sm font-bold text-primary-600">
                      <Phone className="w-4 h-4 mr-2 shrink-0" />
                      {workOrder.site_phone}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Description */}
          <Card header={
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-primary-600" />
              <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-xs">
                {t('workOrders:form.fields.description')}
              </h3>
            </div>
          } className="p-6">
            <p className="text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed">
              {workOrder.description || t('workOrders:detail.noDescription')}
            </p>
          </Card>

          {/* Materials Table */}
          <Card header={
            <div className="flex items-center space-x-2">
              <Package className="w-5 h-5 text-primary-600" />
              <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-xs">
                {t('workOrders:detail.materialsUsed')}
              </h3>
            </div>
          } padding="compact">
            <Table
              columns={materialColumns}
              data={items}
              emptyMessage={t('workOrders:detail.noMaterials')}
            />
            {items.length > 0 && (
              <div className="pt-4 mt-4 border-t border-neutral-200 dark:border-[#262626] space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-600 dark:text-neutral-400">{t('proposals:detail.subtotal')}</span>
                  <span className="text-neutral-900 dark:text-neutral-100">{formatCurrency(subtotal, currency)}</span>
                </div>
                {discountPercent > 0 && (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-600 dark:text-neutral-400">{t('proposals:form.fields.discountPercent')}</span>
                      <span className="text-neutral-900 dark:text-neutral-100">{discountPercent}%</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-600 dark:text-neutral-400">{t('proposals:detail.discountAmount')}</span>
                      <span className="text-neutral-900 dark:text-neutral-100">-{formatCurrency(discountAmount, currency)}</span>
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-[#262626]">
                  <span className="text-sm font-bold text-neutral-700 dark:text-neutral-300 uppercase">{t('proposals:detail.total')}</span>
                  <span className="text-lg font-bold text-neutral-900 dark:text-neutral-100">{formatCurrency(grandTotal, currency)}</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">{t('proposals:detail.netProfit')} (Dahili)</span>
                  <span className={`text-base font-bold ${netProfit >= 0 ? 'text-green-600 dark:text-green-500' : 'text-error-600 dark:text-error-400'}`}>
                    {formatCurrency(netProfit, currency)}
                  </span>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Meta & Actions */}
        <div className="space-y-8">
          {/* Schedule & Assignment */}
          <Card className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center text-neutral-500 dark:text-neutral-400">
                  <Calendar className="w-4 h-4 mr-2" />
                  <span className="text-xs uppercase font-bold tracking-wider">{t('workOrders:form.fields.scheduledDate')}</span>
                </div>
                <span className="font-bold text-neutral-900 dark:text-neutral-100">
                  {workOrder.scheduled_date ? formatDate(workOrder.scheduled_date) : '---'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center text-neutral-500 dark:text-neutral-400">
                  <Clock className="w-4 h-4 mr-2" />
                  <span className="text-xs uppercase font-bold tracking-wider">{t('workOrders:form.fields.scheduledTime')}</span>
                </div>
                <span className="font-bold text-neutral-900 dark:text-neutral-100">
                  {workOrder.scheduled_time || '---'}
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
                    <div key={worker.id} className="flex items-center space-x-3 bg-neutral-50 dark:bg-neutral-900/50 p-2 rounded-xl border border-neutral-100 dark:border-neutral-800">
                      <div className="h-8 w-8 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
                        <span className="text-xs font-bold text-primary-700 dark:text-primary-300 uppercase">
                          {worker.name?.charAt(0) || '?'}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-neutral-700 dark:text-neutral-200">{worker.name || tCommon('labels.unknown')}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-neutral-500 italic">{t('workOrders:detail.notAssignedYet')}</p>
                )}
              </div>
            </div>

            <div className="pt-6 border-t border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-bold text-neutral-400 tracking-widest">{t('common:fields.amount')}</span>
                {workOrder.amount && workOrder.amount > 0 ? (
                  <span className="text-xl font-black text-primary-600">
                    {formatCurrency(workOrder.amount, currency)}
                  </span>
                ) : (
                  <span className="text-sm text-neutral-500 italic">{t('workOrders:detail.amountNotEntered')}</span>
                )}
              </div>
            </div>
          </Card>

          {/* Proposal Link */}
          {workOrder.proposal_id && (
            <Card className="p-4 bg-primary-50/50 dark:bg-primary-950/10 border-primary-100 dark:border-primary-900/20">
              <Link
                to={`/proposals/${workOrder.proposal_id}`}
                className="flex items-center gap-3 group"
              >
                <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                  <FileCheck className="w-4 h-4 text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase font-bold text-primary-500 tracking-widest">
                    {t('workOrders:detail.proposalLink', 'Teklif')}
                  </p>
                  <p className="text-sm font-bold text-primary-700 dark:text-primary-300 group-hover:text-primary-600 transition-colors truncate">
                    {t('workOrders:detail.viewProposal', 'Teklifi Görüntüle')}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-primary-400 group-hover:text-primary-600 transition-colors" />
              </Link>
            </Card>
          )}

          {/* Internal Notes */}
          {workOrder.notes && (
            <Card header={
              <div className="flex items-center space-x-2">
                <Info className="w-4 h-4 text-warning-600" />
                <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-[10px]">
                  {t('workOrders:form.sections.notes')}
                </h3>
              </div>
            } className="p-4 bg-warning-50/30 dark:bg-warning-950/10 border-warning-100 dark:border-warning-900/20">
              <p className="text-xs text-neutral-600 dark:text-neutral-400 italic leading-relaxed">
                {workOrder.notes}
              </p>
            </Card>
          )}

          {/* Status Actions */}
          <div className="space-y-3">
            {workOrder.status === 'pending' && (
              <Button 
                className="w-full h-12 shadow-lg shadow-primary-600/20" 
                onClick={() => setStatusToUpdate('in_progress')}
                loading={updateStatusMutation.isPending}
              >
                {t('workOrders:actions.start')}
              </Button>
            )}
            
            {workOrder.status === 'in_progress' && (
              <Button 
                className="w-full h-12 shadow-lg shadow-success-600/20" 
                variant="success"
                onClick={() => setStatusToUpdate('completed')}
                loading={updateStatusMutation.isPending}
              >
                {t('workOrders:actions.complete')}
              </Button>
            )}

            {!['completed', 'cancelled'].includes(workOrder.status) && (
              <Button 
                className="w-full" 
                variant="ghost"
                onClick={() => setStatusToUpdate('cancelled')}
                loading={updateStatusMutation.isPending}
              >
                {t('workOrders:actions.cancel')}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Floating Action Bar for Mobile */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-[#171717]/80 backdrop-blur-md border-t border-neutral-200 dark:border-[#262626] z-50 flex gap-3 lg:hidden">
        {workOrder.status === 'pending' && (
          <Button className="flex-1" onClick={() => setStatusToUpdate('in_progress')}>
            {t('workOrders:actions.start')}
          </Button>
        )}
        {workOrder.status === 'in_progress' && (
          <Button className="flex-1" variant="success" onClick={() => setStatusToUpdate('completed')}>
            {t('workOrders:actions.complete')}
          </Button>
        )}
        <Button variant="outline" className="flex-1" onClick={() => navigate(`/work-orders/${id}/edit`)}>
          {tCommon('actions.edit')}
        </Button>
      </div>

      {/* Confirmation Modals */}
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
            <Button onClick={handleStatusUpdate} loading={updateStatusMutation.isPending} className="flex-1">
              {tCommon('actions.confirm')}
            </Button>
          </div>
        }
      >
        <p className="text-center py-4">
          {t(`workOrders:statusChange.${statusToUpdate === 'in_progress' ? 'startConfirm' : statusToUpdate === 'completed' ? 'completeConfirm' : 'cancelConfirm'}`)}
        </p>
      </Modal>

      <Modal
        open={isDeleteModalOpen}
        onClose={() => {
          console.log('[WORK_ORDER_DETAIL] Modal onClose (iptal/overlay)');
          setIsDeleteModalOpen(false);
        }}
        title={t('workOrders:delete.title')}
        size="sm"
        footer={
          <div className="flex gap-3 w-full">
            <Button type="button" variant="ghost" onClick={() => setIsDeleteModalOpen(false)} className="flex-1">
              {tCommon('actions.cancel')}
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                console.log('[WORK_ORDER_DETAIL] Modal içindeki Sil butonu tıklandı');
                handleDelete();
              }}
              loading={deleteMutation.isPending}
              className="flex-1"
            >
              {tCommon('actions.delete')}
            </Button>
          </div>
        }
      >
        <p>{t('workOrders:delete.message')}</p>
        <p className="mt-2 text-sm text-error-600 dark:text-error-400 font-bold">{t('workOrders:delete.warning')}</p>
      </Modal>
    </PageContainer>
  );
}
