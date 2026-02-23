import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save, X, FileText, StickyNote, Image, ChevronDown, ChevronUp } from 'lucide-react';
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
import { CustomerSiteSelector } from '../workOrders/CustomerSiteSelector';
import { SiteFormModal } from '../customerSites/SiteFormModal';
import { ProposalItemsEditor } from './components/ProposalItemsEditor';

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

  const { data: proposal, isLoading: isProposalLoading } = useProposal(id);
  const { data: existingItems = [], isLoading: isItemsLoading } = useProposalItems(id);
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
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    resolver: zodResolver(proposalSchema),
    defaultValues: proposalDefaultValues,
  });

  const blocker = useUnsavedChanges({ isDirty: hasInitialized && isDirty });

  const selectedCurrency = watch('currency') ?? 'USD';

  // Populate form when editing — only after both proposal and items have loaded
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
          company_name: proposal.company_name || '',
          proposal_date: proposal.proposal_date || '',
          survey_date: proposal.survey_date || '',
          authorized_person: proposal.authorized_person || '',
          installation_date: proposal.installation_date || '',
          customer_representative: proposal.customer_representative || '',
          completion_date: proposal.completion_date || '',
          discount_percent: proposal.discount_percent ?? null,
          terms_engineering: proposal.terms_engineering || '',
          terms_pricing: proposal.terms_pricing || '',
          terms_warranty: proposal.terms_warranty || '',
          terms_other: proposal.terms_other || '',
          terms_attachments: proposal.terms_attachments || '',
          items,
        });

        setSelectedCustomerId(proposal.customer_id ?? '');
        setHasInitialized(true);
      }
    } else {
      setHasInitialized(true);
    }
  }, [isEdit, proposal, existingItems, isProposalLoading, isItemsLoading, reset]);

  const onSubmit = async (data, { skipNavigate = false } = {}) => {
    try {
      const { items, ...proposalData } = data;

      if (isEdit) {
        await updateMutation.mutateAsync({ id, ...proposalData });
        await updateItemsMutation.mutateAsync({ proposalId: id, items });
        reset(data); // mark form clean before navigation so blocker doesn't fire
        if (!skipNavigate) navigate(`/proposals/${id}`);
      } else {
        const newProposal = await createMutation.mutateAsync({ ...proposalData, items });
        reset(data); // mark form clean before navigation so blocker doesn't fire
        if (!skipNavigate) navigate(`/proposals/${newProposal.id}`);
      }
    } catch (err) {
      toast.error(err?.message || t('common:error.title'));
      throw err; // re-throw so onSave can detect network failure
    }
  };

  const onInvalid = (formErrors) => {
    if (formErrors.site_id) {
      toast.error(t('errors:validation.required'));
    } else if (formErrors.items) {
      toast.error(t('common:validation.required'));
    }
  };

  const handleSaveAndLeave = async () => {
    let result = null; // null = network error (keep modal open)
    await handleSubmit(
      async (data) => {
        await onSubmit(data, { skipNavigate: true });
        result = true; // success
      },
      () => { result = false; } // validation failed (close modal, show errors)
    )();
    return result;
  };

  if (isEdit && (isProposalLoading || isItemsLoading)) {
    return <FormSkeleton />;
  }

  return (
    <PageContainer maxWidth="xl" padding="default" className="space-y-6 pb-24">
      <PageHeader
        title={isEdit ? t('proposals:form.editTitle') : t('proposals:form.addTitle')}
        breadcrumbs={[
          { label: t('proposals:list.title'), to: '/proposals' },
          ...(isEdit && proposal ? [{ label: proposal.title, to: `/proposals/${id}` }] : []),
          { label: isEdit ? t('proposals:form.editTitle') : t('proposals:form.addTitle') },
        ]}
      />

      <form
        onSubmit={handleSubmit(onSubmit, onInvalid)}
        className="space-y-8 mt-6"
      >
        {/* 1. Customer & Site Selection */}
        <Card className="p-1 overflow-visible">
          <Controller
            name="site_id"
            control={control}
            render={({ field }) => (
              <CustomerSiteSelector
                selectedCustomerId={selectedCustomerId}
                selectedSiteId={field.value || ''}
                onCustomerChange={(cid) => setSelectedCustomerId(cid)}
                onSiteChange={(sid) => field.onChange(sid || '')}
                onAddNewCustomer={() => navigate('/customers/new')}
                onAddNewSite={() => setShowSiteModal(true)}
                error={errors.site_id?.message}
              />
            )}
          />
        </Card>

        {/* 2. Proposal Info */}
        <Card
          header={
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-primary-600" />
              <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-sm">
                {t('proposals:form.addTitle')}
              </h3>
            </div>
          }
          className="p-6"
        >
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label={t('proposals:form.fields.title')}
                placeholder={t('proposals:form.placeholders.title')}
                error={errors.title?.message}
                {...register('title')}
              />
              <Select
                label={t('common:fields.currency')}
                options={CURRENCIES.map((c) => ({ value: c, label: t(`common:currencies.${c}`) }))}
                error={errors.currency?.message}
                {...register('currency')}
              />
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
            </div>

            <Textarea
              label={t('proposals:form.fields.scopeOfWork')}
              placeholder={t('proposals:form.placeholders.scopeOfWork')}
              rows={4}
              error={errors.scope_of_work?.message}
              {...register('scope_of_work')}
            />
          </div>
        </Card>

        {/* 2b. PDF header fields + post-acceptance dates — edit only */}
        {isEdit && (
          <Card className="p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Image className="w-5 h-5 text-primary-600" />
              <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-sm">
                {t('proposals:form.sections.logoAndHeader')}
              </h3>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label={t('proposals:form.fields.companyName')}
                  placeholder={t('proposals:form.placeholders.companyName')}
                  {...register('company_name')}
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
              <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4">
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
            </div>
          </Card>
        )}

        {/* 3. Items Editor */}
        <Card className="p-6">
          <ProposalItemsEditor
            control={control}
            register={register}
            errors={errors}
            watch={watch}
            setValue={setValue}
            currency={selectedCurrency}
          />
        </Card>

        {/* 4. Terms (collapsible) */}
        <Card className="p-6">
          <button
            type="button"
            className="flex items-center justify-between w-full text-left"
            onClick={() => setTermsOpen((o) => !o)}
          >
            <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-sm">
              {t('proposals:form.sections.terms')}
            </h3>
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

        {/* 5. Notes */}
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

        {/* Floating Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-[#171717]/80 backdrop-blur-md border-t border-neutral-200 dark:border-[#262626] z-50 flex gap-3 lg:static lg:bg-transparent lg:border-none lg:p-0 lg:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(-1)}
            className="flex-1 lg:flex-none"
            leftIcon={<X className="w-4 h-4" />}
          >
            {tCommon('actions.cancel')}
          </Button>
          <Button
            type="submit"
            loading={isSubmitting || createMutation.isPending || updateMutation.isPending || updateItemsMutation.isPending}
            className="flex-1 lg:flex-none"
            leftIcon={<Save className="w-4 h-4" />}
          >
            {isEdit ? tCommon('actions.save') : tCommon('actions.create')}
          </Button>
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
