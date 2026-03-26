import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
} from '../../components/ui';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { proposalSchema, proposalDefaultValues, CURRENCIES } from './schema';
import {
  useProposal,
  useProposalItems,
  useCreateProposal,
  useUpdateProposal,
  useUpdateProposalItems,
} from './hooks';
import { useCustomer } from '../customers/hooks';
import { CustomerSiteSelector } from '../workOrders/CustomerSiteSelector';
import { SiteFormModal } from '../customerSites/SiteFormModal';
import { ProposalItemsEditor } from './components/ProposalItemsEditor';
import { ProposalStepper } from './components/ProposalStepper';
import { ProposalLivePreview } from './components/ProposalLivePreview';

export function ProposalFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation(['proposals', 'common', 'workOrders']);
  const { t: tCommon } = useTranslation('common');
  const isEdit = !!id;

  const [showSiteModal, setShowSiteModal] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [termsOpen, setTermsOpen] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);

  const { data: proposal, isLoading: isProposalLoading } = useProposal(id);
  const { data: existingItems = [], isLoading: isItemsLoading } = useProposalItems(id);
  const { data: selectedCustomer } = useCustomer(selectedCustomerId);
  const createMutation = useCreateProposal();
  const updateMutation = useUpdateProposal();
  const updateItemsMutation = useUpdateProposalItems();

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    trigger,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    resolver: zodResolver(proposalSchema),
    defaultValues: proposalDefaultValues,
  });

  const {
    fields: proposalItemFields,
    append: appendProposalItem,
    remove: removeProposalItem,
  } = useFieldArray({ control, name: 'items' });

  const justSavedRef = useRef(false);
  const blocker = useUnsavedChanges({
    isDirty: hasInitialized && isDirty,
    skipBlockingRef: justSavedRef,
  });

  const selectedCurrency = watch('currency') ?? 'USD';

  // Watch all values for live preview
  const watchedValues = watch();

  // Populate form when editing
  useEffect(() => {
    if (isEdit) {
      if (proposal && !isProposalLoading && !isItemsLoading) {
        const items = existingItems.length > 0
          ? existingItems.map((item) => ({
              description: item.description || '',
              quantity: item.quantity || 1,
              unit: item.unit || 'adet',
              unit_price: item.unit_price ?? item.unit_price_usd ?? 0,
              material_id: item.material_id ?? null,
              cost: item.cost ?? item.cost_usd ?? null,
              margin_percent: item.margin_percent ?? null,
              product_cost: item.product_cost ?? item.product_cost_usd ?? null,
              labor_cost: item.labor_cost ?? item.labor_cost_usd ?? null,
              shipping_cost: item.shipping_cost ?? item.shipping_cost_usd ?? null,
              material_cost: item.material_cost ?? item.material_cost_usd ?? null,
              misc_cost: item.misc_cost ?? item.misc_cost_usd ?? null,
            }))
          : proposalDefaultValues.items;

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
          vat_rate: proposal.vat_rate ?? 0,
          terms_engineering: proposal.terms_engineering || '',
          terms_pricing: proposal.terms_pricing || '',
          terms_warranty: proposal.terms_warranty || '',
          terms_other: proposal.terms_other || '',
          terms_attachments: proposal.terms_attachments || '',
          items,
        });

        setSelectedCustomerId(proposal.customer_id ?? '');
        setHasInitialized(true);
        // In edit mode, all steps are accessible
        setCompletedSteps([0, 1]);
        setCurrentStep(0);
      }
    } else {
      setHasInitialized(true);
    }
  }, [isEdit, proposal, existingItems, isProposalLoading, isItemsLoading, reset]);

  const validateStep = useCallback(async (step) => {
    if (step === 0) {
      const valid = await trigger(['site_id', 'title', 'currency', 'proposal_date', 'survey_date', 'vat_rate', 'scope_of_work', 'authorized_person', 'customer_representative']);
      return valid;
    }
    if (step === 1) {
      const valid = await trigger(['items', 'discount_percent']);
      return valid;
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
      toast.error(t('common:validation.required'));
    }
  }, [currentStep, validateStep, t]);

  const handleNext = () => goToStep(currentStep + 1);
  const handlePrev = () => goToStep(currentStep - 1);

  const onSubmit = async (data, { skipNavigate = false } = {}) => {
    try {
      const { items, ...proposalData } = data;
      const proposalPayload = { ...proposalData, company_name: null };

      if (isEdit) {
        await updateMutation.mutateAsync({ id, ...proposalPayload });
        await updateItemsMutation.mutateAsync({ proposalId: id, items });
        reset(data);
        if (!skipNavigate) {
          justSavedRef.current = true;
          navigate(`/proposals/${id}`);
        }
      } else {
        const newProposal = await createMutation.mutateAsync({ ...proposalPayload, items });
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

  const onInvalid = (formErrors) => {
    if (formErrors.site_id) {
      toast.error(t('errors:validation.required'));
      setCurrentStep(0);
    } else if (formErrors.items) {
      toast.error(t('common:validation.required'));
      setCurrentStep(1);
    }
  };

  const handleSaveAndLeave = async () => {
    let result = null;
    await handleSubmit(
      async (data) => {
        await onSubmit(data, { skipNavigate: true });
        result = true;
      },
      () => { result = false; }
    )();
    return result;
  };

  if (isEdit && (isProposalLoading || isItemsLoading)) {
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
        {/* 12-col grid: form (7) + preview (5) — preview hidden on step 2 (review is full-width) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left column — Form */}
          <div className={currentStep === 2 ? 'lg:col-span-12' : 'lg:col-span-7'}>
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

                  {/* Single card: left = customer/site + title; right = proposal meta (2-col subgrid) */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-4 min-w-0">
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
                      <Input
                        label={t('proposals:form.fields.title')}
                        placeholder={t('proposals:form.placeholders.title')}
                        error={errors.title?.message}
                        {...register('title')}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label={t('proposals:form.fields.proposalDate')}
                        type="date"
                        {...register('proposal_date')}
                      />
                      <Input
                        label={t('proposals:form.fields.surveyDate')}
                        type="date"
                        {...register('survey_date')}
                      />
                      <Select
                        label={t('common:fields.currency')}
                        options={CURRENCIES.map((c) => ({ value: c, label: t(`common:currencies.${c}`) }))}
                        error={errors.currency?.message}
                        {...register('currency')}
                      />
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

                  {/* Full-width: Scope of Work */}
                  <div className="mt-6">
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
                      register={register}
                      errors={errors}
                      watch={watch}
                      setValue={setValue}
                      currency={selectedCurrency}
                      fields={proposalItemFields}
                      append={appendProposalItem}
                      remove={removeProposalItem}
                    />
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
          </div>

          {/* Right column — Live Preview (steps 0 & 1 only, desktop) */}
          {currentStep < 2 && (
            <div className="hidden lg:block lg:col-span-5">
              <ProposalLivePreview
                watchedValues={watchedValues}
                customerCompanyName={selectedCustomer?.company_name ?? ''}
              />
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
          <div className="flex gap-3 flex-1 justify-end">
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
                loading={isSubmitting || createMutation.isPending || updateMutation.isPending || updateItemsMutation.isPending}
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
    </PageContainer>
  );
}
