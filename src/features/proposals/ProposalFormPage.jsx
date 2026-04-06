import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Save,
  X,
  ClipboardList,
  StickyNote,
  FileText,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageContainer, PageHeader } from '../../components/layout';
import {
  Button,
  Input,
  Select,
  Textarea,
  Card,
  Spinner,
  FormSkeleton,
  UnsavedChangesModal,
  Modal,
} from '../../components/ui';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { proposalSchema, proposalDefaultValues, CURRENCIES } from './schema';
import {
  useProposal,
  useProposalItems,
  useProposalSections,
  useProposalAnnualFixedCosts,
  useCreateProposal,
  useUpdateProposal,
  useUpdateProposalSectionsAndItems,
  useUpdateProposalAnnualFixedCosts,
} from './hooks';
import { useFinanceSettings, useLatestRate } from '../finance/hooks';
import { useCustomer } from '../customers/hooks';
import { useCloseOperationsItem } from '../operations/hooks';
import { CustomerSiteSelector } from '../workOrders/CustomerSiteSelector';
import { SiteFormModal } from '../customerSites/SiteFormModal';
import { ProposalItemsEditor } from './components/ProposalItemsEditor';
import { ProposalAnnualFixedCostsEditor } from './components/ProposalAnnualFixedCostsEditor';
import { ProposalStepper } from './components/ProposalStepper';
import { ProposalLivePreview } from './components/ProposalLivePreview';
import { calcProposalTotals, calcVatTevkifatSummary } from '../../lib/proposalCalc';

/** Maps Zod issue path to Turkish context for toast (step validation used to show only a generic message). */
function formatProposalValidationToast(issue, t) {
  const path = issue.path;
  const p0 = path[0];
  let where = '';
  if (p0 === 'site_id') where = t('proposals:form.validation.where.site');
  else if (p0 === 'title') where = t('proposals:form.validation.where.title');
  else if (p0 === 'items' && path.length === 1) where = t('proposals:form.validation.where.items');
  else if (p0 === 'items' && typeof path[1] === 'number') {
    const n = path[1] + 1;
    const sub = path[2];
    if (sub === 'description') where = t('proposals:form.validation.where.itemMaterial', { n });
    else if (sub === 'quantity') where = t('proposals:form.validation.where.itemQuantity', { n });
    else if (sub === 'unit_price') where = t('proposals:form.validation.where.itemUnitPrice', { n });
    else if (sub === 'unit') where = t('proposals:form.validation.where.itemUnit', { n });
    else where = t('proposals:form.validation.where.itemMaterial', { n });
  } else if (p0 === 'annual_fixed_costs' && typeof path[1] === 'number') {
    const n = path[1] + 1;
    const sub = path[2];
    if (sub === 'description') where = t('proposals:form.validation.where.annualDescription', { n });
    else if (sub === 'quantity') where = t('proposals:form.validation.where.annualQuantity', { n });
    else where = t('proposals:form.validation.where.annualDescription', { n });
  }
  if (!where) return issue.message;
  return t('proposals:form.validation.toastLine', { where, message: issue.message });
}

function getStepIndexForProposalIssue(issue) {
  const p0 = issue.path[0];
  if (p0 === 'items' || p0 === 'annual_fixed_costs') return 1;
  if (
    p0 === 'site_id'
    || p0 === 'title'
    || p0 === 'currency'
    || p0 === 'proposal_date'
    || p0 === 'survey_date'
    || p0 === 'vat_rate'
    || p0 === 'scope_of_work'
    || p0 === 'authorized_person'
    || p0 === 'customer_representative'
    || p0 === 'has_vat'
    || p0 === 'has_tevkifat'
    || p0 === 'installation_date'
    || p0 === 'completion_date'
  ) {
    return 0;
  }
  return 1;
}

export function ProposalFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation(['proposals', 'common', 'workOrders']);
  const { t: tCommon } = useTranslation('common');
  const isEdit = !!id;

  const [showSiteModal, setShowSiteModal] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [termsOpen, setTermsOpen] = useState(false);
  const [annualFixedOpen, setAnnualFixedOpen] = useState(true);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [showTevkifatConfirmModal, setShowTevkifatConfirmModal] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(null);

  const { data: proposal, isLoading: isProposalLoading } = useProposal(id);
  const { data: existingItems = [], isLoading: isItemsLoading } = useProposalItems(id);
  const { data: existingSections = [], isLoading: isSectionsLoading } = useProposalSections(id);
  const { data: existingAnnualFixed = [], isLoading: isAnnualFixedLoading } = useProposalAnnualFixedCosts(id);
  const { data: selectedCustomer } = useCustomer(selectedCustomerId);
  const { data: financeSettings } = useFinanceSettings();
  const { data: latestUsdRate } = useLatestRate('USD');
  const createMutation = useCreateProposal();
  const updateMutation = useUpdateProposal();
  const updateSectionsAndItemsMutation = useUpdateProposalSectionsAndItems();
  const updateAnnualFixedMutation = useUpdateProposalAnnualFixedCosts();
  const closeOperationsItemMutation = useCloseOperationsItem();

  const sourceCustomerId = searchParams.get('customerId') || '';
  const sourceSiteId = searchParams.get('siteId') || '';
  const sourceDescription = searchParams.get('description') || '';
  const sourceItemId = searchParams.get('sourceItemId') || '';

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    getValues,
    setValue,
    trigger,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    resolver: zodResolver(proposalSchema),
    defaultValues: proposalDefaultValues,
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const {
    fields: sectionFields,
    append: appendSection,
    remove: removeSection,
  } = useFieldArray({ control, name: 'sections' });

  const {
    fields: proposalItemFields,
    append: appendProposalItem,
    remove: removeProposalItem,
  } = useFieldArray({ control, name: 'items' });

  const {
    fields: annualFixedFields,
    append: appendAnnualFixed,
    remove: removeAnnualFixed,
  } = useFieldArray({ control, name: 'annual_fixed_costs' });

  const justSavedRef = useRef(false);
  const blocker = useUnsavedChanges({
    isDirty: hasInitialized && isDirty,
    skipBlockingRef: justSavedRef,
  });

  const selectedCurrency = watch('currency') ?? 'USD';
  const hasVat = watch('has_vat');
  const vatRate = watch('vat_rate');

  // Logic: When has_vat is checked, default vat_rate to 20 if it's 0 or empty
  useEffect(() => {
    if (hasVat && (vatRate === 0 || vatRate === '0' || !vatRate)) {
      setValue('vat_rate', 20);
    }
  }, [hasVat, vatRate, setValue]);

  // Watch all values for live preview
  const watchedValues = watch();

  // Populate form when editing
  useEffect(() => {
    if (isEdit) {
      if (!hasInitialized && proposal && !isProposalLoading && !isItemsLoading && !isSectionsLoading && !isAnnualFixedLoading) {
        const itemCurrency = proposal.currency === 'USD' ? 'USD' : 'TRY';

        // Use DB section id as _local_id so items can reference it directly
        const sections = existingSections.map((s) => ({
          _local_id: s.id,
          title: s.title || '',
          discount_percent: Number(s.discount_percent) || 0,
        }));

        const items = existingItems.length > 0
          ? existingItems.map((item) => ({
              section_local_id: item.section_id ?? null,
              description: item.description || '',
              quantity: item.quantity || 1,
              unit: item.unit || 'adet',
              unit_price: itemCurrency === 'USD' ? (item.unit_price_usd ?? 0) : (item.unit_price ?? 0),
              material_id: item.material_id ?? null,
              cost: item.cost ?? item.cost_usd ?? null,
              margin_percent: item.margin_percent ?? null,
              product_cost: itemCurrency === 'USD' ? (item.product_cost_usd ?? null) : (item.product_cost ?? null),
              labor_cost: itemCurrency === 'USD' ? (item.labor_cost_usd ?? null) : (item.labor_cost ?? null),
              shipping_cost: itemCurrency === 'USD' ? (item.shipping_cost_usd ?? null) : (item.shipping_cost ?? null),
              material_cost: itemCurrency === 'USD' ? (item.material_cost_usd ?? null) : (item.material_cost ?? null),
              misc_cost: itemCurrency === 'USD' ? (item.misc_cost_usd ?? null) : (item.misc_cost ?? null),
            }))
          : proposalDefaultValues.items;

        const annual_fixed_costs =
          existingAnnualFixed.length > 0
            ? existingAnnualFixed.map((row) => ({
                description: row.description || '',
                quantity: row.quantity ?? 1,
                unit: row.unit || 'adet',
                unit_price: Number(row.unit_price) || 0,
                currency: row.currency || 'TRY',
              }))
            : [];

        reset({
          site_id: proposal.site_id || '',
          title: proposal.title || '',
          scope_of_work: proposal.scope_of_work || '',
          notes: proposal.notes || '',
          currency: proposal.currency || 'USD',
          proposal_date: proposal.proposal_date || '',
          survey_date: proposal.survey_date || '',
          authorized_person: proposal.authorized_person || '',
          installation_date: proposal.installation_date || '',
          customer_representative: proposal.customer_representative || '',
          completion_date: proposal.completion_date || '',
          discount_percent: proposal.discount_percent ?? null,
          has_vat: proposal.vat_rate > 0,
          has_tevkifat: !!proposal.has_tevkifat,
          vat_rate: proposal.vat_rate ?? 0,
          terms_engineering: proposal.terms_engineering || '',
          terms_pricing: proposal.terms_pricing || '',
          terms_warranty: proposal.terms_warranty || '',
          terms_other: proposal.terms_other || '',
          terms_attachments: proposal.terms_attachments || '',
          sections,
          items,
          annual_fixed_costs,
        });

        setSelectedCustomerId(proposal.customer_id ?? '');
        setHasInitialized(true);
        // In edit mode, all steps are accessible
        setCompletedSteps([0, 1]);
        setCurrentStep(0);
      }
    } else {
      if (!hasInitialized) {
        const nextValues = {
          ...proposalDefaultValues,
          site_id: sourceSiteId,
          title: sourceDescription,
          scope_of_work: sourceDescription,
          notes: sourceDescription,
        };

        reset(nextValues);
        setSelectedCustomerId(sourceCustomerId);
      }
      setHasInitialized(true);
    }
  }, [
    isEdit,
    proposal,
    existingItems,
    existingSections,
    existingAnnualFixed,
    isProposalLoading,
    isItemsLoading,
    isSectionsLoading,
    isAnnualFixedLoading,
    reset,
    hasInitialized,
    sourceCustomerId,
    sourceDescription,
    sourceSiteId,
  ]);

  const validateStep = useCallback(async (step) => {
    if (step === 0) {
      return trigger(
        ['site_id', 'title', 'currency', 'proposal_date', 'survey_date', 'vat_rate', 'scope_of_work', 'authorized_person', 'customer_representative'],
        { shouldFocus: true },
      );
    }
    if (step === 1) {
      return trigger(['items', 'annual_fixed_costs'], { shouldFocus: true });
    }
    return true;
  }, [trigger]);

  const goToStep = useCallback(async (targetStep) => {
    // Can always go backward
    if (targetStep < currentStep) {
      setCurrentStep(targetStep);
      return;
    }
    // Validate current step before moving forward
    const valid = await validateStep(currentStep);
    if (valid) {
      setCompletedSteps((prev) => [...new Set([...prev, currentStep])]);
      setCurrentStep(targetStep);
    } else {
      const parsed = proposalSchema.safeParse(getValues());
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        toast.error(formatProposalValidationToast(issue, t));
        if (issue.path[0] === 'annual_fixed_costs') setAnnualFixedOpen(true);
      } else {
        toast.error(t('common:validation.required'));
      }
    }
  }, [currentStep, validateStep, t, getValues]);

  const handleNext = () => goToStep(currentStep + 1);
  const handlePrev = () => goToStep(currentStep - 1);

  const getGrossTotalTry = useCallback((data) => {
    const { grandTotal } = calcProposalTotals(data.items || [], data.discount_percent, data.currency || 'USD');
    const currentVatRate = data.has_vat ? (Number(data.vat_rate) || 0) : 0;
    const { totalWithVat } = calcVatTevkifatSummary(grandTotal, currentVatRate, false, 0, 1);
    const currency = String(data.currency || 'USD').toUpperCase();
    if (currency === 'USD') {
      const fx = Number(latestUsdRate?.effective_rate) || 1;
      return totalWithVat * fx;
    }
    return totalWithVat;
  }, [latestUsdRate?.effective_rate]);

  const needsTevkifatConfirm = useCallback((data) => {
    if (data.has_tevkifat) return false;
    const threshold = Number(financeSettings?.tevkifat_threshold_try) || 12000;
    return getGrossTotalTry(data) >= threshold;
  }, [financeSettings?.tevkifat_threshold_try, getGrossTotalTry]);

  const persistSubmit = async (data, { skipNavigate = false } = {}) => {
    try {
      const { items, sections, annual_fixed_costs: annualFixedCosts, has_vat, has_tevkifat, ...proposalData } = data;
      const proposalPayload = {
        ...proposalData,
        vat_rate: has_vat ? (Number(data.vat_rate) || 0) : 0,
        has_tevkifat: !!has_tevkifat,
      };

      if (isEdit) {
        const updatedProposal = await updateMutation.mutateAsync({ id, ...proposalPayload });
        await updateSectionsAndItemsMutation.mutateAsync({ proposalId: id, sections: sections ?? [], items });
        await updateAnnualFixedMutation.mutateAsync({
          proposalId: id,
          rows: annualFixedCosts ?? [],
        });
        // Reset form with saved values (convert DB values back to form format)
        reset({
          ...data,
          has_vat: updatedProposal.vat_rate > 0,
          has_tevkifat: !!updatedProposal.has_tevkifat,
          vat_rate: updatedProposal.vat_rate ?? 0,
        });
        if (!skipNavigate) {
          justSavedRef.current = true;
          navigate(`/proposals/${id}`);
        }
      } else {
        const newProposal = await createMutation.mutateAsync({
          ...proposalPayload,
          sections: sections ?? [],
          items,
          annual_fixed_costs: annualFixedCosts ?? [],
        });

        if (sourceItemId) {
          await closeOperationsItemMutation.mutateAsync({
            id: sourceItemId,
            outcomeType: 'proposal',
          });
        }

        reset(data);
        if (!skipNavigate) {
          justSavedRef.current = true;
          navigate(`/proposals/${newProposal.id}`);
        }
      }
    } catch (err) {
      toast.error(t('common:errors.saveFailed'));
      throw err;
    }
  };

  const onSubmit = async (data, options = {}) => {
    if (needsTevkifatConfirm(data)) {
      setPendingSubmit({ data, options });
      setShowTevkifatConfirmModal(true);
      return false;
    }
    await persistSubmit(data, options);
    return true;
  };

  const onInvalid = () => {
    const parsed = proposalSchema.safeParse(getValues());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      toast.error(formatProposalValidationToast(issue, t));
      if (issue.path[0] === 'annual_fixed_costs') setAnnualFixedOpen(true);
      setCurrentStep(getStepIndexForProposalIssue(issue));
      return;
    }
    toast.error(t('common:validation.required'));
  };

  const handleSaveDraft = async () => {
    const rawValues = getValues();
    try {
      const { items, sections, annual_fixed_costs: annualFixedCosts, has_vat, has_tevkifat, ...proposalData } = rawValues;
      const draftPayload = {
        ...proposalData,
        vat_rate: has_vat ? (Number(rawValues.vat_rate) || 0) : 0,
        has_tevkifat: !!has_tevkifat,
        status: 'draft',
      };

      if (isEdit) {
        await updateMutation.mutateAsync({ id, ...draftPayload });
        await updateSectionsAndItemsMutation.mutateAsync({ proposalId: id, sections: sections ?? [], items: items ?? [] });
        await updateAnnualFixedMutation.mutateAsync({ proposalId: id, rows: annualFixedCosts ?? [] });
        reset(rawValues);
        toast.success(t('proposals:form.draftSaved'));
      } else {
        const newProposal = await createMutation.mutateAsync({
          ...draftPayload,
          sections: sections ?? [],
          items: items ?? [],
          annual_fixed_costs: annualFixedCosts ?? [],
        });
        reset(rawValues);
        justSavedRef.current = true;
        navigate(`/proposals/${newProposal.id}`);
      }
    } catch {
      toast.error(t('common:errors.saveFailed'));
    }
  };

  const handleSaveAndLeave = async () => {
    let result = null;
    await handleSubmit(
      async (data) => {
        result = await onSubmit(data, { skipNavigate: true });
      },
      () => { result = false; }
    )();
    return result;
  };

  const handleConfirmTevkifatProceed = async () => {
    if (!pendingSubmit) return;
    const queued = pendingSubmit;
    setPendingSubmit(null);
    setShowTevkifatConfirmModal(false);
    await persistSubmit(queued.data, queued.options || {});
  };

  if (isEdit && (isProposalLoading || isItemsLoading || isSectionsLoading || isAnnualFixedLoading)) {
    return <FormSkeleton />;
  }

  return (
    <PageContainer maxWidth="full" padding="default" className="space-y-6 pb-24">
      <PageHeader
        title={isEdit ? t('proposals:form.editTitle') : t('proposals:form.addTitle')}
        breadcrumbs={[
          { label: t('proposals:list.title'), to: '/proposals' },
          ...(isEdit && proposal ? [{ label: proposal.title, to: `/proposals/${id}` }] : []),
          { label: isEdit ? t('proposals:form.editTitle') : t('proposals:form.addTitle') },
        ]}
      />

      {/* Stepper */}
      <ProposalStepper
        currentStep={currentStep}
        onStepClick={goToStep}
        completedSteps={completedSteps}
      />

      <form
        onSubmit={handleSubmit(onSubmit, onInvalid)}
        className="mt-4"
      >
        <div className="space-y-6">

              {/* ===== STEP 0: Genel Bilgiler ===== */}
              {currentStep === 0 && (
                <Card className="p-6 overflow-visible">
                  <div className="flex items-center space-x-2 mb-6">
                    <ClipboardList className="w-5 h-5 text-primary-600" />
                    <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-sm">
                      {t('proposals:form.stepper.general')}
                    </h3>
                  </div>

                  <div className="space-y-6">
                    {/* Two-column grid: Left = Customer/Site selector, Right = Proposal meta */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                      {/* Left Column: Customer & Site Selection */}
                      <div className="min-w-0">
                        <Controller
                          name="site_id"
                          control={control}
                          render={({ field }) => (
                            <CustomerSiteSelector
                              selectedCustomerId={selectedCustomerId}
                              selectedSiteId={field.value || ''}
                              onCustomerChange={(cid) => {
                                setSelectedCustomerId(cid || '');
                                field.onChange('');
                              }}
                              onSiteChange={(sid) => field.onChange(sid || '')}
                              onAddNewCustomer={() => navigate('/customers/new')}
                              onAddNewSite={() => setShowSiteModal(true)}
                              error={errors.site_id?.message}
                            />
                          )}
                        />
                      </div>

                      {/* Right Column: Proposal Meta Information */}
                      <div className="space-y-4">
                        {/* Survey Date + Proposal Date (side by side) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <Input
                            label={t('proposals:form.fields.surveyDate')}
                            type="date"
                            {...register('survey_date')}
                          />
                          <Input
                            label={t('proposals:form.fields.proposalDate')}
                            type="date"
                            {...register('proposal_date')}
                          />
                        </div>

                        {/* Currency (full-width) */}
                        <Select
                          label={t('common:fields.currency')}
                          options={CURRENCIES.map((c) => ({ value: c, label: t(`common:currencies.${c}`) }))}
                          error={errors.currency?.message}
                          {...register('currency')}
                        />

                        {/* KDV + Tevkifat (single row) */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
                          <label className="flex items-center gap-3 p-3 h-12 sm:h-10 rounded-lg bg-neutral-50 dark:bg-neutral-900/50 cursor-pointer select-none border border-neutral-300 dark:border-[#262626] hover:border-primary-500/50 transition-colors shrink-0">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600 text-primary-600 focus:ring-primary-500"
                              {...register('has_vat')}
                            />
                            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                              {t('proposals:form.fields.hasVat')}
                            </span>
                          </label>

                          {hasVat && (
                            <div className="flex-1 w-full sm:w-auto min-w-[120px]">
                              <Input
                                label={t('proposals:form.fields.vatRate')}
                                type="number"
                                min={0}
                                max={100}
                                step="0.01"
                                rightIcon={<span className="text-neutral-400 font-bold">%</span>}
                                error={errors.vat_rate?.message}
                                {...register('vat_rate')}
                              />
                            </div>
                          )}

                          <label className="flex items-center gap-3 p-3 h-12 sm:h-10 rounded-lg bg-neutral-50 dark:bg-neutral-900/50 cursor-pointer select-none border border-neutral-300 dark:border-[#262626] hover:border-primary-500/50 transition-colors shrink-0">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600 text-primary-600 focus:ring-primary-500"
                              {...register('has_tevkifat')}
                            />
                            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                              {t('proposals:form.fields.hasTevkifat')}
                            </span>
                          </label>
                        </div>

                        {/* Authorized Person + Customer Representative (side by side) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <Input
                            label={t('proposals:form.fields.authorizedPerson')}
                            {...register('authorized_person')}
                          />
                          <Input
                            label={t('proposals:form.fields.customerRepresentative')}
                            {...register('customer_representative')}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Bottom: Proposal Title + Scope of Work (full-width) */}
                    <Input
                      label={t('proposals:form.fields.title')}
                      placeholder={t('proposals:form.placeholders.title')}
                      error={errors.title?.message}
                      {...register('title')}
                    />

                    <Textarea
                      label={t('proposals:form.fields.scopeOfWork')}
                      placeholder={t('proposals:form.placeholders.scopeOfWork')}
                      rows={3}
                      error={errors.scope_of_work?.message}
                      {...register('scope_of_work')}
                    />
                  </div>

                  {/* Edit-only: Post-acceptance dates */}
                  {isEdit && (
                    <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-700">
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
                        {t('proposals:form.sections.postAcceptanceDates')}
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                          label={t('proposals:form.fields.installationDate')}
                          type="date"
                          {...register('installation_date')}
                        />
                        <Input
                          label={t('proposals:form.fields.completionDate')}
                          type="date"
                          {...register('completion_date')}
                        />
                      </div>
                    </div>
                  )}
                </Card>
              )}

              {/* ===== STEP 1: Services / Items ===== */}
              {currentStep === 1 && (
                <>
                  {/* Items Editor */}
                  <Card className="p-6">
                    <ProposalItemsEditor
                      control={control}
                      errors={errors}
                      watch={watch}
                      setValue={setValue}
                      currency={selectedCurrency}
                      fields={proposalItemFields}
                      append={appendProposalItem}
                      remove={removeProposalItem}
                      sectionFields={sectionFields}
                      appendSection={appendSection}
                      removeSection={removeSection}
                      tevkifatNumerator={Number(financeSettings?.tevkifat_rate_numerator) || 9}
                      tevkifatDenominator={Number(financeSettings?.tevkifat_rate_denominator) || 10}
                    />
                  </Card>

                  <Card className="p-6">
                    <button
                      type="button"
                      className="flex items-center justify-between w-full text-left"
                      onClick={() => setAnnualFixedOpen((o) => !o)}
                    >
                      <div className="flex items-center gap-2">
                        <CalendarClock className="w-5 h-5 text-primary-600 shrink-0" />
                        <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-sm">
                          {t('proposals:annualFixed.cardTitle')}
                        </h3>
                      </div>
                      {annualFixedOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                    {annualFixedOpen && (
                      <div className="mt-4">
                        <ProposalAnnualFixedCostsEditor
                          control={control}
                          register={register}
                          errors={errors}
                          watch={watch}
                          fields={annualFixedFields}
                          append={appendAnnualFixed}
                          remove={removeAnnualFixed}
                        />
                      </div>
                    )}
                  </Card>

                  {/* Terms (collapsible) */}
                  <Card className="p-6">
                    <button
                      type="button"
                      className="flex items-center justify-between w-full text-left"
                      onClick={() => setTermsOpen((o) => !o)}
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-primary-600 shrink-0" />
                        <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-sm">
                          {t('proposals:form.sections.terms')}
                        </h3>
                      </div>
                      {termsOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                    {termsOpen && (
                      <div className="mt-4 space-y-4">
                        <Textarea
                          label={t('proposals:form.fields.termsEngineering')}
                          rows={3}
                          {...register('terms_engineering')}
                        />
                        <Textarea
                          label={t('proposals:form.fields.termsPricing')}
                          rows={3}
                          {...register('terms_pricing')}
                        />
                        <Textarea
                          label={t('proposals:form.fields.termsWarranty')}
                          rows={3}
                          {...register('terms_warranty')}
                        />
                        <Textarea
                          label={t('proposals:form.fields.termsOther')}
                          rows={3}
                          {...register('terms_other')}
                        />
                        <Textarea
                          label={t('proposals:form.fields.termsAttachments')}
                          rows={2}
                          {...register('terms_attachments')}
                        />
                      </div>
                    )}
                  </Card>

                  {/* Notes */}
                  <Card
                    header={
                      <div className="flex items-center space-x-2">
                        <StickyNote className="w-5 h-5 text-warning-600" />
                        <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-sm">
                          {t('proposals:form.sections.notes')}
                        </h3>
                      </div>
                    }
                    className="p-6"
                  >
                    <Textarea
                      placeholder={t('proposals:form.placeholders.notes')}
                      rows={3}
                      error={errors.notes?.message}
                      {...register('notes')}
                    />
                  </Card>
                </>
              )}

              {/* ===== STEP 2: Review ===== */}
              {currentStep === 2 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ProposalLivePreview
                    watchedValues={watchedValues}
                    customerCompanyName={selectedCustomer?.company_name ?? ''}
                    tevkifatNumerator={Number(financeSettings?.tevkifat_rate_numerator) || 9}
                    tevkifatDenominator={Number(financeSettings?.tevkifat_rate_denominator) || 10}
                  />
                  <Card className="p-6 space-y-4">
                    <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-sm">
                      {t('proposals:form.sections.notes')}
                    </h3>
                    <div className="space-y-3 text-sm text-neutral-600 dark:text-neutral-400">
                      {watchedValues.scope_of_work && (
                        <div>
                          <p className="font-medium text-neutral-800 dark:text-neutral-200 mb-1">
                            {t('proposals:form.fields.scopeOfWork')}
                          </p>
                          <p className="whitespace-pre-wrap">{watchedValues.scope_of_work}</p>
                        </div>
                      )}
                      {watchedValues.notes && (
                        <div>
                          <p className="font-medium text-neutral-800 dark:text-neutral-200 mb-1">
                            {t('proposals:detail.notes')}
                          </p>
                          <p className="whitespace-pre-wrap">{watchedValues.notes}</p>
                        </div>
                      )}
                    </div>
                  </Card>
                </div>
              )}
        </div>

        {/* Step Navigation + Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-white/80 dark:bg-[#171717]/80 backdrop-blur-md border-t border-neutral-200 dark:border-[#262626] z-50 flex gap-3 lg:static lg:bg-transparent lg:border-none lg:p-0 lg:pb-0 lg:justify-between lg:mt-6">
          <div className="flex gap-3 flex-1">
            {currentStep > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={handlePrev}
                leftIcon={<ArrowLeft className="w-4 h-4" />}
                className="flex-1 lg:flex-none"
              >
                {tCommon('actions.back')}
              </Button>
            )}
            {currentStep === 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(-1)}
                className="flex-1 lg:flex-none"
                leftIcon={<X className="w-4 h-4" />}
              >
                {tCommon('actions.cancel')}
              </Button>
            )}
          </div>
          <div className="flex gap-3 flex-1 justify-end flex-wrap">
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveDraft}
              loading={
                createMutation.isPending ||
                updateMutation.isPending
              }
              leftIcon={<Save className="w-4 h-4" />}
              className="flex-1 lg:flex-none"
            >
              {t('proposals:form.saveDraft')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowPreviewModal(true)}
              leftIcon={<Eye className="w-4 h-4" />}
              className="flex-1 lg:flex-none"
            >
              {t('proposals:form.preview.openButton')}
            </Button>
            {currentStep < 2 && (
              <Button
                type="button"
                variant="primary"
                onClick={handleNext}
                rightIcon={<ArrowRight className="w-4 h-4" />}
                className="flex-1 lg:flex-none"
              >
                {t(`proposals:form.stepper.${currentStep === 0 ? 'services' : 'review'}`)}
              </Button>
            )}
            {currentStep === 2 && (
              <Button
                type="submit"
                loading={
                  isSubmitting ||
                  createMutation.isPending ||
                  updateMutation.isPending ||
                  updateSectionsAndItemsMutation.isPending ||
                  updateAnnualFixedMutation.isPending
                }
                className="flex-1 lg:flex-none"
                leftIcon={<Save className="w-4 h-4" />}
              >
                {isEdit ? tCommon('actions.save') : tCommon('actions.create')}
              </Button>
            )}
          </div>
        </div>
      </form>

      <SiteFormModal
        open={showSiteModal}
        onClose={() => setShowSiteModal(false)}
        customerId={selectedCustomerId}
        site={null}
      />

      <UnsavedChangesModal blocker={blocker} onSave={handleSaveAndLeave} />

      <Modal
        open={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        title={t('proposals:form.preview.title')}
        size="xl"
      >
        <ProposalLivePreview
          watchedValues={watchedValues}
          customerCompanyName={selectedCustomer?.company_name ?? ''}
          tevkifatNumerator={Number(financeSettings?.tevkifat_rate_numerator) || 9}
          tevkifatDenominator={Number(financeSettings?.tevkifat_rate_denominator) || 10}
        />
      </Modal>

      <Modal
        open={showTevkifatConfirmModal}
        onClose={() => {
          setShowTevkifatConfirmModal(false);
          setPendingSubmit(null);
        }}
        title={t('proposals:form.tevkifatConfirm.title')}
        footer={(
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowTevkifatConfirmModal(false);
                setPendingSubmit(null);
              }}
            >
              {tCommon('actions.cancel')}
            </Button>
            <Button type="button" onClick={handleConfirmTevkifatProceed}>
              {t('proposals:form.tevkifatConfirm.confirm')}
            </Button>
          </>
        )}
      >
        <p>{t('proposals:form.tevkifatConfirm.message')}</p>
      </Modal>
    </PageContainer>
  );
}
