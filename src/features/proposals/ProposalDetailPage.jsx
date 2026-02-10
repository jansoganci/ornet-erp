import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Edit,
  Download,
  Send,
  CheckCircle2,
  XCircle,
  Building2,
  MapPin,
  DollarSign,
  FileText,
  StickyNote,
  Trash2,
  ChevronRight,
  ClipboardList,
  Plus,
  Unlink,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import { PageContainer, PageHeader } from '../../components/layout';
import {
  Button,
  Card,
  Badge,
  Skeleton,
  ErrorState,
  Modal,
} from '../../components/ui';
import { formatDate, formatCurrency, proposalStatusVariant, workOrderStatusVariant } from '../../lib/utils';
import {
  useProposal,
  useProposalItems,
  useUpdateProposalStatus,
  useDeleteProposal,
  useProposalWorkOrders,
  useUnlinkWorkOrder,
} from './hooks';
import { ProposalStatusBadge } from './components/ProposalStatusBadge';
import { ProposalPdf } from './components/ProposalPdf';

function DetailSkeleton() {
  return (
    <PageContainer maxWidth="lg" padding="default" className="space-y-6">
      <div className="space-y-2 mb-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="h-24" />
        <Card className="h-24" />
        <Card className="h-24" />
      </div>
      <Card className="h-64" />
    </PageContainer>
  );
}

export function ProposalDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation(['proposals', 'common', 'customers']);
  const { t: tCommon } = useTranslation('common');

  const [confirmAction, setConfirmAction] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [unlinkWoId, setUnlinkWoId] = useState(null);

  const { data: proposal, isLoading, error, refetch } = useProposal(id);
  const { data: items = [] } = useProposalItems(id);
  const { data: linkedWorkOrders = [] } = useProposalWorkOrders(id);
  const statusMutation = useUpdateProposalStatus();
  const deleteMutation = useDeleteProposal();
  const unlinkMutation = useUnlinkWorkOrder();

  if (isLoading) return <DetailSkeleton />;

  if (error || !proposal) {
    return (
      <PageContainer maxWidth="lg" padding="default">
        <ErrorState
          message={error?.message || t('common:error.title')}
          onRetry={() => refetch()}
        />
        <div className="mt-6 flex justify-center">
          <Button onClick={() => navigate('/proposals')}>{tCommon('actions.back')}</Button>
        </div>
      </PageContainer>
    );
  }

  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.total_usd ?? item.quantity * item.unit_price_usd ?? 0),
    0
  );
  const discountPercent = Number(proposal.discount_percent) || 0;
  const discountAmount = subtotal * (discountPercent / 100);
  const grandTotal = subtotal - discountAmount;

  const totalCosts = items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    const single = item.cost_usd != null && item.cost_usd !== '' ? Number(item.cost_usd) : NaN;
    if (Number.isFinite(single)) {
      return sum + single * qty;
    }
    const product = Number(item.product_cost_usd) || 0;
    const labor = Number(item.labor_cost_usd) || 0;
    const shipping = Number(item.shipping_cost_usd) || 0;
    const material = Number(item.material_cost_usd) || 0;
    const misc = Number(item.misc_cost_usd) || 0;
    return sum + (product + labor + shipping + material + misc) * qty;
  }, 0);
  const netProfit = grandTotal - totalCosts;

  const handleStatusChange = (newStatus) => {
    statusMutation.mutate({ id, status: newStatus }, {
      onSuccess: () => setConfirmAction(null),
    });
  };

  const handleDelete = () => {
    deleteMutation.mutate(id, {
      onSuccess: () => navigate('/proposals'),
    });
  };

  const handleDownloadPdf = async () => {
    const blob = await pdf(
      <ProposalPdf proposal={proposal} items={items} />
    ).toBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${proposal.proposal_no || 'teklif'}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <PageContainer maxWidth="lg" padding="default" className="space-y-6 pb-24">
      {/* Header */}
      <PageHeader
        title={proposal.title}
        description={
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <ProposalStatusBadge status={proposal.status} />
            <span className="text-neutral-300 dark:text-neutral-700">|</span>
            <Badge variant="default" size="sm" className="font-mono">
              {proposal.proposal_no}
            </Badge>
          </div>
        }
        breadcrumbs={[
          { label: t('proposals:list.title'), to: '/proposals' },
          ...(proposal.customer_id
            ? [{ label: proposal.customer_company_name || proposal.company_name, to: `/customers/${proposal.customer_id}` }]
            : [{ label: '—', to: null }]),
          { label: proposal.title },
        ]}
        actions={
          <div className="hidden lg:flex items-center gap-2">
            {proposal.status === 'draft' && (
              <Button
                variant="outline"
                leftIcon={<Edit className="w-4 h-4" />}
                onClick={() => navigate(`/proposals/${id}/edit`)}
              >
                {t('proposals:detail.actions.edit')}
              </Button>
            )}
            <Button
              variant="outline"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={handleDownloadPdf}
            >
              {t('proposals:detail.actions.downloadPdf')}
            </Button>
          </div>
        }
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 bg-primary-50 dark:bg-primary-950/30 rounded-lg">
            <DollarSign className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <p className="text-xs text-neutral-500 uppercase font-bold tracking-wider">
              {t('proposals:detail.total')}
            </p>
            <p className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
              {formatCurrency(grandTotal, 'USD')}
            </p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 bg-success-50 dark:bg-success-950/30 rounded-lg">
            <TrendingUp className="w-6 h-6 text-success-600" />
          </div>
          <div>
            <p className="text-xs text-neutral-500 uppercase font-bold tracking-wider">
              {t('proposals:detail.netProfit')}
            </p>
            <p className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
              {formatCurrency(netProfit, 'USD')}
            </p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 bg-neutral-100 dark:bg-[#262626] rounded-lg">
            <FileText className="w-6 h-6 text-neutral-600 dark:text-neutral-400" />
          </div>
          <div>
            <p className="text-xs text-neutral-500 uppercase font-bold tracking-wider">
              {t('common:status.active', 'Durum')}
            </p>
            <div className="mt-1">
              <ProposalStatusBadge status={proposal.status} />
            </div>
            {proposal.sent_at && (
              <p className="text-xs text-neutral-400 mt-1">
                {formatDate(proposal.sent_at)}
              </p>
            )}
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 bg-neutral-100 dark:bg-[#262626] rounded-lg">
            <ClipboardList className="w-6 h-6 text-neutral-600 dark:text-neutral-400" />
          </div>
          <div>
            <p className="text-xs text-neutral-500 uppercase font-bold tracking-wider">
              {t('proposals:detail.workOrders')}
            </p>
            {linkedWorkOrders.length > 0 ? (
              <p className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                {linkedWorkOrders.filter((wo) => wo.status === 'completed').length}/{linkedWorkOrders.length}
                <span className="text-sm font-normal text-neutral-500 ml-1">{t('common:status.completed').toLowerCase()}</span>
              </p>
            ) : (
              <p className="text-sm text-neutral-500 mt-1">-</p>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items Table */}
          <Card className="overflow-hidden">
            <div className="bg-neutral-50 dark:bg-[#1a1a1a] px-6 py-4 border-b border-neutral-200 dark:border-[#262626]">
              <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-xs">
                {t('proposals:detail.items')}
              </h3>
            </div>
            <div className="p-6">
              {items.length === 0 ? (
                <p className="text-sm text-neutral-500">{t('common:empty.noItems')}</p>
              ) : (
                <div className="space-y-3">
                  {items.map((item, index) => {
                    const lineTotal = Number(item.total_usd || item.quantity * item.unit_price_usd || 0);
                    return (
                      <div
                        key={item.id || index}
                        className="flex items-start justify-between py-2 border-b border-neutral-100 dark:border-[#1a1a1a] last:border-0"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-neutral-900 dark:text-neutral-100">
                            {item.quantity > 1 && (
                              <span className="font-mono text-neutral-500 mr-1">
                                {item.quantity}x
                              </span>
                            )}
                            {item.description}
                          </p>
                          {item.quantity > 1 && (
                            <p className="text-xs text-neutral-400 mt-0.5">
                              @ {formatCurrency(item.unit_price_usd, 'USD')}
                            </p>
                          )}
                        </div>
                        <span className="font-semibold text-neutral-900 dark:text-neutral-100 ml-4 whitespace-nowrap">
                          {formatCurrency(lineTotal, 'USD')}
                        </span>
                      </div>
                    );
                  })}

                  {/* Totals */}
                  {discountPercent > 0 && (
                    <>
                      <div className="flex items-center justify-between py-1 text-sm">
                        <span className="text-neutral-600 dark:text-neutral-400">{t('proposals:detail.subtotal')}</span>
                        <span>{formatCurrency(subtotal, 'USD')}</span>
                      </div>
                      <div className="flex items-center justify-between py-1 text-sm">
                        <span className="text-neutral-600 dark:text-neutral-400">{t('proposals:detail.discountAmount')}</span>
                        <span>-{formatCurrency(discountAmount, 'USD')}</span>
                      </div>
                    </>
                  )}
                  <div className="flex items-center justify-between pt-4 border-t-2 border-neutral-900 dark:border-neutral-100">
                    <span className="font-bold text-neutral-900 dark:text-neutral-100 uppercase text-sm">
                      {t('proposals:detail.total')}
                    </span>
                    <span className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                      {formatCurrency(grandTotal, 'USD')}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Scope of Work */}
          {proposal.scope_of_work && (
            <Card className="p-6">
              <div className="flex items-center space-x-2 mb-4">
                <FileText className="w-4 h-4 text-primary-600" />
                <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-xs">
                  {t('proposals:detail.scopeOfWork')}
                </h3>
              </div>
              <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed">
                {proposal.scope_of_work}
              </p>
            </Card>
          )}

          {/* Completion Banner */}
          {proposal.status === 'completed' && (
            <Card className="p-6 bg-success-50 dark:bg-success-950/20 border-success-200 dark:border-success-900/30">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="p-3 bg-success-100 dark:bg-success-900/30 rounded-lg shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-success-600" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-success-900 dark:text-success-100">
                    {t('proposals:detail.completionBanner.title')}
                  </p>
                  <p className="text-sm text-success-700 dark:text-success-300 mt-0.5">
                    {t('proposals:detail.completionBanner.description')}
                  </p>
                </div>
                <Button
                  variant="primary"
                  className="shrink-0"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  onClick={() => navigate(`/proposals/${id}/finalize`)}
                >
                  {t('proposals:detail.completionBanner.action')}
                </Button>
              </div>
            </Card>
          )}

          {/* Linked Work Orders */}
          {(proposal.status === 'accepted' || proposal.status === 'completed') && (
            <Card className="overflow-hidden">
              <div className="bg-neutral-50 dark:bg-[#1a1a1a] px-6 py-4 border-b border-neutral-200 dark:border-[#262626] flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ClipboardList className="w-4 h-4 text-primary-600" />
                  <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-xs">
                    {t('proposals:detail.workOrders')}
                  </h3>
                  {linkedWorkOrders.length > 0 && (
                    <Badge variant="default" size="sm">
                      {t('proposals:detail.workOrderCount', {
                        completed: linkedWorkOrders.filter((wo) => wo.status === 'completed').length,
                        total: linkedWorkOrders.length,
                      })}
                    </Badge>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  disabled={!proposal.site_id}
                  title={!proposal.site_id ? t('proposals:detail.addWorkOrderNoSiteHint') : undefined}
                  onClick={() => {
                    if (!proposal.site_id) return;
                    const params = new URLSearchParams({
                      proposalId: id,
                      customerId: proposal.customer_id || '',
                      siteId: proposal.site_id,
                    });
                    navigate(`/work-orders/new?${params.toString()}`);
                  }}
                >
                  {!proposal.site_id ? t('proposals:detail.addWorkOrderNoSite') : t('proposals:detail.addWorkOrder')}
                </Button>
              </div>
              <div className="p-6">
                {linkedWorkOrders.length === 0 ? (
                  <p className="text-sm text-neutral-500 text-center py-4">
                    {t('proposals:detail.noWorkOrders')}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {linkedWorkOrders.map((wo) => (
                      <div
                        key={wo.id}
                        className="flex items-center justify-between py-3 px-4 rounded-xl border border-neutral-100 dark:border-[#262626] hover:bg-neutral-50 dark:hover:bg-[#1a1a1a] transition-colors group"
                      >
                        <Link
                          to={`/work-orders/${wo.id}`}
                          className="flex-1 min-w-0 flex items-center gap-3"
                        >
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate">
                                {t(`common:workType.${wo.work_type}`)}
                              </span>
                              {wo.form_no && (
                                <span className="text-xs font-mono text-neutral-400">
                                  #{wo.form_no}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {wo.scheduled_date && (
                                <span className="text-xs text-neutral-500">
                                  {formatDate(wo.scheduled_date)}
                                </span>
                              )}
                              {wo.description && (
                                <span className="text-xs text-neutral-400 truncate max-w-[200px]">
                                  {wo.description}
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <Badge variant={workOrderStatusVariant[wo.status]} dot size="sm">
                            {t(`common:status.${wo.status}`)}
                          </Badge>
                          <button
                            type="button"
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700"
                            title={t('proposals:detail.unlinkWorkOrder')}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setUnlinkWoId(wo.id);
                            }}
                          >
                            <Unlink className="w-3.5 h-3.5 text-neutral-400" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Right Column - Info & Actions */}
        <div className="space-y-6">
          {/* Site Info */}
          <Card className="p-5">
            <div className="flex items-center space-x-2 mb-4">
              <Building2 className="w-4 h-4 text-primary-600" />
              <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-xs">
                {t('customers:sites.fields.siteName', 'Lokasyon')}
              </h3>
            </div>
            <div className="space-y-3 text-sm">
              {proposal.site_id ? (
                <>
                  {proposal.site_name && (
                    <div>
                      <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-widest mb-1">
                        {t('customers:sites.fields.siteName', 'Lokasyon')}
                      </p>
                      <p className="font-medium text-neutral-900 dark:text-neutral-100">
                        {proposal.site_name}
                      </p>
                    </div>
                  )}
                  {proposal.site_address && (
                    <div>
                      <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-widest mb-1">
                        {t('customers:sites.fields.address', 'Adres')}
                      </p>
                      <div className="flex items-start">
                        <MapPin className="w-3.5 h-3.5 mr-1.5 mt-0.5 text-neutral-400 shrink-0" />
                        <p className="text-neutral-700 dark:text-neutral-300">{proposal.site_address}</p>
                      </div>
                    </div>
                  )}
                  {proposal.account_no && (
                    <div>
                      <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-widest mb-1">
                        {t('customers:sites.fields.accountNo', 'Hesap No')}
                      </p>
                      <Badge variant="info" className="font-mono">{proposal.account_no}</Badge>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-neutral-500 dark:text-neutral-400 text-sm">
                  {t('proposals:form.noSite')}
                </p>
              )}
            </div>
          </Card>

          {/* Internal Notes */}
          {proposal.notes && (
            <Card className="p-5">
              <div className="flex items-center space-x-2 mb-4">
                <StickyNote className="w-4 h-4 text-primary-600" />
                <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-xs">
                  {t('proposals:detail.notes')}
                </h3>
              </div>
              <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
                {proposal.notes}
              </p>
            </Card>
          )}

          {/* Actions */}
          <div className="space-y-3">
            {proposal.status === 'draft' && (
              <>
                <Button
                  className="w-full"
                  leftIcon={<Send className="w-4 h-4" />}
                  onClick={() => setConfirmAction('sent')}
                  loading={statusMutation.isPending}
                >
                  {t('proposals:detail.actions.markSent')}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  leftIcon={<Edit className="w-4 h-4" />}
                  onClick={() => navigate(`/proposals/${id}/edit`)}
                >
                  {t('proposals:detail.actions.edit')}
                </Button>
              </>
            )}

            {proposal.status === 'sent' && (
              <>
                <Button
                  variant="primary"
                  className="w-full"
                  leftIcon={<CheckCircle2 className="w-4 h-4" />}
                  onClick={() => setConfirmAction('accepted')}
                  loading={statusMutation.isPending}
                >
                  {t('proposals:detail.actions.accept')}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  leftIcon={<XCircle className="w-4 h-4" />}
                  onClick={() => setConfirmAction('rejected')}
                >
                  {t('proposals:detail.actions.reject')}
                </Button>
              </>
            )}

            <Button
              variant="outline"
              className="w-full"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={handleDownloadPdf}
            >
              {t('proposals:detail.actions.downloadPdf')}
            </Button>

            {proposal.status === 'draft' && (
              <Button
                variant="ghost"
                className="w-full text-error-600 hover:text-error-700"
                leftIcon={<Trash2 className="w-4 h-4" />}
                onClick={() => setShowDeleteConfirm(true)}
              >
                {tCommon('actions.delete')}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Floating Action Bar for Mobile */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-[#171717]/80 backdrop-blur-md border-t border-neutral-200 dark:border-[#262626] z-50 flex gap-3 lg:hidden">
        {proposal.status === 'draft' && (
          <>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => navigate(`/proposals/${id}/edit`)}
            >
              {t('proposals:detail.actions.edit')}
            </Button>
            <Button
              className="flex-1"
              onClick={() => setConfirmAction('sent')}
              loading={statusMutation.isPending}
            >
              {t('proposals:detail.actions.markSent')}
            </Button>
          </>
        )}
        {proposal.status === 'sent' && (
          <>
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => setConfirmAction('accepted')}
              loading={statusMutation.isPending}
            >
              {t('proposals:detail.actions.accept')}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setConfirmAction('rejected')}
            >
              {t('proposals:detail.actions.reject')}
            </Button>
          </>
        )}
        {(proposal.status === 'accepted' || proposal.status === 'rejected' || proposal.status === 'cancelled') && (
          <Button
            variant="outline"
            className="flex-1"
            leftIcon={<Download className="w-4 h-4" />}
            onClick={handleDownloadPdf}
          >
            {t('proposals:detail.actions.downloadPdf')}
          </Button>
        )}
      </div>

      {/* Confirm Status Modal */}
      <Modal
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title={tCommon('labels.areYouSure')}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>
              {tCommon('actions.cancel')}
            </Button>
            <Button
              variant={confirmAction === 'rejected' ? 'danger' : 'primary'}
              onClick={() => handleStatusChange(confirmAction)}
              loading={statusMutation.isPending}
            >
              {tCommon('actions.confirm')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-700 dark:text-neutral-300">
          {confirmAction === 'accepted' && t('proposals:detail.confirmAccept')}
          {confirmAction === 'rejected' && t('proposals:detail.confirmReject')}
          {confirmAction === 'sent' && t('proposals:detail.confirmSent', 'Bu teklifi gönderildi olarak işaretlemek istediğinize emin misiniz?')}
        </p>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title={tCommon('labels.areYouSure')}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              {tCommon('actions.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              loading={deleteMutation.isPending}
            >
              {tCommon('actions.delete')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-700 dark:text-neutral-300">
          {tCommon('confirm.deleteMessage')}
        </p>
      </Modal>

      {/* Unlink Work Order Modal */}
      <Modal
        open={!!unlinkWoId}
        onClose={() => setUnlinkWoId(null)}
        title={tCommon('labels.areYouSure')}
        footer={
          <>
            <Button variant="outline" onClick={() => setUnlinkWoId(null)}>
              {tCommon('actions.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                unlinkMutation.mutate(
                  { proposalId: id, workOrderId: unlinkWoId },
                  { onSuccess: () => setUnlinkWoId(null) }
                );
              }}
              loading={unlinkMutation.isPending}
            >
              {tCommon('actions.confirm')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-700 dark:text-neutral-300">
          {t('proposals:detail.confirmUnlink')}
        </p>
      </Modal>
    </PageContainer>
  );
}
