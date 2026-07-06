import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  StickyNote,
  ClipboardList,
  Unlink,
  CheckCircle2,
  Download,
  Copy,
  FileSpreadsheet,
  GitBranch,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import {
  calcSectionTotal,
  calcTotalCosts,
  calcAnnualFixedLineTotal,
  sumAnnualFixedCostsByCurrency,
} from '../../lib/proposalCalc';
import { filterPersistableAnnualFixedRows } from './api';
import { PageContainer } from '../../components/layout';
import {
  Button,
  Card,
  Badge,
  Skeleton,
  ErrorState,
  Modal,
  Input,
} from '../../components/ui';
import { formatDate, formatCurrency, workOrderStatusVariant, sanitizeDownloadFileName } from '../../lib/utils';
import { buildDefaultProposalPdfFilename } from './proposalPdfFilename';
import {
  useProposal,
  useProposalItems,
  useProposalSections,
  useProposalAnnualFixedCosts,
  useUpdateProposalStatus,
  useCompleteProposalWithRate,
  useDeleteProposal,
  useDuplicateProposal,
  useLinkedWorkOrderExecutionSummary,
  useLatestProposalRevision,
  useUpdateProposal,
  useProposalWorkOrders,
  useProposalRevisionLinks,
  useUnlinkWorkOrder,
} from './hooks';
import { ProposalCompletionRateModal } from './components/ProposalCompletionRateModal';
import { ProposalPdf } from './components/ProposalPdf';
import { ProposalHero } from './components/ProposalHero';
import { ProposalDetailMaterials } from './components/ProposalDetailMaterials';
import { SiteFormModal } from '../customerSites/SiteFormModal';
import { useFinanceSettings } from '../finance/hooks';
import { resolveProposalPdfPublicImage } from '../../lib/resolvePdfImage';

function pickProposalItemMaterial(row) {
  const m = row?.materials;
  if (!m) return null;
  return Array.isArray(m) ? m[0] ?? null : m;
}

function getLatestWorkOrder(workOrders) {
  if (!Array.isArray(workOrders) || workOrders.length === 0) return null;

  return [...workOrders].sort((a, b) => {
    const aDate = a?.scheduled_date || a?.created_at || '';
    const bDate = b?.scheduled_date || b?.created_at || '';
    return String(bDate).localeCompare(String(aDate));
  })[0] ?? null;
}

function buildOperationsSummary(proposalItems, linkedWorkOrders, executionSummary) {
  const hasCompletedExecution = Array.isArray(executionSummary) && executionSummary.length > 0;
  const completedByProposalItemId = new Map();
  let extraRowCount = 0;

  for (const workOrder of executionSummary || []) {
    for (const row of workOrder.work_order_materials || []) {
      const quantity = Number(row.quantity) || 0;
      if (quantity <= 0) continue;

      if (row.source_type === 'proposal_item' && row.proposal_item_id) {
        completedByProposalItemId.set(
          row.proposal_item_id,
          (completedByProposalItemId.get(row.proposal_item_id) || 0) + quantity,
        );
      } else {
        extraRowCount += 1;
      }
    }
  }

  let shortageCount = 0;
  let excessCount = 0;
  let fulfilledCount = 0;

  if (hasCompletedExecution) {
    for (const item of proposalItems || []) {
      const quoted = Number(item.quantity) || 0;
      const completed = completedByProposalItemId.get(item.id) || 0;

      if (completed < quoted) shortageCount += 1;
      if (completed > quoted) excessCount += 1;
      if (quoted > 0 && completed >= quoted) fulfilledCount += 1;
    }
  }

  const latestWorkOrder = getLatestWorkOrder(linkedWorkOrders);
  const completedVisitCount = (linkedWorkOrders || []).filter((wo) => wo.status === 'completed').length;
  const openVisitCount = (linkedWorkOrders || []).filter(
    (wo) => wo.status !== 'completed' && wo.status !== 'cancelled',
  ).length;

  return {
    latestWorkOrder,
    completedVisitCount,
    totalVisitCount: linkedWorkOrders?.length || 0,
    openVisitCount,
    totalQuotedRows: proposalItems?.length || 0,
    fulfilledCount,
    shortageCount,
    excessCount,
    extraRowCount,
    revisionNeeded: hasCompletedExecution && (shortageCount > 0 || excessCount > 0 || extraRowCount > 0),
  };
}

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
  const [showCompletionRateModal, setShowCompletionRateModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [unlinkWoId, setUnlinkWoId] = useState(null);
  const [showAddSiteModal, setShowAddSiteModal] = useState(false);
  const [showPdfFilenameModal, setShowPdfFilenameModal] = useState(false);
  const [pdfFilename, setPdfFilename] = useState('');

  const { data: proposal, isLoading, error, refetch } = useProposal(id);
  const { data: items = [] } = useProposalItems(id);
  const { data: sections = [] } = useProposalSections(id);
  const { data: annualFixedRaw = [] } = useProposalAnnualFixedCosts(id);
  const annualFixedCostsPdf = filterPersistableAnnualFixedRows(annualFixedRaw);
  const { data: linkedWorkOrders = [] } = useProposalWorkOrders(id);
  const { data: linkedExecutionSummary = [] } = useLinkedWorkOrderExecutionSummary(id);
  const { data: revisionLinks } = useProposalRevisionLinks(id, proposal?.revised_from_proposal_id || null);
  const { data: latestRevision } = useLatestProposalRevision(proposal?.status === 'revised' ? id : null);
  const statusMutation = useUpdateProposalStatus();
  const completeWithRateMutation = useCompleteProposalWithRate();
  const deleteMutation = useDeleteProposal();
  const unlinkMutation = useUnlinkWorkOrder();
  const updateProposalMutation = useUpdateProposal();
  const duplicateMutation = useDuplicateProposal();
  const { data: financeSettings } = useFinanceSettings();

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
  const grandTotal = sections.reduce((sum, section) => {
    const sectionItems = items.filter((item) => item.section_id === section.id);
    const { sectionTotal } = calcSectionTotal(sectionItems, section.discount_percent, currency);
    return sum + sectionTotal;
  }, 0);
  const totalCosts = calcTotalCosts(items, currency);
  const netProfit = grandTotal - totalCosts;

  const vatRate = Number(proposal.vat_rate) || 0;
  const hasTevkifat = !!proposal.has_tevkifat;
  const tevkifatNum = Number(financeSettings?.tevkifat_rate_numerator) || 9;
  const tevkifatDen = Number(financeSettings?.tevkifat_rate_denominator) || 10;
  const operationsSummary = buildOperationsSummary(items, linkedWorkOrders, linkedExecutionSummary);
  const previousRevision = revisionLinks?.previous ?? null;
  const nextRevisions = revisionLinks?.next ?? [];
  const supersedingRevision = latestRevision ?? nextRevisions[0] ?? null;

  const handleStatusChange = (newStatus) => {
    if (newStatus === 'completed' && currency !== 'USD') {
      // A9: TRY proposals should also complete via RPC path.
      completeWithRateMutation.mutate(
        { id, exchangeRate: 1, rateSuggested: null },
        { onSuccess: () => setConfirmAction(null) }
      );
      return;
    }

    statusMutation.mutate(
      { id, status: newStatus },
      { onSuccess: () => setConfirmAction(null) }
    );
  };

  const handleFlowAction = (action) => {
    if (action === 'completed' && currency === 'USD') {
      setShowCompletionRateModal(true);
    } else {
      setConfirmAction(action);
    }
  };

  const handleCompletionRateConfirm = ({ exchangeRate, rateSuggested }) => {
    completeWithRateMutation.mutate(
      { id, exchangeRate, rateSuggested },
      { onSuccess: () => setShowCompletionRateModal(false) }
    );
  };

  const handleDelete = () => {
    deleteMutation.mutate(id, {
      onSuccess: () => navigate('/proposals'),
    });
  };

  const handleOpenPdfFilenameModal = () => {
    setPdfFilename(buildDefaultProposalPdfFilename(proposal));
    setShowPdfFilenameModal(true);
  };

  const handleDownloadSupplierList = () => {
    try {
      const headerRow = [
        t('proposals:detail.supplierExport.colCode'),
        t('proposals:detail.supplierExport.colDescription'),
        t('proposals:detail.supplierExport.colQuantity'),
        t('proposals:detail.supplierExport.colUnit'),
      ];
      const dataRows = items.map((item) => {
        const m = pickProposalItemMaterial(item);
        const description = (m?.description ?? item.description ?? '').trim();
        return [
          m?.code ?? '',
          description,
          item.quantity ?? '',
          item.unit ?? '',
        ];
      });
      const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, t('proposals:detail.supplierExport.sheetName'));
      const base = sanitizeDownloadFileName(
        [proposal.proposal_no, 'tedarikci-listesi'].filter(Boolean).join('-') || 'tedarikci-listesi',
      );
      XLSX.writeFile(wb, `${base}.xlsx`);
    } catch (err) {
      console.error('[supplier list export]', err);
      toast.error(t('proposals:detail.supplierExport.error'));
    }
  };

  const handleConfirmPdfDownload = async () => {
    const baseName = sanitizeDownloadFileName(pdfFilename.trim().replace(/\.pdf$/i, ''));
    setShowPdfFilenameModal(false);
    setIsExporting(true);
    try {
      const [logoSrc, certSrc] = await Promise.all([
        resolveProposalPdfPublicImage('ornet.logo.png'),
        resolveProposalPdfPublicImage('falan.png'),
      ]);
      const blob = await pdf(
        <ProposalPdf
          proposal={proposal}
          items={items}
          sections={sections}
          annualFixedCosts={annualFixedCostsPdf}
          logoSrc={logoSrc}
          certSrc={certSrc}
          tevkifatNumerator={tevkifatNum}
          tevkifatDenominator={tevkifatDen}
        />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${baseName}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[PDF export]', err);
      toast.error(t('pdf.exportError'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleEdit = () => navigate(`/proposals/${id}/edit`);
  const handleRevise = () => navigate(`/proposals/new?reviseFrom=${id}`);

  const handleSiteCreated = async (newSite) => {
    // Attach the new site to this proposal, then open work order creation
    await updateProposalMutation.mutateAsync({ id, site_id: newSite.id });
    const params = new URLSearchParams({
      mode: 'linked',
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
        onRevise={handleRevise}
        onDelete={() => setShowDeleteConfirm(true)}
        onDownloadPdf={handleOpenPdfFilenameModal}
        isExporting={isExporting}
        onDownloadSupplierList={handleDownloadSupplierList}
        onFlowAction={handleFlowAction}
        flowLoading={statusMutation.isPending || completeWithRateMutation.isPending}
      />

      {proposal.status === 'revised' && supersedingRevision && (
        <Card className="border-warning-200 bg-warning-50/70 p-5 dark:border-warning-900/40 dark:bg-warning-950/10">
          <p className="text-sm font-medium text-warning-900 dark:text-warning-100">
            {t('proposals:detail.supersededBanner.title')}
          </p>
          <p className="mt-1 text-sm text-warning-800/80 dark:text-warning-200/80">
            {t('proposals:detail.supersededBanner.description')}
          </p>
          <Link
            to={`/proposals/${supersedingRevision.id}`}
            className="mt-3 inline-flex text-sm font-semibold text-warning-900 underline underline-offset-4 dark:text-warning-100"
          >
            {t('proposals:detail.supersededBanner.action', {
              proposalNo: supersedingRevision.proposal_no || supersedingRevision.title,
            })}
          </Link>
        </Card>
      )}

      <ProposalDetailMaterials
        items={items}
        sections={sections}
        currency={currency}
        vatRate={vatRate}
        hasTevkifat={hasTevkifat}
        tevkifatNumerator={tevkifatNum}
        tevkifatDenominator={tevkifatDen}
      />

      {(previousRevision || nextRevisions.length > 0) && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-primary-600" />
            <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-xs">
              {t('proposals:detail.revisions.title')}
            </h3>
          </div>

          {previousRevision && (
            <div className="rounded-xl border border-neutral-200 dark:border-[#262626] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                {t('proposals:detail.revisions.previous')}
              </p>
              <Link
                to={`/proposals/${previousRevision.id}`}
                className="mt-2 block text-sm font-semibold text-primary-700 hover:text-primary-600 dark:text-primary-300 dark:hover:text-primary-200"
              >
                {(previousRevision.proposal_no || previousRevision.title) ?? t('proposals:detail.revisions.untitled')}
              </Link>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                {previousRevision.title} · {t(`common:status.${previousRevision.status}`)}
              </p>
            </div>
          )}

          {nextRevisions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                {t('proposals:detail.revisions.next')}
              </p>
              {nextRevisions.map((revision) => (
                <Link
                  key={revision.id}
                  to={`/proposals/${revision.id}`}
                  className="flex items-center justify-between rounded-xl border border-neutral-200 px-4 py-3 text-sm transition-colors hover:bg-neutral-50 dark:border-[#262626] dark:hover:bg-[#1a1a1a]"
                >
                  <div>
                    <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                      {revision.proposal_no || revision.title}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                      {revision.title}
                    </p>
                  </div>
                  <Badge variant="outline" size="sm">
                    {t(`common:status.${revision.status}`)}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>
      )}

      {(proposal.status === 'accepted' || proposal.status === 'completed') && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary-600" />
            <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-xs">
              {t('proposals:detail.operationsSummary.title')}
            </h3>
          </div>

          {operationsSummary.revisionNeeded && (
            <div className="flex items-start gap-2 rounded-xl border border-warning-200 bg-warning-50/80 px-4 py-3 text-sm text-warning-900 dark:border-warning-900/40 dark:bg-warning-950/10 dark:text-warning-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{t('proposals:detail.operationsSummary.revisionNeeded')}</p>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-neutral-200 px-4 py-3 dark:border-[#262626]">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {t('proposals:detail.operationsSummary.visits')}
              </p>
              <p className="mt-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {t('proposals:detail.operationsSummary.visitsValue', {
                  completed: operationsSummary.completedVisitCount,
                  total: operationsSummary.totalVisitCount,
                })}
              </p>
            </div>
            <div className="rounded-xl border border-neutral-200 px-4 py-3 dark:border-[#262626]">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {t('proposals:detail.operationsSummary.fulfillment')}
              </p>
              <p className="mt-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {t('proposals:detail.operationsSummary.fulfillmentValue', {
                  fulfilled: operationsSummary.fulfilledCount,
                  total: operationsSummary.totalQuotedRows,
                })}
              </p>
            </div>
            <div className="rounded-xl border border-neutral-200 px-4 py-3 dark:border-[#262626]">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {t('proposals:detail.operationsSummary.quantityDifferences')}
              </p>
              <p className="mt-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {t('proposals:detail.operationsSummary.quantityDifferencesValue', {
                  shortage: operationsSummary.shortageCount,
                  excess: operationsSummary.excessCount,
                })}
              </p>
            </div>
            <div className="rounded-xl border border-neutral-200 px-4 py-3 dark:border-[#262626]">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {t('proposals:detail.operationsSummary.extraScope')}
              </p>
              <p className="mt-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {t('proposals:detail.operationsSummary.extraScopeValue', {
                  count: operationsSummary.extraRowCount,
                })}
              </p>
            </div>
          </div>

          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {operationsSummary.latestWorkOrder
              ? t('proposals:detail.operationsSummary.latestVisitValue', {
                  date: operationsSummary.latestWorkOrder.scheduled_date
                    ? formatDate(operationsSummary.latestWorkOrder.scheduled_date)
                    : formatDate(operationsSummary.latestWorkOrder.created_at),
                  status: t(`common:status.${operationsSummary.latestWorkOrder.status}`),
                })
              : t('proposals:detail.operationsSummary.noVisits')}
          </p>
        </Card>
      )}

      {annualFixedCostsPdf.length > 0 && (
        <Card className="overflow-hidden">
          <div className="bg-neutral-50 dark:bg-[#1a1a1a] px-6 py-4 border-b border-neutral-200 dark:border-[#262626]">
            <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-xs">
              {t('proposals:detail.annualFixed')}
            </h3>
          </div>
          <div className="p-6 space-y-3">
            {annualFixedCostsPdf.map((row, index) => {
              const rowCur = row.currency || 'TRY';
              const lineTotal = calcAnnualFixedLineTotal(row.quantity, row.unit_price);
              return (
                <div
                  key={row.id || index}
                  className="flex items-start justify-between py-2 border-b border-neutral-100 dark:border-[#1a1a1a] last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-neutral-900 dark:text-neutral-100">
                      {row.quantity > 1 && (
                        <span className="font-mono text-neutral-500 mr-1">{row.quantity}x</span>
                      )}
                      {row.description}
                    </p>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      {row.unit || 'adet'} · {rowCur}
                    </p>
                  </div>
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100 ml-4 whitespace-nowrap">
                    {formatCurrency(lineTotal, rowCur)}
                  </span>
                </div>
              );
            })}
            <div className="pt-3 border-t border-neutral-200 dark:border-[#262626] space-y-1">
              {Object.entries(sumAnnualFixedCostsByCurrency(annualFixedCostsPdf)).map(([cur, sum]) => (
                <div key={cur} className="flex justify-between text-sm">
                  <span className="text-neutral-600 dark:text-neutral-400">
                    {t('proposals:annualFixed.subtotalForCurrency', { currency: cur })}
                  </span>
                  <span className="font-semibold">{formatCurrency(sum, cur)}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 italic pt-2">
              {t('proposals:pdf.annualFixedDisclaimer')}
            </p>
          </div>
        </Card>
      )}

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
          <div className="bg-neutral-50 dark:bg-[#1a1a1a] px-6 py-4 border-b border-neutral-200 dark:border-[#262626] flex items-center gap-2">
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
      <div className="fixed bottom-0 left-0 right-0 px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-white/80 dark:bg-[#171717]/80 backdrop-blur-md border-t border-neutral-200 dark:border-[#262626] z-50 flex gap-3 lg:hidden">
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
            <Button variant="outline" className="flex-1" onClick={handleRevise}>
              {t('proposals:detail.actions.revise')}
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
              onClick={() => handleFlowAction('completed')}
              loading={statusMutation.isPending}
            >
              {t('proposals:detail.actions.markComplete')}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={handleOpenPdfFilenameModal}
              loading={isExporting}
            >
              {t('proposals:detail.actions.downloadPdf')}
            </Button>
          </>
        )}
        {(proposal.status === 'completed' ||
          proposal.status === 'revised' ||
          proposal.status === 'rejected' ||
          proposal.status === 'cancelled') && (
          <>
            {proposal.status !== 'revised' && (
              <Button variant="outline" className="flex-1" onClick={handleRevise}>
                {t('proposals:detail.actions.revise')}
              </Button>
            )}
            {proposal.status === 'completed' && (
              <Button
                variant="outline"
                className="flex-1"
                leftIcon={<FileSpreadsheet className="w-4 h-4" />}
                type="button"
                onClick={handleDownloadSupplierList}
              >
                {t('proposals:detail.actions.downloadSupplierList')}
              </Button>
            )}
            <Button
              variant="outline"
              className="flex-1"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={handleOpenPdfFilenameModal}
              loading={isExporting}
            >
              {t('proposals:detail.actions.downloadPdf')}
            </Button>
          </>
        )}
        {/* Duplicate — available for all statuses */}
        <Button
          variant="ghost"
          className="flex-1"
          leftIcon={<Copy className="w-4 h-4" />}
          onClick={() => {
            duplicateMutation.mutate(id, {
              onSuccess: (newProposal) => {
                navigate(`/proposals/${newProposal.id}`);
              },
            });
          }}
          loading={duplicateMutation.isPending}
        >
          {t('proposals:detail.actions.duplicate')}
        </Button>
      </div>

      <ProposalCompletionRateModal
        open={showCompletionRateModal}
        onClose={() => setShowCompletionRateModal(false)}
        onConfirm={handleCompletionRateConfirm}
        proposal={proposal}
        totalUsd={grandTotal}
        isLoading={completeWithRateMutation.isPending}
      />

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
        <div className="space-y-3">
          <p className="text-sm text-neutral-700 dark:text-neutral-300">
            {confirmAction === 'accepted' && t('proposals:detail.confirmAccept')}
            {confirmAction === 'rejected' && t('proposals:detail.confirmReject')}
            {confirmAction === 'sent' && t('proposals:detail.confirmSent')}
            {confirmAction === 'completed' && t('proposals:detail.confirmComplete')}
          </p>
          {confirmAction === 'completed' && operationsSummary.revisionNeeded && (
            <div className="rounded-xl border border-warning-200 bg-warning-50/80 px-4 py-3 text-sm text-warning-900 dark:border-warning-900/40 dark:bg-warning-950/10 dark:text-warning-100">
              {t('proposals:detail.completionRevisionWarning')}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={showPdfFilenameModal}
        onClose={() => setShowPdfFilenameModal(false)}
        title={t('proposals:pdf.filenameModalTitle')}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowPdfFilenameModal(false)}>
              {tCommon('actions.cancel')}
            </Button>
            <Button variant="primary" onClick={handleConfirmPdfDownload} loading={isExporting}>
              {t('proposals:pdf.downloadButton')}
            </Button>
          </>
        }
      >
        <Input
          label={t('proposals:pdf.filenameLabel')}
          hint={t('proposals:pdf.filenameHint')}
          value={pdfFilename}
          onChange={(e) => setPdfFilename(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleConfirmPdfDownload();
            }
          }}
        />
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
