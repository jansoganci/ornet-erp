import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save, X, Calendar, Clock, FileText, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { inferLineRevenueType } from '../../lib/inferLineRevenueType';
import { PageContainer } from '../../components/layout';
import { 
  Button, 
  Input, 
  Select, 
  Card, 
  Textarea,
  FormSkeleton,
  Modal,
} from '../../components/ui';
import {
  workOrderSchema,
  workOrderDefaultValues,
  WORK_TYPES,
  normalizeWorkOrderItemUnit,
  sanitizePersistableWorkOrderItems,
} from './schema';
import { useWorkOrder, useCreateWorkOrder, useUpdateWorkOrder } from './hooks';
import { CustomerSiteSelector } from './CustomerSiteSelector';
import { WorkerSelector } from './WorkerSelector';
import { WorkOrderFormHero } from './components/WorkOrderFormHero';
import { WorkOrderItemsEditor } from './components/WorkOrderItemsEditor';
import { AccountNoWarning } from './AccountNoWarning';
import { SiteFormModal } from '../customerSites/SiteFormModal';
import { useSite, useSitesByCustomer } from '../customerSites/hooks';
import {
  useLinkWorkOrder,
  useLinkedWorkOrderExecutionSummary,
  useLinkedWorkOrderProposalScope,
  useSelectableLinkedWorkOrderProposals,
} from '../proposals/hooks';
import { updateOperationsItem } from '../operations/api';
import { useFinanceSettings, useLatestRate } from '../finance/hooks';
import {
  resolveProposalItemCost,
  resolveProposalItemUnitPrice,
  calcVatTevkifatSummary,
} from '../../lib/proposalCalc';
import { toast } from 'sonner';
import { useRole } from '../../lib/roles';

/** First leaf `message` in RHF FieldErrors (e.g. items[0].description). */
function firstFormErrorMessage(err) {
  if (err == null || typeof err !== 'object') return null;
  if (typeof err.message === 'string' && err.message) return err.message;
  if (Array.isArray(err)) {
    for (const item of err) {
      const m = firstFormErrorMessage(item);
      if (m) return m;
    }
    return null;
  }
  for (const key of Object.keys(err)) {
    const m = firstFormErrorMessage(err[key]);
    if (m) return m;
  }
  return null;
}

function getActiveCurrencyFieldNames(currency) {
  const cur = String(currency || 'TRY').toUpperCase();
  return cur === 'USD'
    ? {
        plannedLaborKey: 'planned_operational_labor_cost_usd',
      }
    : {
        plannedLaborKey: 'planned_operational_labor_cost',
      };
}

function buildLegacyServiceRevenueRow(workOrder, rowCurrency, description) {
  const activeCurrency = String(rowCurrency || 'TRY').toUpperCase();
  const amount = activeCurrency === 'USD'
    ? Number(workOrder?.service_fee_revenue_usd) || 0
    : Number(workOrder?.service_fee_revenue) || 0;

  if (amount <= 0) return null;

  return {
    description,
    quantity: 1,
    unit: 'adet',
    unit_price: amount,
    material_id: null,
    proposal_item_id: null,
    revenue_type: 'labor_service',
    source_type: 'manual_extra',
    cost: null,
  };
}

function buildSelectableProposalLabel(proposal) {
  return [
    proposal?.proposal_no,
    proposal?.title,
    proposal?.customer_company_name || proposal?.company_name,
    proposal?.site_name,
  ]
    .filter(Boolean)
    .join(' · ');
}

function normalizeCurrency(value) {
  return String(value || 'TRY').toUpperCase();
}

function convertSnapshotAmount(amount, sourceCurrency, targetCurrency, usdRate) {
  if (amount === null || amount === undefined || amount === '') return null;

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) return null;

  const source = normalizeCurrency(sourceCurrency);
  const target = normalizeCurrency(targetCurrency);

  if (source === target) return numericAmount;

  const rate = Number(usdRate);
  if (!Number.isFinite(rate) || rate <= 0) {
    return null;
  }

  if (source === 'USD' && target === 'TRY') {
    return numericAmount * rate;
  }

  if (source === 'TRY' && target === 'USD') {
    return numericAmount / rate;
  }

  return numericAmount;
}

function roundCurrencySnapshot(value) {
  if (value === null || value === undefined) return null;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;
  return Math.round(numericValue * 100) / 100;
}

function resolveLineRevenueType({ description, materialId, revenueType }) {
  return inferLineRevenueType({
    description,
    materialId,
    revenueType: ['material', 'labor_service', 'other'].includes(revenueType)
      ? revenueType
      : undefined,
  });
}

function buildWorkOrderItemsFromProposal(items, currency) {
  return (items || []).map((item, index) => ({
    description: item.description || item.materials?.name || '',
    quantity: 0,
    unit: normalizeWorkOrderItemUnit(item.unit),
    unit_price: resolveProposalItemUnitPrice(item, currency),
    cost: resolveProposalItemCost(item, currency),
    material_id: item.material_id || null,
    proposal_item_id: item.id || null,
    revenue_type: resolveLineRevenueType({
      description: item.description || item.materials?.name || '',
      materialId: item.material_id,
      revenueType: item.revenue_type,
    }),
    source_type: 'proposal_item',
    sort_order: item.sort_order ?? index,
  }));
}

function isProposalDerivedItem(item) {
  return item?.source_type === 'proposal_item' || !!item?.proposal_item_id;
}

function mergeLinkedProposalScopeIntoItems(proposalItems, currentItems, currency) {
  const proposalRows = Array.isArray(proposalItems) ? proposalItems : [];
  const existingItems = Array.isArray(currentItems) ? currentItems : [];
  const existingProposalRowsById = new Map(
    existingItems
      .filter(isProposalDerivedItem)
      .map((item) => [item.proposal_item_id, item]),
  );
  const proposalIds = new Set(proposalRows.map((item) => item.id).filter(Boolean));

  const mergedProposalRows = proposalRows.map((item, index) => {
    const existing = existingProposalRowsById.get(item.id);
    return {
      description: existing?.description || item.description || item.materials?.name || '',
      quantity: existing ? (parseFloat(existing.quantity) || 0) : 0,
      unit: normalizeWorkOrderItemUnit(existing?.unit || item.unit),
      unit_price: existing
        ? resolveProposalItemUnitPrice(existing, currency)
        : resolveProposalItemUnitPrice(item, currency),
      cost: existing
        ? resolveProposalItemCost(existing, currency)
        : resolveProposalItemCost(item, currency),
      material_id: existing?.material_id || item.material_id || null,
      proposal_item_id: item.id || null,
      revenue_type: resolveLineRevenueType({
        description: existing?.description || item.description || item.materials?.name || '',
        materialId: existing?.material_id || item.material_id,
        revenueType: existing?.revenue_type || item.revenue_type,
      }),
      source_type: 'proposal_item',
      sort_order: item.sort_order ?? index,
    };
  });

  const orphanProposalRows = existingItems
    .filter((item) => isProposalDerivedItem(item) && item.proposal_item_id && !proposalIds.has(item.proposal_item_id))
    .map((item, index) => ({
      ...item,
      quantity: parseFloat(item.quantity) || 0,
      unit: normalizeWorkOrderItemUnit(item.unit),
      unit_price: resolveProposalItemUnitPrice(item, currency),
      cost: resolveProposalItemCost(item, currency),
      source_type: 'proposal_item',
      sort_order: item.sort_order ?? (mergedProposalRows.length + index),
    }));

  const manualExtraRows = existingItems
    .filter((item) => !isProposalDerivedItem(item))
    .map((item, index) => ({
      ...item,
      quantity: parseFloat(item.quantity) || 0,
      unit: normalizeWorkOrderItemUnit(item.unit),
      unit_price: resolveProposalItemUnitPrice(item, currency),
      cost: resolveProposalItemCost(item, currency),
      source_type: item.source_type || 'manual_extra',
      sort_order: item.sort_order ?? (mergedProposalRows.length + orphanProposalRows.length + index),
    }));

  return [...mergedProposalRows, ...orphanProposalRows, ...manualExtraRows];
}

function buildLinkedExecutionMeta(proposalItems, completedWorkOrders) {
  const completedByProposalItemId = new Map();

  for (const workOrder of completedWorkOrders || []) {
    for (const row of workOrder?.work_order_materials || []) {
      if (!row?.proposal_item_id) continue;
      if (row?.source_type && row.source_type !== 'proposal_item') continue;
      const current = completedByProposalItemId.get(row.proposal_item_id) || 0;
      completedByProposalItemId.set(
        row.proposal_item_id,
        current + (parseFloat(row.quantity) || 0),
      );
    }
  }

  return (proposalItems || []).reduce((acc, item) => {
    if (!item?.id) return acc;
    acc[item.id] = {
      quotedQuantity: parseFloat(item.quantity) || 0,
      previouslyCompletedQuantity: completedByProposalItemId.get(item.id) || 0,
      sortOrder: item.sort_order ?? 0,
    };
    return acc;
  }, {});
}

export function WorkOrderFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation(['workOrders', 'common', 'errors']);
  const { t: tCommon } = useTranslation('common');
  const { isFieldWorker } = useRole();
  const isEdit = !!id;

  const [showSiteModal, setShowSiteModal] = useState(false);
  const [createMode, setCreateMode] = useState(() => {
    const requestedMode = searchParams.get('mode');
    return requestedMode === 'linked' || searchParams.get('proposalId') ? 'linked' : 'standalone';
  });
  const [selectedLinkedProposalId, setSelectedLinkedProposalId] = useState(() => searchParams.get('proposalId') || '');
  /** 'new-site' = always create; 'account-no' = edit current site if selected, else create for customer */
  const [siteModalIntent, setSiteModalIntent] = useState(null);
  const [showTevkifatConfirmModal, setShowTevkifatConfirmModal] = useState(false);
  const [pendingSubmitData, setPendingSubmitData] = useState(null);
  const [internalPlanningOpenOverride, setInternalPlanningOpenOverride] = useState(null);
  const linkedProposalAppliedRef = useRef(null);

  const { data: workOrder, isLoading: isWorkOrderLoading } = useWorkOrder(id);
  const { data: financeSettings } = useFinanceSettings();
  const { data: latestUsdRate } = useLatestRate('USD');
  const createMutation = useCreateWorkOrder();
  const updateMutation = useUpdateWorkOrder();
  const linkWorkOrderMutation = useLinkWorkOrder();
  const { data: selectableLinkedProposals = [], isLoading: selectableLinkedProposalsLoading } = useSelectableLinkedWorkOrderProposals();

  const prefilledCustomerId = searchParams.get('customerId') || '';
  const prefilledSiteId = searchParams.get('siteId') || '';
  const prefilledDate = searchParams.get('date') || '';
  const prefilledTime = searchParams.get('time') || '';
  const prefilledProposalId = searchParams.get('proposalId') || '';
  const prefilledDescription = searchParams.get('description') || '';
  const prefilledWorkType = searchParams.get('workType') || '';
  const prefilledAssignedTo = searchParams.get('assignedTo') || '';
  const prefilledSourceItemId = searchParams.get('sourceItemId') || '';
  const prefilledStatus = searchParams.get('status') || '';

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    setError,
    clearErrors,
    trigger,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(workOrderSchema),
    defaultValues: workOrderDefaultValues,
  });

  const selectedSiteId = useWatch({ control, name: 'site_id' });
  const workType = useWatch({ control, name: 'work_type' });
  const hasVat = useWatch({ control, name: 'has_vat' });
  const vatRate = useWatch({ control, name: 'vat_rate' });
  const isExistingLinkedWorkOrder = isEdit && !!workOrder?.proposal_id;
  const isLinkedMode = !isEdit ? createMode === 'linked' : isExistingLinkedWorkOrder;

  // Logic: When has_vat is checked, default vat_rate to 20 if it's 0 or empty
  useEffect(() => {
    if (hasVat && (vatRate === 0 || vatRate === '0' || !vatRate)) {
      setValue('vat_rate', 20);
    }
  }, [hasVat, vatRate, setValue]);

  /** Line-item display currency (TRY default; preserved on edit via reset). */
  const lineCurrency = useWatch({ control, name: 'currency' }) ?? 'TRY';
  const watchedItems = useWatch({ control, name: 'items' });
  const materialsDiscountPercent = Number(useWatch({ control, name: 'materials_discount_percent' })) || 0;
  const hasTevkifat = !!useWatch({ control, name: 'has_tevkifat' });
  const plannedLaborCostTry = useWatch({ control, name: 'planned_operational_labor_cost' });
  const plannedLaborCostUsd = useWatch({ control, name: 'planned_operational_labor_cost_usd' });
  const { plannedLaborKey } = getActiveCurrencyFieldNames(lineCurrency);
  const plannedLaborAmount = Number(plannedLaborKey === 'planned_operational_labor_cost_usd' ? plannedLaborCostUsd : plannedLaborCostTry) || 0;
  const itemsSubtotal = (watchedItems ?? []).reduce((sum, item) => {
    const qty = parseFloat(item?.quantity) || 0;
    const price = parseFloat(item?.unit_price) || 0;
    return sum + qty * price;
  }, 0);
  const itemsCostTotal = (watchedItems ?? []).reduce((sum, item) => {
    const qty = parseFloat(item?.quantity) || 0;
    const cost = parseFloat(item?.cost) || 0;
    return sum + qty * cost;
  }, 0);
  const discountAmount = itemsSubtotal * (materialsDiscountPercent / 100);
  const discountedItemsTotal = itemsSubtotal - discountAmount;
  const netAmount = discountedItemsTotal;
  const { vatAmount, totalWithVat, withheldVat, totalPayable } = calcVatTevkifatSummary(
    netAmount,
    hasVat ? (Number(vatRate) || 0) : 0,
    hasTevkifat,
    Number(financeSettings?.tevkifat_rate_numerator) || 9,
    Number(financeSettings?.tevkifat_rate_denominator) || 10,
  );
  const materialMargin = netAmount - itemsCostTotal;
  const operationalMargin = materialMargin - plannedLaborAmount;
  const { data: siteData } = useSite(selectedSiteId);
  const activeLinkedProposalId = isExistingLinkedWorkOrder
    ? (workOrder?.proposal_id || '')
    : (isLinkedMode ? selectedLinkedProposalId : '');
  const linkedProposalOptions = useMemo(
    () => selectableLinkedProposals.map((proposal) => ({
      value: proposal.id,
      label: buildSelectableProposalLabel(proposal),
    })),
    [selectableLinkedProposals],
  );
  const { data: linkedProposalScope, isLoading: linkedProposalScopeLoading } = useLinkedWorkOrderProposalScope(activeLinkedProposalId);
  const linkedProposal = linkedProposalScope?.proposal ?? null;
  const linkedProposalItems = useMemo(
    () => linkedProposalScope?.items ?? [],
    [linkedProposalScope],
  );
  const selectedLinkedProposalSummary = useMemo(
    () => selectableLinkedProposals.find((proposal) => proposal.id === activeLinkedProposalId) || linkedProposal || null,
    [activeLinkedProposalId, linkedProposal, selectableLinkedProposals],
  );
  const { data: linkedExecutionSummary = [], isLoading: linkedExecutionSummaryLoading } = useLinkedWorkOrderExecutionSummary(
    activeLinkedProposalId,
    isEdit ? id : null,
  );
  const linkedExecutionMeta = useMemo(
    () => buildLinkedExecutionMeta(linkedProposalItems, linkedExecutionSummary),
    [linkedExecutionSummary, linkedProposalItems],
  );
  const hideCommercialForLinkedMode = isLinkedMode;
  const showInternalPlanning = !isFieldWorker || !isLinkedMode;
  const defaultInternalPlanningOpen =
    isEdit &&
    ((Number(workOrder?.planned_operational_labor_cost) || Number(workOrder?.planned_operational_labor_cost_usd)) > 0);
  const internalPlanningOpen = internalPlanningOpenOverride ?? defaultInternalPlanningOpen;

  // When switching TO survey: clear the blank default row (if it's the only item and still empty).
  // When switching FROM survey: restore the blank default row if the user left items empty.
  const prevWorkTypeRef = useRef(null);
  useEffect(() => {
    const prev = prevWorkTypeRef.current;
    prevWorkTypeRef.current = workType;
    if (prev === null || prev === workType) return;

    const currentItems = watchedItems ?? [];

    if (workType === 'survey') {
      const isOnlyBlankRow =
        currentItems.length === 1 &&
        !currentItems[0]?.description &&
        !currentItems[0]?.unit_price;
      if (isOnlyBlankRow) setValue('items', []);
    } else if (prev === 'survey' && currentItems.length === 0) {
      setValue('items', [{
        description: '',
        quantity: 1,
        unit: 'adet',
        unit_price: 0,
        material_id: null,
        proposal_item_id: null,
        revenue_type: 'material',
        source_type: 'manual_extra',
        cost: null,
      }]);
    }
    void trigger('site_id');
  }, [watchedItems, workType, setValue, trigger]);

  // Prefill from URL params
  useEffect(() => {
    if (!isEdit) {
      if (!isLinkedMode && prefilledSiteId) setValue('site_id', prefilledSiteId, { shouldValidate: false });
      if (prefilledDate) setValue('scheduled_date', prefilledDate);
      if (prefilledTime) setValue('scheduled_time', prefilledTime);
      if (prefilledDescription) setValue('description', prefilledDescription);
      if (prefilledWorkType && WORK_TYPES.includes(prefilledWorkType)) setValue('work_type', prefilledWorkType);
      if (prefilledAssignedTo) setValue('assigned_to', prefilledAssignedTo.split(',').filter(Boolean));
      if (prefilledStatus) setValue('status', prefilledStatus);
    }
  }, [isEdit, isLinkedMode, prefilledSiteId, prefilledDate, prefilledTime, prefilledDescription, prefilledWorkType, prefilledAssignedTo, prefilledStatus, setValue]);

  const [selectedCustomerIdOverride, setSelectedCustomerIdOverride] = useState(null);
  const selectedCustomerId = isLinkedMode
    ? (linkedProposal?.customer_id ?? workOrder?.customer_id ?? selectedCustomerIdOverride ?? prefilledCustomerId)
    : (selectedCustomerIdOverride ?? workOrder?.customer_id ?? prefilledCustomerId);
  const { data: customerSites = [], isLoading: isCustomerSitesLoading } = useSitesByCustomer(selectedCustomerId);

  // Auto-select the only site when a customer has exactly one location (no validation until pick/submit elsewhere).
  useEffect(() => {
    if (isLinkedMode) return;
    if (!selectedCustomerId) return;
    if (isCustomerSitesLoading) return;
    if (customerSites.length !== 1) return;
    const onlyId = customerSites[0].id;
    if (selectedSiteId === onlyId) return;
    if (selectedSiteId && customerSites.some((s) => s.id === selectedSiteId)) return;
    setValue('site_id', onlyId, { shouldValidate: false, shouldDirty: true });
  }, [isLinkedMode, selectedCustomerId, customerSites, isCustomerSitesLoading, selectedSiteId, setValue]);

  useEffect(() => {
    if (!isLinkedMode) return;
    if (!activeLinkedProposalId) {
      linkedProposalAppliedRef.current = null;
      return;
    }
    if (!linkedProposal || linkedProposalScopeLoading) return;
    if (linkedProposalAppliedRef.current === activeLinkedProposalId) return;

    const nextItems = isEdit
      ? mergeLinkedProposalScopeIntoItems(
        linkedProposalItems,
        watchedItems,
        linkedProposal.currency || workOrder?.currency || 'TRY',
      )
      : buildWorkOrderItemsFromProposal(linkedProposalItems, linkedProposal.currency || 'TRY');

    setValue('site_id', linkedProposal.site_id || workOrder?.site_id || '', { shouldValidate: true, shouldDirty: true });
    setValue('currency', linkedProposal.currency || workOrder?.currency || 'TRY', { shouldDirty: true });
    setValue('materials_discount_percent', linkedProposal.materials_discount_percent ?? linkedProposal.discount_percent ?? 0, { shouldDirty: true });
    setValue('has_vat', linkedProposal.has_vat ?? ((linkedProposal.vat_rate ?? 0) > 0), { shouldDirty: true });
    setValue('vat_rate', linkedProposal.vat_rate ?? 20, { shouldDirty: true });
    setValue('has_tevkifat', !!linkedProposal.has_tevkifat, { shouldDirty: true });
    if (!isEdit) {
      setValue('description', prefilledDescription || linkedProposal.title || '', { shouldDirty: true });
    }
    setValue('items', nextItems, { shouldDirty: true, shouldValidate: true });
    linkedProposalAppliedRef.current = activeLinkedProposalId;
  }, [
    activeLinkedProposalId,
    isEdit,
    isLinkedMode,
    linkedProposal,
    linkedProposalItems,
    linkedProposalScopeLoading,
    prefilledDescription,
    setValue,
    watchedItems,
    workOrder?.currency,
    workOrder?.site_id,
  ]);

  // Populate form when editing
  useEffect(() => {
    if (!isEdit) return;
    if (!workOrder) return;
    const siteId = workOrder.site_id ?? '';
    const assignedTo = Array.isArray(workOrder.assigned_to) ? workOrder.assigned_to : [];
    const woCurrency = workOrder.currency || 'TRY';
    const items = (workOrder.work_order_materials || []).map((wom) => ({
      description: wom.description || wom.materials?.name || '',
      quantity: parseFloat(wom.quantity) || 1,
      unit: normalizeWorkOrderItemUnit(wom.unit),
      unit_price: resolveProposalItemUnitPrice(wom, woCurrency),
      cost: wom.cost ?? wom.cost_usd ?? null,
      material_id: wom.material_id || null,
      proposal_item_id: wom.proposal_item_id || null,
      revenue_type: resolveLineRevenueType({
        description: wom.description || wom.materials?.name || '',
        materialId: wom.material_id,
        revenueType: wom.revenue_type,
      }),
      source_type: ['proposal_item', 'manual_extra', 'legacy'].includes(wom.source_type)
        ? wom.source_type
        : (wom.proposal_item_id ? 'proposal_item' : 'manual_extra'),
    }));
    const legacyServiceRow = buildLegacyServiceRevenueRow(
      workOrder,
      woCurrency,
      t('workOrders:form.legacyServiceRevenueRow'),
    );
    const hydratedItems = legacyServiceRow ? [...items, legacyServiceRow] : items;
    reset({
      site_id: siteId,
      form_no: workOrder.form_no || '',
      work_type: workOrder.work_type || 'service',
      work_type_other: workOrder.work_type_other || '',
      status: workOrder.status || 'pending',
      priority: workOrder.priority || 'normal',
      scheduled_date: workOrder.scheduled_date || '',
      scheduled_time: workOrder.scheduled_time || '',
      assigned_to: assignedTo,
      description: workOrder.description || '',
      notes: workOrder.notes || '',
      currency: workOrder.currency || 'TRY',
      items: hydratedItems.length > 0 ? hydratedItems : workOrderDefaultValues.items,
      materials_discount_percent: workOrder.materials_discount_percent ?? 0,
      service_fee_revenue: 0,
      service_fee_revenue_usd: 0,
      planned_operational_labor_cost: workOrder.planned_operational_labor_cost ?? 0,
      planned_operational_labor_cost_usd: workOrder.planned_operational_labor_cost_usd ?? 0,
      has_vat: !!workOrder.has_vat,
      has_tevkifat: !!workOrder.has_tevkifat,
      vat_rate: workOrder.vat_rate ?? (workOrder.has_vat ? 20 : 0),
    });
  }, [workOrder, isEdit, reset, t]);

  const handleCreateModeChange = (nextMode) => {
    if (isEdit || nextMode === createMode) return;
    setCreateMode(nextMode);

    if (nextMode === 'standalone') {
      setSelectedLinkedProposalId('');
      linkedProposalAppliedRef.current = null;
      setSelectedCustomerIdOverride(prefilledCustomerId || '');
      setValue('site_id', prefilledSiteId || '', { shouldValidate: false, shouldDirty: true });
      setValue('currency', 'TRY', { shouldDirty: true });
      setValue('materials_discount_percent', 0, { shouldDirty: true });
      setValue('has_vat', true, { shouldDirty: true });
      setValue('vat_rate', 20, { shouldDirty: true });
      setValue('has_tevkifat', false, { shouldDirty: true });
      setValue('items', workOrderDefaultValues.items, { shouldDirty: true, shouldValidate: true });
      return;
    }

    setSelectedCustomerIdOverride(null);
    setValue('site_id', '', { shouldValidate: false, shouldDirty: true });
    setValue('items', [], { shouldDirty: true, shouldValidate: true });
  };

  const getGrossTotalTry = (data) => {
    const subtotal = (data.items || []).reduce((sum, item) => {
      const qty = parseFloat(item?.quantity) || 0;
      const price = parseFloat(item?.unit_price) || 0;
      return sum + qty * price;
    }, 0);
    const discountPercent = Number(data.materials_discount_percent) || 0;
    const grandTotal = subtotal - (subtotal * discountPercent / 100);
    const vatRateForTotal = data.has_vat ? (Number(data.vat_rate) || 0) : 0;
    const { totalWithVat } = calcVatTevkifatSummary(grandTotal, vatRateForTotal, false, 0, 1);
    const currency = String(data.currency || 'TRY').toUpperCase();
    if (currency === 'USD') {
      const fx = Number(latestUsdRate?.effective_rate) || 1;
      return totalWithVat * fx;
    }
    return totalWithVat;
  };

  const applySelectedMaterialToItemRow = (index, payload) => {
    if (!payload) return;

    const rowCurrency = normalizeCurrency(lineCurrency);
    const materialCurrency = normalizeCurrency(payload.currency);
    const latestUsdFx = Number(latestUsdRate?.effective_rate);
    const requiresFx = materialCurrency !== rowCurrency;
    const hasFx = Number.isFinite(latestUsdFx) && latestUsdFx > 0;

    if (requiresFx && !hasFx) {
      toast.error(t('workOrders:form.materialSelect.exchangeRateRequired'));
      return;
    }

    const convertedUnitPrice = roundCurrencySnapshot(convertSnapshotAmount(
      payload.unit_price,
      materialCurrency,
      rowCurrency,
      latestUsdFx,
    ));
    const convertedCost = roundCurrencySnapshot(convertSnapshotAmount(
      payload.cost_price,
      materialCurrency,
      rowCurrency,
      latestUsdFx,
    ));

    setValue(`items.${index}.description`, payload.description, { shouldValidate: true });
    setValue(`items.${index}.material_id`, payload.material_id ?? null);
    setValue(`items.${index}.proposal_item_id`, null, { shouldDirty: true });
    setValue(
      `items.${index}.revenue_type`,
      inferLineRevenueType({
        description: payload.description,
        materialId: payload.material_id,
      }),
      { shouldDirty: true },
    );
    setValue(`items.${index}.source_type`, 'manual_extra', { shouldDirty: true });
    setValue(`items.${index}.unit`, normalizeWorkOrderItemUnit(payload.unit), { shouldDirty: true });
    setValue(`items.${index}.unit_price`, convertedUnitPrice ?? 0, { shouldDirty: true });
    setValue(`items.${index}.cost`, convertedCost, { shouldDirty: true });
  };

  const needsTevkifatConfirm = (data) => {
    if (data.has_tevkifat) return false;
    const threshold = Number(financeSettings?.tevkifat_threshold_try) || 12000;
    return getGrossTotalTry(data) >= threshold;
  };

  const persistSubmit = async (data) => {
    try {
      const cleanValue = (val) => {
        if (val === '' || val === undefined) return null;
        if (typeof val === 'string') return val.trim() || null;
        return val;
      };

      const rawSiteId = data.site_id || selectedSiteId || (isEdit && workOrder?.site_id) || '';
      const finalSiteId = rawSiteId === '' ? null : rawSiteId;
      const proposalIdToLink = isLinkedMode ? activeLinkedProposalId : prefilledProposalId;

      if (isLinkedMode && !proposalIdToLink) {
        toast.error(t('workOrders:form.linkedMode.proposalRequired'));
        return;
      }

      if (data.work_type !== 'survey' && !finalSiteId) {
        setError('site_id', { type: 'manual', message: t('workOrders:validation.siteRequired') });
        toast.error(t('workOrders:validation.siteRequired'));
        return;
      }

      const persistableItems = sanitizePersistableWorkOrderItems(data.items);
      if (persistableItems.length === 0) {
        if (isLinkedMode) {
          const normalizedDescription = cleanValue(data.description);
          if (!normalizedDescription) {
            const descriptionMessage = t('workOrders:validation.linkedVisitDescriptionRequired');
            setError('description', { type: 'manual', message: descriptionMessage });
            toast.error(descriptionMessage);
            return;
          }
        } else {
          const itemsMessage = t('errors:validation.required');
          setError('items', { type: 'manual', message: itemsMessage });
          toast.error(itemsMessage);
          return;
        }
      }

      const formattedData = {
        site_id: finalSiteId,
        work_type: data.work_type, // Required
        status: data.status || 'pending',
        priority: data.priority || 'normal',
        currency: data.currency || 'TRY',
        amount: null,
        // Optional fields - convert empty strings to null
        form_no: cleanValue(data.form_no),
        work_type_other: (data.work_type === 'other' && data.work_type_other?.trim()) ? data.work_type_other.trim() : null,
        scheduled_date: cleanValue(data.scheduled_date),
        scheduled_time: cleanValue(data.scheduled_time),
        description: cleanValue(data.description),
        notes: cleanValue(data.notes),
        // assigned_to: ensure it's always an array of UUIDs (empty array is valid for UUID[])
        assigned_to: Array.isArray(data.assigned_to) && data.assigned_to.length > 0
          ? data.assigned_to.filter(uid => uid)
          : [],
        items: persistableItems,
        materials_discount_percent: data.materials_discount_percent ?? 0,
        service_fee_revenue: 0,
        service_fee_revenue_usd: 0,
        planned_operational_labor_cost: Number(data.planned_operational_labor_cost) || 0,
        planned_operational_labor_cost_usd: Number(data.planned_operational_labor_cost_usd) || 0,
        has_vat: !!data.has_vat,
        has_tevkifat: !!data.has_tevkifat,
        vat_rate: data.has_vat ? (data.vat_rate != null ? Number(data.vat_rate) : 20) : 0,
      };

      if (isEdit) {
        await updateMutation.mutateAsync({ id, ...formattedData });
        navigate(`/work-orders/${id}`);
      } else {
        const newWo = await createMutation.mutateAsync(formattedData);
        if (proposalIdToLink) {
          await linkWorkOrderMutation.mutateAsync({
            proposalId: proposalIdToLink,
            workOrderId: newWo.id,
          });
        }

        // Auto-link to proposal if created from proposal page
        if (prefilledProposalId) {
          navigate(`/proposals/${prefilledProposalId}`);
        } else {
          // Auto-link back to operations item if created from operations pool
          if (prefilledSourceItemId) {
            await updateOperationsItem({
              id: prefilledSourceItemId,
              work_order_id: newWo.id,
            });
          }
          navigate(`/work-orders/${newWo.id}`);
        }
      }
    } catch (err) {
      const errorMessage = err?.message || err?.details || err?.hint || t('common:errors.saveFailed');
      toast.error(`${errorMessage}${err?.code ? ` (${err.code})` : ''}`);
    }
  };

  const onSubmit = async (data) => {
    if (needsTevkifatConfirm(data)) {
      setPendingSubmitData(data);
      setShowTevkifatConfirmModal(true);
      return;
    }
    await persistSubmit(data);
  };

  const onInvalid = (formErrors) => {
    const specific = firstFormErrorMessage(formErrors);
    toast.error(specific || t('workOrders:validation.fillRequired'));
  };

  if (isEdit && isWorkOrderLoading) {
    return <FormSkeleton />;
  }

  const priorityOptions = [
    { value: 'low', label: t('workOrders:priorities.low') },
    { value: 'normal', label: t('workOrders:priorities.normal') },
    { value: 'high', label: t('workOrders:priorities.high') },
    { value: 'urgent', label: t('workOrders:priorities.urgent') },
  ];

  return (
    <PageContainer maxWidth="4xl" padding="default" className="space-y-8 pb-24 mx-auto">
      <WorkOrderFormHero
        isEdit={isEdit}
        onCancel={() => navigate(-1)}
        onSave={handleSubmit(onSubmit, onInvalid)}
        isSaving={isSubmitting || createMutation.isPending || updateMutation.isPending}
        selectedSite={siteData}
      />

      <form
        onSubmit={handleSubmit(onSubmit, onInvalid)}
        className="space-y-8"
        id="work-order-form"
      >
        {!isEdit && (
          <Card className="rounded-[2rem] p-4 sm:p-6 lg:p-8 border-neutral-200/60 dark:border-[#262626] shadow-sm">
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-neutral-900 dark:text-neutral-100">
                  {t('workOrders:form.linkedMode.modeTitle')}
                </h2>
                <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                  {t('workOrders:form.linkedMode.modeHint')}
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => handleCreateModeChange('standalone')}
                  className={cn(
                    'rounded-[1.5rem] border px-5 py-4 text-left transition-colors',
                    !isLinkedMode
                      ? 'border-primary-500 bg-primary-50/70 dark:border-primary-500 dark:bg-primary-950/20'
                      : 'border-neutral-200 dark:border-[#262626]'
                  )}
                >
                  <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {t('workOrders:form.linkedMode.standaloneTitle')}
                  </p>
                  <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                    {t('workOrders:form.linkedMode.standaloneHint')}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => handleCreateModeChange('linked')}
                  className={cn(
                    'rounded-[1.5rem] border px-5 py-4 text-left transition-colors',
                    isLinkedMode
                      ? 'border-primary-500 bg-primary-50/70 dark:border-primary-500 dark:bg-primary-950/20'
                      : 'border-neutral-200 dark:border-[#262626]'
                  )}
                >
                  <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {t('workOrders:form.linkedMode.linkedTitle')}
                  </p>
                  <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                    {t('workOrders:form.linkedMode.linkedHint')}
                  </p>
                </button>
              </div>
            </div>
          </Card>
        )}

        {isLinkedMode ? (
          <Card className="rounded-[2rem] p-4 sm:p-6 lg:p-8 overflow-visible border-neutral-200/60 dark:border-[#262626] shadow-sm">
            <div className="space-y-5">
              <Select
                label={t('workOrders:form.linkedMode.proposalLabel')}
                hint={t('workOrders:form.linkedMode.proposalHint')}
                options={linkedProposalOptions}
                value={activeLinkedProposalId}
                onChange={(e) => {
                  if (isEdit) return;
                  linkedProposalAppliedRef.current = null;
                  setSelectedLinkedProposalId(e.target.value);
                }}
                disabled={selectableLinkedProposalsLoading || isEdit}
                className="rounded-2xl"
              />

              {selectedLinkedProposalSummary ? (
                <div className="rounded-[1.5rem] border border-neutral-200 bg-neutral-50/70 p-5 dark:border-[#262626] dark:bg-[#1a1a1a]">
                  <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {buildSelectableProposalLabel(selectedLinkedProposalSummary)}
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">
                        {t('workOrders:form.linkedMode.customerLabel')}
                      </p>
                      <p className="mt-1 text-sm text-neutral-900 dark:text-neutral-100">
                        {selectedLinkedProposalSummary.customer_company_name || selectedLinkedProposalSummary.company_name || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">
                        {t('workOrders:form.linkedMode.siteLabel')}
                      </p>
                      <p className="mt-1 text-sm text-neutral-900 dark:text-neutral-100">
                        {selectedLinkedProposalSummary.site_name || '—'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-neutral-300 px-5 py-6 text-sm text-neutral-500 dark:border-[#333] dark:text-neutral-400">
                  {t('workOrders:form.linkedMode.proposalEmptyState')}
                </div>
              )}
            </div>
          </Card>
        ) : (
          <Card className="rounded-[2rem] p-4 sm:p-6 lg:p-8 overflow-visible border-neutral-200/60 dark:border-[#262626] shadow-sm">
            <Controller
              name="site_id"
              control={control}
              render={({ field, fieldState }) => (
                <CustomerSiteSelector
                  selectedCustomerId={selectedCustomerId}
                  selectedSiteId={field.value ?? ''}
                  onCustomerChange={(cid) => {
                    setSelectedCustomerIdOverride(cid || '');
                    field.onChange('');
                    clearErrors('site_id');
                  }}
                  onSiteChange={(sid) => {
                    field.onChange(sid ?? '');
                    clearErrors('site_id');
                    if (sid) void trigger('site_id');
                  }}
                  onAddNewCustomer={() => navigate('/customers/new')}
                  onAddNewSite={() => {
                    setSiteModalIntent('new-site');
                    setShowSiteModal(true);
                  }}
                  error={fieldState.error?.message}
                />
              )}
            />
          </Card>
        )}

        {/* 2. Work Details */}
        <Card header={
          <div className="flex items-center space-x-3 px-2">
            <div className="p-2 bg-primary-50 dark:bg-primary-950/30 rounded-lg">
              <FileText className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            </div>
            <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-[0.2em] text-[10px]">
              {t('workOrders:form.sections.workInfo')}
            </h3>
          </div>
        } className="rounded-[2rem] p-8 border-neutral-200/60 dark:border-[#262626] shadow-sm">
          <div className="space-y-10 pt-4">
            <Select
              label={t('workOrders:form.fields.priority')}
              options={priorityOptions}
              error={errors.priority?.message}
              className="rounded-2xl"
              {...register('priority')}
            />

            <div className="space-y-4">
              <label className="block text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest ml-1">
                {t('workOrders:form.fields.workType')}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {WORK_TYPES.map((type) => (
                  <label 
                    key={type}
                    className={cn(
                      "relative flex flex-col items-center justify-center p-4 rounded-2xl border-2 cursor-pointer transition-all duration-300 group",
                      workType === type 
                        ? "bg-primary-50/50 border-primary-600 dark:bg-primary-950/20 dark:border-primary-500 shadow-md scale-[1.02]" 
                        : "bg-white border-neutral-100 hover:border-neutral-300 dark:bg-[#171717] dark:border-[#262626] hover:shadow-sm"
                    )}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      value={type}
                      {...register('work_type')}
                    />
                    <span className={cn(
                      "text-sm font-bold tracking-tight text-center",
                      workType === type ? "text-primary-700 dark:text-primary-400" : "text-neutral-600 dark:text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-neutral-200"
                    )}>
                      {tCommon(`workType.${type}`)}
                    </span>
                    {workType === type && (
                      <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary-600 animate-pulse" />
                    )}
                  </label>
                ))}
              </div>
              {errors.work_type && (
                <p className="text-sm text-red-600 mt-2 ml-1">{errors.work_type.message}</p>
              )}
            </div>

            {workType === 'other' && (
              <Input
                label={t('workOrders:form.fields.workTypeOther')}
                placeholder={t('workOrders:form.placeholders.workTypeOther')}
                error={errors.work_type_other?.message}
                className="rounded-2xl"
                {...register('work_type_other')}
              />
            )}

            <AccountNoWarning 
              workType={workType} 
              accountNo={siteData?.account_no}
              addAccountDisabled={!selectedCustomerId}
              onAddAccountNo={() => {
                setSiteModalIntent('account-no');
                setShowSiteModal(true);
              }}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Input
                label={t('workOrders:form.fields.scheduledDate')}
                type="date"
                leftIcon={Calendar}
                error={errors.scheduled_date?.message}
                className="rounded-2xl"
                {...register('scheduled_date')}
              />
              <Input
                label={t('workOrders:form.fields.scheduledTime')}
                type="time"
                leftIcon={Clock}
                error={errors.scheduled_time?.message}
                className="rounded-2xl"
                {...register('scheduled_time')}
              />
            </div>

            <Textarea
              label={t('workOrders:form.fields.description')}
              hint={t('workOrders:form.hints.description')}
              placeholder={t('workOrders:form.placeholders.description')}
              error={errors.description?.message}
              className="rounded-2xl min-h-[120px]"
              {...register('description')}
            />

            {!hideCommercialForLinkedMode && (
              <div className="pt-4 border-t border-neutral-100 dark:border-[#262626] max-w-2xl">
                <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                  <label className="flex items-center gap-3 p-3 h-12 md:h-10 rounded-2xl bg-neutral-50 dark:bg-neutral-900/50 cursor-pointer select-none border border-neutral-200 dark:border-[#262626] hover:border-primary-500/50 transition-colors shrink-0">
                    <input
                      type="checkbox"
                      className="h-5 w-5 rounded border-neutral-300 dark:border-neutral-600 text-primary-600 focus:ring-primary-500"
                      {...register('has_vat')}
                    />
                    <span className="text-sm font-bold text-neutral-700 dark:text-neutral-200 uppercase tracking-wider">
                      {t('workOrders:form.fields.hasVat')}
                    </span>
                  </label>

                  {hasVat && (
                    <div className="flex-1 max-w-[200px]">
                      <Input
                        label={t('workOrders:form.fields.vatRate')}
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        rightIcon={<span className="text-neutral-400 font-bold">%</span>}
                        error={errors.vat_rate?.message}
                        className="rounded-2xl"
                        {...register('vat_rate')}
                      />
                    </div>
                  )}
                  <label className="flex items-center gap-3 p-3 h-12 md:h-10 rounded-2xl bg-neutral-50 dark:bg-neutral-900/50 cursor-pointer select-none border border-neutral-200 dark:border-[#262626] hover:border-primary-500/50 transition-colors shrink-0">
                    <input
                      type="checkbox"
                      className="h-5 w-5 rounded border-neutral-300 dark:border-neutral-600 text-primary-600 focus:ring-primary-500"
                      {...register('has_tevkifat')}
                    />
                    <span className="text-sm font-bold text-neutral-700 dark:text-neutral-200 uppercase tracking-wider">
                      {t('workOrders:form.fields.hasTevkifat')}
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* 3. Materials */}
        <Card className="rounded-[2rem] p-4 sm:p-6 lg:p-8 overflow-hidden border-neutral-200/60 dark:border-[#262626] shadow-sm">
          {isLinkedMode && !activeLinkedProposalId ? (
            <div className="rounded-[1.5rem] border border-dashed border-neutral-300 px-5 py-8 text-center text-sm text-neutral-500 dark:border-[#333] dark:text-neutral-400">
              {t('workOrders:form.linkedMode.itemsLockedUntilProposal')}
            </div>
          ) : (
            <WorkOrderItemsEditor
              control={control}
              register={register}
              errors={errors}
              watch={watch}
              setValue={setValue}
              onMaterialSelect={applySelectedMaterialToItemRow}
              currency={lineCurrency}
              workType={workType}
              linkedMode={isLinkedMode}
              hideCommercialFields={hideCommercialForLinkedMode}
              lockProposalDerivedRows={isLinkedMode}
              linkedExecutionMeta={linkedExecutionMeta}
              linkedExecutionLoading={linkedProposalScopeLoading || linkedExecutionSummaryLoading}
            />
          )}
        </Card>

        {showInternalPlanning && (
        <Card
          header={
            <button
              type="button"
              onClick={() => setInternalPlanningOpenOverride((open) => !(open ?? defaultInternalPlanningOpen))}
              className="flex w-full items-center justify-between px-2 text-left"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-[0.2em] text-[10px]">
                    {t('workOrders:form.sections.internalPlanning')}
                  </h3>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 normal-case tracking-normal">
                    {t('workOrders:form.hints.plannedOperationalLaborCost')}
                  </p>
                </div>
              </div>
              {internalPlanningOpen ? (
                <ChevronUp className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
              )}
            </button>
          }
          className="rounded-[2rem] p-8 border-neutral-200/60 dark:border-[#262626] shadow-sm"
        >
          {internalPlanningOpen && (
            <div className="pt-4 space-y-4">
              <Input
                label={t('workOrders:form.fields.plannedOperationalLaborCost')}
                hint={t('workOrders:form.hints.plannedOperationalLaborCost')}
                type="number"
                min={0}
                step="0.01"
                placeholder="0"
                error={errors?.[plannedLaborKey]?.message}
                className="rounded-2xl max-w-md"
                {...register(plannedLaborKey)}
              />
              <div className="rounded-2xl border border-amber-100 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20 px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                  {t('workOrders:detail.plannedOperationalLaborCost')}
                </span>
                <span className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  {formatCurrency(plannedLaborAmount, lineCurrency)}
                </span>
              </div>
            </div>
          )}
        </Card>
        )}

        {!hideCommercialForLinkedMode && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <Card header={
            <div className="flex items-center space-x-3 px-2">
              <div className="p-2 bg-primary-50 dark:bg-primary-950/30 rounded-lg">
                <FileText className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              </div>
              <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-[0.2em] text-[10px]">
                {t('workOrders:form.sections.commercialSummary')}
              </h3>
            </div>
          } className="rounded-[2rem] p-8 border-neutral-200/60 dark:border-[#262626] shadow-sm">
            <div className="pt-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-600 dark:text-neutral-400">{t('proposals:detail.subtotal')}</span>
                <span className="text-neutral-900 dark:text-neutral-100">{formatCurrency(itemsSubtotal, lineCurrency)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-600 dark:text-neutral-400">{t('proposals:detail.discountAmount')}</span>
                <span className="text-neutral-900 dark:text-neutral-100">{formatCurrency(-discountAmount, lineCurrency)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-600 dark:text-neutral-400">{t('workOrders:detail.discountedItemsTotal')}</span>
                <span className="text-neutral-900 dark:text-neutral-100">{formatCurrency(discountedItemsTotal, lineCurrency)}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-[#333]">
                <span className="text-sm font-bold text-neutral-700 dark:text-neutral-300 uppercase">
                  {t('workOrders:detail.netRevenueExclVat')}
                </span>
                <span className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                  {formatCurrency(netAmount, lineCurrency)}
                </span>
              </div>
              {hasVat && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-600 dark:text-neutral-400">
                      {t('workOrders:detail.vatLine', { rate: Number(vatRate) || 0 })}
                    </span>
                    <span className="text-neutral-900 dark:text-neutral-100">{formatCurrency(vatAmount, lineCurrency)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-[#333]">
                    <span className="text-sm font-bold text-primary-700 dark:text-primary-300 uppercase">
                      {t('workOrders:detail.grossAmount')}
                    </span>
                    <span className="text-xl font-bold text-primary-600 dark:text-primary-400">
                      {formatCurrency(totalWithVat, lineCurrency)}
                    </span>
                  </div>
                  {hasTevkifat && (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-neutral-600 dark:text-neutral-400">{t('workOrders:detail.withheldVat')}</span>
                        <span className="text-neutral-900 dark:text-neutral-100">-{formatCurrency(withheldVat, lineCurrency)}</span>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-[#333]">
                        <span className="text-sm font-bold text-primary-700 dark:text-primary-300 uppercase">
                          {t('workOrders:detail.totalPayable')}
                        </span>
                        <span className="text-xl font-bold text-primary-600 dark:text-primary-400">
                          {formatCurrency(totalPayable, lineCurrency)}
                        </span>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </Card>

          <Card header={
            <div className="flex items-center space-x-3 px-2">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-[0.2em] text-[10px]">
                {t('workOrders:form.sections.internalSummary')}
              </h3>
            </div>
          } className="rounded-[2rem] p-8 border-neutral-200/60 dark:border-[#262626] shadow-sm">
            <div className="pt-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-600 dark:text-neutral-400">{t('workOrders:detail.itemsCostTotal')}</span>
                <span className="text-neutral-900 dark:text-neutral-100">{formatCurrency(itemsCostTotal, lineCurrency)}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-[#333]">
                <span className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">
                  {t('workOrders:detail.materialMarginInternal')}
                </span>
                <span className={cn(
                  'text-lg font-bold',
                  materialMargin >= 0
                    ? 'text-green-600 dark:text-green-500'
                    : 'text-error-600 dark:text-error-400'
                )}>
                  {formatCurrency(materialMargin, lineCurrency)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-600 dark:text-neutral-400">{t('workOrders:detail.plannedOperationalLaborCost')}</span>
                <span className="text-neutral-900 dark:text-neutral-100">{formatCurrency(plannedLaborAmount, lineCurrency)}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-[#333]">
                <span className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">
                  {t('workOrders:detail.operationalMarginInternal')}
                </span>
                <span className={cn(
                  'text-lg font-bold',
                  operationalMargin >= 0
                    ? 'text-green-600 dark:text-green-500'
                    : 'text-error-600 dark:text-error-400'
                )}>
                  {formatCurrency(operationalMargin, lineCurrency)}
                </span>
              </div>
            </div>
          </Card>
        </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* 4. Workers */}
          <Card className="rounded-[2rem] p-4 sm:p-6 lg:p-8 border-neutral-200/60 dark:border-[#262626] shadow-sm">
            <Controller
              name="assigned_to"
              control={control}
              render={({ field }) => (
                <WorkerSelector
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.assigned_to?.message}
                />
              )}
            />
          </Card>

          {/* 5. Internal Notes */}
          <Card header={
            <div className="flex items-center space-x-3 px-2">
              <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-[0.2em] text-[10px]">
                {t('workOrders:form.sections.notes')}
              </h3>
            </div>
          } className="rounded-[2rem] p-8 border-neutral-200/60 dark:border-[#262626] shadow-sm">
            <div className="pt-4">
              <Textarea
                placeholder={t('workOrders:form.placeholders.notes')}
                hint={t('workOrders:form.hints.notes')}
                error={errors.notes?.message}
                className="rounded-2xl min-h-[100px]"
                {...register('notes')}
              />
            </div>
          </Card>
        </div>

        {/* Floating Action Bar — Mobile only (hero buttons on desktop) */}
        <div className="fixed bottom-0 left-0 right-0 px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-white/80 dark:bg-[#171717]/80 backdrop-blur-md border-t border-neutral-200 dark:border-[#262626] z-50 flex gap-3 lg:hidden">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(-1)}
            className="flex-1"
            leftIcon={<X className="w-4 h-4" />}
          >
            {tCommon('actions.cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleSubmit(onSubmit, onInvalid)}
            loading={isSubmitting || createMutation.isPending || updateMutation.isPending}
            className="flex-1"
            leftIcon={<Save className="w-4 h-4" />}
          >
            {isEdit ? tCommon('actions.save') : tCommon('actions.create')}
          </Button>
        </div>
      </form>

      <SiteFormModal
        open={showSiteModal}
        onClose={() => {
          setShowSiteModal(false);
          setSiteModalIntent(null);
        }}
        customerId={
          selectedCustomerId ||
          siteData?.customer_id ||
          prefilledCustomerId ||
          ''
        }
        site={
          siteModalIntent === 'account-no' && selectedSiteId && siteData
            ? siteData
            : null
        }
        onSuccess={(newSite) => {
          if (newSite?.id) {
            setValue('site_id', newSite.id, { shouldValidate: true, shouldDirty: true });
            clearErrors('site_id');
            void trigger('site_id');
          }
        }}
      />

      <Modal
        open={showTevkifatConfirmModal}
        onClose={() => {
          setShowTevkifatConfirmModal(false);
          setPendingSubmitData(null);
        }}
        title={t('workOrders:form.tevkifatConfirm.title')}
        footer={(
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowTevkifatConfirmModal(false);
                setPendingSubmitData(null);
              }}
            >
              {tCommon('actions.cancel')}
            </Button>
            <Button
              type="button"
              onClick={async () => {
                if (!pendingSubmitData) return;
                setShowTevkifatConfirmModal(false);
                const queued = pendingSubmitData;
                setPendingSubmitData(null);
                await persistSubmit(queued);
              }}
            >
              {t('workOrders:form.tevkifatConfirm.confirm')}
            </Button>
          </>
        )}
      >
        <p>{t('workOrders:form.tevkifatConfirm.message')}</p>
      </Modal>
    </PageContainer>
  );
}
