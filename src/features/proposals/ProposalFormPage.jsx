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
  CalendarClock,
  Eye,
  Pencil,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageContainer, PageHeader } from '../../components/layout';
import {
  Button,
  Input,
  Select,
  Textarea,
  Card,
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
} from './hooks';
import { useFinanceSettings, useLatestRate } from '../finance/hooks';
import { useCustomer, customerKeys } from '../customers/hooks';
import { updateCustomer } from '../customers/api';
import { useCloseOperationsItem } from '../operations/hooks';
import { CustomerSiteSelector } from '../workOrders/CustomerSiteSelector';
import { SiteFormModal } from '../customerSites/SiteFormModal';
import { ProposalItemsEditor } from './components/ProposalItemsEditor';
import { ProposalAnnualFixedCostsEditor } from './components/ProposalAnnualFixedCostsEditor';
import { ProposalLivePreview } from './components/ProposalLivePreview';
import { calcProposalTotals, calcVatTevkifatSummary } from '../../lib/proposalCalc';
import { cn } from '../../lib/utils';

const TERMS_FIELD_KEYS = [
  'terms_engineering',
  'terms_pricing',
  'terms_warranty',
  'terms_other',
  'terms_attachments',
];

const TERMS_FIELD_LABEL_KEYS = {
  terms_engineering: 'termsEngineering',
  terms_pricing: 'termsPricing',
  terms_warranty: 'termsWarranty',
  terms_other: 'termsOther',
  terms_attachments: 'termsAttachments',
};

const TERMS_FIELD_ROWS = {
  terms_engineering: 8,
  terms_pricing: 8,
  terms_warranty: 4,
  terms_other: 5,
  terms_attachments: 2,
};

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
  const [financeSettingsOpen, setFinanceSettingsOpen] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [showTevkifatConfirmModal, setShowTevkifatConfirmModal] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(null);

  const { data: proposal, isLoading: isProposalLoading } = useProposal(id);
  const { data: existingItems = [], isLoading: isItemsLoading } = useProposalItems(id);
  const { data: existingSections = [], isLoading: isSectionsLoading } = useProposalSections(id);
  const { data: existingAnnualFixed = [], isLoading: isAnnualFixedLoading } = useProposalAnnualFixedCosts(id);
  const { data: selectedCustomer } = useCustomer(selectedCustomerId);
  const queryClient = useQueryClient();
  const [editCustomerModalOpen, setEditCustomerModalOpen] = useState(false);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const { data: financeSettings } = useFinanceSettings();
  const { data: latestUsdRate } = useLatestRate('USD');
  const createMutation = useCreateProposal();
  const updateMutation = useUpdateProposal();
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
  const hasTevkifat = watch('has_tevkifat');
  const vatRate = watch('vat_rate');
  const watchedValues = watch();

  useEffect(() => {
    if (hasVat && (vatRate === 0 || vatRate === '0' || !vatRate)) {
      setValue('vat_rate', 20);
    }
  }, [hasVat, vatRate, setValue]);

  useEffect(() => {
    if (isEdit) {
      if (!hasInitialized && proposal && !isProposalLoading && !isItemsLoading && !isSectionsLoading && !isAnnualFixedLoading) {
        const itemCurrency = proposal.currency === 'USD' ? 'USD' : 'TRY';

        const sections = existingSections.map((section) => ({
          _local_id: section.id,
          title: section.title || '',
          discount_percent: Number(section.discount_percent) || 0,
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

        const annualFixedCosts = existingAnnualFixed.length > 0
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
          annual_fixed_costs: annualFixedCosts,
        });
        setSelectedCustomerId(proposal.customer_id ?? '');
        setHasInitialized(true);
      }
    } else {
      if (!hasInitialized) {
        reset({
          ...proposalDefaultValues,
          site_id: sourceSiteId,
          title: sourceDescription,
          scope_of_work: sourceDescription,
          notes: sourceDescription,
        });
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
        const updatedProposal = await updateMutation.mutateAsync({
          id,
          ...proposalPayload,
          sections: sections ?? [],
          items,
          annual_fixed_costs: annualFixedCosts ?? [],
        });
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
        await updateMutation.mutateAsync({
          id,
          ...draftPayload,
          sections: sections ?? [],
          items: items ?? [],
          annual_fixed_costs: annualFixedCosts ?? [],
        });
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
      () => { result = false; },
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

  const handleEditCustomerOpen = () => {
    if (!selectedCustomer) return;
    setEditCustomerName(selectedCustomer.company_name || '');
    setEditCustomerModalOpen(true);
  };

  const handleEditCustomerSave = async () => {
    if (!selectedCustomer || !editCustomerName.trim()) return;
    setIsSavingCustomer(true);
    try {
      await updateCustomer({ id: selectedCustomer.id, company_name: editCustomerName.trim() });
      toast.success('Müşteri adı güncellendi');
      setEditCustomerModalOpen(false);
      queryClient.invalidateQueries({ queryKey: customerKeys.detail(selectedCustomer.id) });
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
    } catch {
      toast.error('Güncelleme başarısız');
    } finally {
      setIsSavingCustomer(false);
    }
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

      <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="mt-4">
        <div className="space-y-6">
          <Card className="overflow-visible border-neutral-200/80 bg-white/95 shadow-sm dark:border-[#262626] dark:bg-[#141414]">
            <div className="border-b border-neutral-200/80 px-6 py-5 dark:border-[#262626]">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary-600" />
                <h3 className="font-semibold text-neutral-950 dark:text-neutral-50">
                  {t('proposals:form.stepper.general')}
                </h3>
              </div>
            </div>

            <div className="px-6 py-6 space-y-6">
              <section className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-5 dark:border-[#262626] dark:bg-[#171717]">
                <div className="flex items-start justify-between gap-3 mb-5">
                  <div>
                    <h4 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">
                      {t('proposals:form.sections.customerSite')}
                    </h4>
                    <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                      {t('proposals:form.sectionHelp.customerSite')}
                    </p>
                  </div>
                  {selectedCustomer && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      leftIcon={<Pencil className="w-3.5 h-3.5" />}
                      onClick={handleEditCustomerOpen}
                      className="shrink-0"
                    >
                      {t('proposals:form.actions.editCustomerName')}
                    </Button>
                  )}
                </div>

                <Controller
                  name="site_id"
                  control={control}
                  render={({ field }) => (
                    <CustomerSiteSelector
                      compact
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
              </section>

              <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-[#262626] dark:bg-[#141414]">
                <div className="mb-5">
                  <h4 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">
                    {t('proposals:form.sections.proposalMeta')}
                  </h4>
                  <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                    {t('proposals:form.sectionHelp.proposalMeta')}
                  </p>
                </div>

                <div className="space-y-5">
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
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
                    <Select
                      label={t('common:fields.currency')}
                      options={CURRENCIES.map((c) => ({ value: c, label: t(`common:currencies.${c}`) }))}
                      error={errors.currency?.message}
                      {...register('currency')}
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Input
                      label={t('proposals:form.fields.authorizedPerson')}
                      {...register('authorized_person')}
                    />
                    <Input
                      label={t('proposals:form.fields.customerRepresentative')}
                      {...register('customer_representative')}
                    />
                  </div>

                  {isEdit && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                  )}

                  <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 dark:border-[#262626] dark:bg-[#171717]">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                      onClick={() => setFinanceSettingsOpen((open) => !open)}
                    >
                      <div>
                        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          {t('proposals:form.sections.financialSettings')}
                        </p>
                        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                          {t('proposals:form.sectionHelp.financialSettings')}
                        </p>
                      </div>
                      {financeSettingsOpen ? (
                        <ChevronUp className="w-4 h-4 text-neutral-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-neutral-500" />
                      )}
                    </button>

                    {financeSettingsOpen && (
                      <fieldset
                        disabled
                        className="border-t border-neutral-200 px-4 py-4 dark:border-[#262626]"
                      >
                        <div className="space-y-4 opacity-60">
                          <div className="flex flex-wrap items-center gap-3">
                            <label className="flex items-center gap-3 rounded-lg border border-neutral-300 bg-white px-3 py-2.5 dark:border-[#303030] dark:bg-[#171717]">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600"
                                checked={!!hasVat}
                                readOnly
                              />
                              <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                {t('proposals:form.fields.hasVat')}
                              </span>
                            </label>

                            <label className="flex items-center gap-3 rounded-lg border border-neutral-300 bg-white px-3 py-2.5 dark:border-[#303030] dark:bg-[#171717]">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600"
                                checked={!!hasTevkifat}
                                readOnly
                              />
                              <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                {t('proposals:form.fields.hasTevkifat')}
                              </span>
                            </label>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <Input
                              label={t('proposals:form.fields.vatRate')}
                              type="number"
                              value={hasVat ? (vatRate ?? 0) : 0}
                              readOnly
                              disabled
                              rightIcon={<span className="text-neutral-400 font-bold">%</span>}
                            />
                          </div>
                        </div>
                      </fieldset>
                    )}
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-[#262626] dark:bg-[#141414]">
                <div className="mb-5">
                  <h4 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">
                    {t('proposals:form.sections.proposalIdentity')}
                  </h4>
                  <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                    {t('proposals:form.sectionHelp.proposalIdentity')}
                  </p>
                </div>

                <div className="space-y-4">
                  <Input
                    label={t('proposals:form.fields.title')}
                    placeholder={t('proposals:form.placeholders.title')}
                    error={errors.title?.message}
                    {...register('title')}
                  />

                  <Textarea
                    label={t('proposals:form.fields.scopeOfWork')}
                    placeholder={t('proposals:form.placeholders.scopeOfWork')}
                    rows={5}
                    error={errors.scope_of_work?.message}
                    {...register('scope_of_work')}
                  />
                </div>
              </section>
            </div>
          </Card>

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
              onClick={() => setAnnualFixedOpen((open) => !open)}
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

          <Card className="p-6">
            <button
              type="button"
              className="flex items-center justify-between w-full text-left"
              onClick={() => setTermsOpen((open) => !open)}
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
              <div className="mt-4 space-y-6">
                {TERMS_FIELD_KEYS.map((fieldKey) => (
                  <div key={fieldKey}>
                    <p className="font-bold text-neutral-900 dark:text-neutral-100 text-sm mb-2">
                      {t(`proposals:form.fields.${TERMS_FIELD_LABEL_KEYS[fieldKey]}`)}
                    </p>
                    <Textarea
                      rows={TERMS_FIELD_ROWS[fieldKey]}
                      {...register(fieldKey)}
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card
            header={(
              <div className="flex items-center space-x-2">
                <StickyNote className="w-5 h-5 text-warning-600" />
                <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-sm">
                  {t('proposals:form.sections.notes')}
                </h3>
              </div>
            )}
            className="p-6"
          >
            <Textarea
              placeholder={t('proposals:form.placeholders.notes')}
              rows={3}
              error={errors.notes?.message}
              {...register('notes')}
            />
          </Card>
        </div>

        <div className="fixed bottom-0 left-0 right-0 px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-white/80 dark:bg-[#171717]/80 backdrop-blur-md border-t border-neutral-200 dark:border-[#262626] z-50 flex gap-3 lg:static lg:bg-transparent lg:border-none lg:p-0 lg:pb-0 lg:justify-between lg:mt-6">
          <div className="flex gap-3 flex-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(-1)}
              className="flex-1 lg:flex-none"
              leftIcon={<X className="w-4 h-4" />}
            >
              {tCommon('actions.cancel')}
            </Button>
          </div>
          <div className="flex gap-3 flex-1 justify-end flex-wrap">
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveDraft}
              loading={createMutation.isPending || updateMutation.isPending}
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
            <Button
              type="submit"
              loading={isSubmitting || createMutation.isPending || updateMutation.isPending}
              className="flex-1 lg:flex-none"
              leftIcon={<Save className="w-4 h-4" />}
            >
              {isEdit ? tCommon('actions.save') : tCommon('actions.create')}
            </Button>
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
        open={editCustomerModalOpen}
        onClose={() => setEditCustomerModalOpen(false)}
        title="Müşteri Adını Düzenle"
        size="sm"
        footer={(
          <div className="flex gap-3 w-full">
            <Button variant="ghost" onClick={() => setEditCustomerModalOpen(false)} className="flex-1">
              İptal
            </Button>
            <Button onClick={handleEditCustomerSave} loading={isSavingCustomer} className="flex-1">
              Kaydet
            </Button>
          </div>
        )}
      >
        <div className="space-y-4">
          <p className="text-sm text-neutral-500">
            Müşterinin görünen adını düzenleyin. Bu değişiklik customers tablosuna kaydedilir.
          </p>
          <Input
            value={editCustomerName}
            onChange={(e) => setEditCustomerName(e.target.value)}
            placeholder="Müşteri adı"
            autoFocus
          />
        </div>
      </Modal>

      <Modal
        open={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        title={t('proposals:form.preview.title')}
        size="full"
        className={cn(
          'max-w-full min-h-0',
          'h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-0.5rem)] max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-0.5rem)]',
          'sm:h-[calc(100dvh-3rem)] sm:max-h-[calc(100dvh-3rem)]',
          'md:h-[calc(100dvh-3rem)] md:max-h-[calc(100dvh-3rem)]',
        )}
        contentClassName="flex flex-col overflow-hidden !min-h-0 p-3 sm:p-4 md:p-5"
      >
        <ProposalLivePreview
          variant="modal"
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
