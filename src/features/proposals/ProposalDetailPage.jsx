import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  StickyNote,
  ClipboardList,
  Plus,
  Unlink,
  CheckCircle2,
  Download,
  Receipt,
  MapPin,
} from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import { PageContainer } from '../../components/layout';
import {
  Button,
  Card,
  Badge,
  Skeleton,
  ErrorState,
  Modal,
} from '../../components/ui';
import { formatDate, formatCurrency, workOrderStatusVariant } from '../../lib/utils';
import {
  useProposal,
  useProposalItems,
  useUpdateProposalStatus,
  useDeleteProposal,
  useProposalWorkOrders,
  useUnlinkWorkOrder,
} from './hooks';
import { ProposalPdf } from './components/ProposalPdf';
import { ProposalHero } from './components/ProposalHero';
import { ProposalSiteCard } from './components/ProposalSiteCard';
import { ProposalSummaryCard } from './components/ProposalSummaryCard';
import { SiteFormModal } from '../customerSites/SiteFormModal';
import { useUpdateProposal } from './hooks';

function DetailSkeleton() {
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
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
  const [showFaturalandirModal, setShowFaturalandirModal] = useState(false);
  const [unlinkWoId, setUnlinkWoId] = useState(null);
  const [showAddSiteModal, setShowAddSiteModal] = useState(false);

  const { data: proposal, isLoading, error, refetch } = useProposal(id);
  const { data: items = [] } = useProposalItems(id);
  const { data: linkedWorkOrders = [] } = useProposalWorkOrders(id);
  const statusMutation = useUpdateProposalStatus();
  const deleteMutation = useDeleteProposal();
  const unlinkMutation = useUnlinkWorkOrder();
  const updateProposalMutation = useUpdateProposal();

  if (isLoading) return <DetailSkeleton />;

  if (error || !proposal) {
    return (
      <PageContainer maxWidth="full" padding="default">
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

  const currency = proposal.currency ?? 'USD';
  const subtotal = items.reduce(
    (sum, item) =>
      sum +
      Number(
        item.line_total ??
          item.total_usd ??
          ((Number(item.quantity) * Number(item.unit_price ?? item.unit_price_usd)) || 0)
      ),
    0
  );
  const discountPercent = Number(proposal.discount_percent) || 0;
  const discountAmount = subtotal * (discountPercent / 100);
  const grandTotal = subtotal - discountAmount;

  const totalCosts = items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    const single =
      (item.cost ?? item.cost_usd) != null && (item.cost ?? item.cost_usd) !== ''
        ? Number(item.cost ?? item.cost_usd)
        : NaN;
    if (Number.isFinite(single)) {
      return sum + single * qty;
    }
    const product = Number(item.product_cost ?? item.product_cost_usd) || 0;
    const labor = Number(item.labor_cost ?? item.labor_cost_usd) || 0;
    const shipping = Number(item.shipping_cost ?? item.shipping_cost_usd) || 0;
    const material = Number(item.material_cost ?? item.material_cost_usd) || 0;
    const misc = Number(item.misc_cost ?? item.misc_cost_usd) || 0;
    return sum + (product + labor + shipping + material + misc) * qty;
  }, 0);
  const netProfit = grandTotal - totalCosts;

  const handleStatusChange = (newStatus) => {
    statusMutation.mutate(
      { id, status: newStatus },
      { onSuccess: () => setConfirmAction(null) }
    );
  };

  const handleDelete = () => {
    deleteMutation.mutate(id, {
      onSuccess: () => navigate('/proposals'),
    });
  };

  const handleDownloadPdf = async () => {
    const blob = await pdf(<ProposalPdf proposal={proposal} items={items} />).toBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${proposal.proposal_no || 'teklif'}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleEdit = () => navigate(`/proposals/${id}/edit`);

  const handleSiteCreated = async (newSite) => {
    // Attach the new site to this proposal, then open work order creation
    await updateProposalMutation.mutateAsync({ id, site_id: newSite.id });
    const params = new URLSearchParams({
      proposalId: id,
      customerId: proposal.customer_id || '',
      siteId: newSite.id,
    });
    navigate(`/work-orders/new?${params.toString()}`);
  };

  return (
    <PageContainer maxWidth="full" padding="default" className="space-y-5 pb-24">
      {/* Hero */}
      <ProposalHero
        proposal={proposal}
        grandTotal={grandTotal}
        netProfit={netProfit}
        linkedWorkOrders={linkedWorkOrders}
        onEdit={handleEdit}
        onDelete={() => setShowDeleteConfirm(true)}
        onDownloadPdf={handleDownloadPdf}
        onFlowAction={setConfirmAction}
        onFaturalandir={() => setShowFaturalandirModal(true)}
        flowLoading={statusMutation.isPending}
      />

      {/* Lokasyon + Özet kartları — desktop: 1x2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProposalSiteCard proposal={proposal} />
        <ProposalSummaryCard proposal={proposal} />
      </div>

      {/* Malzemeler */}
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
                const lineTotal = Number(
                  item.line_total ??
                    item.total_usd ??
                    ((Number(item.quantity) * Number(item.unit_price ?? item.unit_price_usd)) || 0)
                );
                return (
                  <div
                    key={item.id || index}
                    className="flex items-start justify-between py-2 border-b border-neutral-100 dark:border-[#1a1a1a] last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-neutral-900 dark:text-neutral-100">
                        {item.quantity > 1 && (
                          <span className="font-mono text-neutral-500 mr-1">{item.quantity}x</span>
                        )}
                        {item.description}
                      </p>
                      {item.quantity > 1 && (
                        <p className="text-xs text-neutral-400 mt-0.5">
                          @ {formatCurrency(item.unit_price ?? item.unit_price_usd, currency)}
                        </p>
                      )}
                    </div>
                    <span className="font-semibold text-neutral-900 dark:text-neutral-100 ml-4 whitespace-nowrap">
                      {formatCurrency(lineTotal, currency)}
                    </span>
                  </div>
                );
              })}

              {discountPercent > 0 && (
                <>
                  <div className="flex items-center justify-between py-1 text-sm">
                    <span className="text-neutral-600 dark:text-neutral-400">
                      {t('proposals:detail.subtotal')}
                    </span>
                    <span>{formatCurrency(subtotal, currency)}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 text-sm">
                    <span className="text-neutral-600 dark:text-neutral-400">
                      {t('proposals:detail.discountAmount')}
                    </span>
                    <span>-{formatCurrency(discountAmount, currency)}</span>
                  </div>
                </>
              )}
              <div className="flex items-center justify-between pt-4 border-t-2 border-neutral-900 dark:border-neutral-100">
                <span className="font-bold text-neutral-900 dark:text-neutral-100 uppercase text-sm">
                  {t('proposals:detail.total')}
                </span>
                <span className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                  {formatCurrency(grandTotal, currency)}
                </span>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* İş Kapsamı */}
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

      {/* Bağlı İş Emirleri */}
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
            {proposal.site_id ? (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => {
                  const params = new URLSearchParams({
                    proposalId: id,
                    customerId: proposal.customer_id || '',
                    siteId: proposal.site_id,
                  });
                  navigate(`/work-orders/new?${params.toString()}`);
                }}
              >
                {t('proposals:detail.addWorkOrder')}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<MapPin className="w-3.5 h-3.5" />}
                disabled={!proposal.customer_id}
                onClick={() => setShowAddSiteModal(true)}
              >
                {t('proposals:detail.addSiteAndWorkOrder')}
              </Button>
            )}
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
                            <span className="text-xs font-mono text-neutral-400">#{wo.form_no}</span>
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

      {/* Dahili Notlar */}
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

      {/* Mobil FAB */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-[#171717]/80 backdrop-blur-md border-t border-neutral-200 dark:border-[#262626] z-50 flex gap-3 lg:hidden">
        {proposal.status === 'draft' && (
          <>
            <Button variant="outline" className="flex-1" onClick={handleEdit}>
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
            <Button variant="outline" className="flex-1" onClick={handleEdit}>
              {t('proposals:detail.actions.edit')}
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => setConfirmAction('accepted')}
              loading={statusMutation.isPending}
            >
              {t('proposals:detail.actions.accept')}
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => setConfirmAction('rejected')}>
              {t('proposals:detail.actions.reject')}
            </Button>
          </>
        )}
        {proposal.status === 'accepted' && (
          <>
            <Button variant="outline" className="flex-1" onClick={handleEdit}>
              {t('proposals:detail.actions.edit')}
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
              onClick={() => setConfirmAction('completed')}
              loading={statusMutation.isPending}
            >
              {t('proposals:detail.actions.markComplete')}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={handleDownloadPdf}
            >
              {t('proposals:detail.actions.downloadPdf')}
            </Button>
          </>
        )}
        {proposal.status === 'completed' && (
          <>
            <Button
              variant="success"
              className="flex-1"
              leftIcon={<Receipt className="w-4 h-4" />}
              onClick={() => setShowFaturalandirModal(true)}
            >
              {t('proposals:detail.actions.faturalandir')}
            </Button>
            <Button variant="outline" className="flex-1" onClick={handleEdit}>
              {t('proposals:detail.actions.edit')}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={handleDownloadPdf}
            >
              {t('proposals:detail.actions.downloadPdf')}
            </Button>
          </>
        )}
        {(proposal.status === 'rejected' || proposal.status === 'cancelled') && (
          <>
            <Button variant="outline" className="flex-1" onClick={handleEdit}>
              {t('proposals:detail.actions.edit')}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={handleDownloadPdf}
            >
              {t('proposals:detail.actions.downloadPdf')}
            </Button>
          </>
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
          {confirmAction === 'sent' && t('proposals:detail.confirmSent')}
          {confirmAction === 'completed' && t('proposals:detail.confirmComplete')}
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

      {/* Faturalandır — Yakında Modal */}
      <Modal
        open={showFaturalandirModal}
        onClose={() => setShowFaturalandirModal(false)}
        title={t('proposals:detail.actions.faturalandir')}
        footer={
          <Button variant="primary" onClick={() => setShowFaturalandirModal(false)}>
            {tCommon('actions.close')}
          </Button>
        }
      >
        <p className="text-sm text-neutral-700 dark:text-neutral-300">
          {t('proposals:detail.comingSoon')}
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

      {/* Add Site → Work Order flow */}
      <SiteFormModal
        open={showAddSiteModal}
        onClose={() => setShowAddSiteModal(false)}
        customerId={proposal?.customer_id}
        site={null}
        onSuccess={handleSiteCreated}
      />
    </PageContainer>
  );
}
