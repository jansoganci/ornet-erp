import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save, X, Calendar, Clock, FileText, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { PageContainer, PageHeader } from '../../components/layout';
import { 
  Button, 
  Input, 
  Select, 
  Card, 
  Spinner,
  Textarea,
  FormSkeleton,
  Modal,
} from '../../components/ui';
import { workOrderSchema, workOrderDefaultValues, WORK_TYPES, normalizeWorkOrderItemUnit } from './schema';
import { useWorkOrder, useCreateWorkOrder, useUpdateWorkOrder } from './hooks';
import { CustomerSiteSelector } from './CustomerSiteSelector';
import { WorkerSelector } from './WorkerSelector';
import { WorkOrderFormHero } from './components/WorkOrderFormHero';
import { WorkOrderItemsEditor } from './components/WorkOrderItemsEditor';
import { AccountNoWarning } from './AccountNoWarning';
import { SiteFormModal } from '../customerSites/SiteFormModal';
import { useSite, useSitesByCustomer } from '../customerSites/hooks';
import { useLinkWorkOrder } from '../proposals/hooks';
import { updateOperationsItem } from '../operations/api';
import { useFinanceSettings, useLatestRate } from '../finance/hooks';
import { resolveProposalItemUnitPrice, calcVatTevkifatSummary } from '../../lib/proposalCalc';
import { toast } from 'sonner';

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

export function WorkOrderFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation(['workOrders', 'common', 'errors']);
  const { t: tCommon } = useTranslation('common');
  const isEdit = !!id;

  const [showSiteModal, setShowSiteModal] = useState(false);
  /** 'new-site' = always create; 'account-no' = edit current site if selected, else create for customer */
  const [siteModalIntent, setSiteModalIntent] = useState(null);
  const [showTevkifatConfirmModal, setShowTevkifatConfirmModal] = useState(false);
  const [pendingSubmitData, setPendingSubmitData] = useState(null);

  const { data: workOrder, isLoading: isWorkOrderLoading } = useWorkOrder(id);
  const { data: financeSettings } = useFinanceSettings();
  const { data: latestUsdRate } = useLatestRate('USD');
  const createMutation = useCreateWorkOrder();
  const updateMutation = useUpdateWorkOrder();
  const linkWorkOrderMutation = useLinkWorkOrder();

  const prefilledCustomerId = searchParams.get('customerId') || '';
  const prefilledSiteId = searchParams.get('siteId') || '';
  const prefilledDate = searchParams.get('date') || '';
  const prefilledTime = searchParams.get('time') || '';
  const prefilledProposalId = searchParams.get('proposalId') || '';
  const prefilledDescription = searchParams.get('description') || '';
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

  const selectedSiteId = watch('site_id');
  const workType = watch('work_type');
  const hasVat = watch('has_vat');
  const vatRate = watch('vat_rate');

  // Logic: When has_vat is checked, default vat_rate to 20 if it's 0 or empty
  useEffect(() => {
    if (hasVat && (vatRate === 0 || vatRate === '0' || !vatRate)) {
      setValue('vat_rate', 20);
    }
  }, [hasVat, vatRate, setValue]);

  /** Line-item display currency (TRY default; preserved on edit via reset). */
  const lineCurrency = watch('currency') ?? 'TRY';
  const { data: siteData } = useSite(selectedSiteId);

  // When switching TO survey: clear the blank default row (if it's the only item and still empty).
  // When switching FROM survey: restore the blank default row if the user left items empty.
  const prevWorkTypeRef = useRef(null);
  useEffect(() => {
    const prev = prevWorkTypeRef.current;
    prevWorkTypeRef.current = workType;
    if (prev === null || prev === workType) return;

    const currentItems = watch('items') || [];

    if (workType === 'survey') {
      const isOnlyBlankRow =
        currentItems.length === 1 &&
        !currentItems[0]?.description &&
        !currentItems[0]?.unit_price;
      if (isOnlyBlankRow) setValue('items', []);
    } else if (prev === 'survey' && currentItems.length === 0) {
      setValue('items', [{ description: '', quantity: 1, unit: 'adet', unit_price: 0, material_id: null, cost: null }]);
    }
    void trigger('site_id');
  }, [workType, setValue, watch, trigger]);

  // Prefill from URL params
  useEffect(() => {
    if (!isEdit) {
      if (prefilledSiteId) setValue('site_id', prefilledSiteId, { shouldValidate: false });
      if (prefilledDate) setValue('scheduled_date', prefilledDate);
      if (prefilledTime) setValue('scheduled_time', prefilledTime);
      if (prefilledDescription) setValue('description', prefilledDescription);
      if (prefilledStatus) setValue('status', prefilledStatus);
    }
  }, [isEdit, prefilledSiteId, prefilledDate, prefilledTime, prefilledDescription, prefilledStatus, setValue]);

  const [selectedCustomerId, setSelectedCustomerId] = useState(prefilledCustomerId);
  const { data: customerSites = [], isLoading: isCustomerSitesLoading } = useSitesByCustomer(selectedCustomerId);

  // Auto-select the only site when a customer has exactly one location (no validation until pick/submit elsewhere).
  useEffect(() => {
    if (!selectedCustomerId) return;
    if (isCustomerSitesLoading) return;
    if (customerSites.length !== 1) return;
    const onlyId = customerSites[0].id;
    if (selectedSiteId === onlyId) return;
    if (selectedSiteId && customerSites.some((s) => s.id === selectedSiteId)) return;
    setValue('site_id', onlyId, { shouldValidate: false, shouldDirty: true });
  }, [selectedCustomerId, customerSites, isCustomerSitesLoading, selectedSiteId, setValue]);

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
    }));
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
      items: items.length > 0 ? items : workOrderDefaultValues.items,
      materials_discount_percent: workOrder.materials_discount_percent ?? 0,
      has_vat: workOrder.vat_rate > 0,
      has_tevkifat: !!workOrder.has_tevkifat,
      vat_rate: workOrder.vat_rate ?? 20,
    });
    if (workOrder.customer_id) setSelectedCustomerId(workOrder.customer_id);
  }, [workOrder, isEdit, reset]);

  // Handle prefilled customer ID
  useEffect(() => {
    if (prefilledCustomerId) {
      setSelectedCustomerId(prefilledCustomerId);
    }
  }, [prefilledCustomerId]);

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

      if (data.work_type !== 'survey' && !finalSiteId) {
        setError('site_id', { type: 'manual', message: t('workOrders:validation.siteRequired') });
        toast.error(t('workOrders:validation.siteRequired'));
        return;
      }

      const hasAccountNo = siteData?.account_no != null && String(siteData.account_no).trim() !== '';
      if (['service', 'maintenance'].includes(data.work_type) && finalSiteId && !hasAccountNo) {
        setError('site_id', { type: 'manual', message: t('workOrders:validation.accountNoRequired') });
        toast.error(t('workOrders:validation.accountNoRequired'));
        return;
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
        items: data.items || [],
        materials_discount_percent: data.materials_discount_percent ?? 0,
        has_tevkifat: !!data.has_tevkifat,
        vat_rate: data.has_vat ? (data.vat_rate != null ? Number(data.vat_rate) : 20) : 0,
      };

      if (isEdit) {
        await updateMutation.mutateAsync({ id, ...formattedData });
        navigate(`/work-orders/${id}`);
      } else {
        const newWo = await createMutation.mutateAsync(formattedData);
        // Auto-link to proposal if created from proposal page
        if (prefilledProposalId) {
          await linkWorkOrderMutation.mutateAsync({
            proposalId: prefilledProposalId,
            workOrderId: newWo.id,
          });
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
        {/* 1. Customer & Site Selection */}
        <Card className="rounded-[2rem] p-4 sm:p-6 lg:p-8 overflow-visible border-neutral-200/60 dark:border-[#262626] shadow-sm">
          <Controller
            name="site_id"
            control={control}
            render={({ field, fieldState }) => (
              <CustomerSiteSelector
                selectedCustomerId={selectedCustomerId}
                selectedSiteId={field.value ?? ''}
                onCustomerChange={(cid) => {
                  setSelectedCustomerId(cid || '');
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
          </div>
        </Card>

        {/* 3. Materials */}
        <Card className="rounded-[2rem] p-4 sm:p-6 lg:p-8 overflow-hidden border-neutral-200/60 dark:border-[#262626] shadow-sm">
          <WorkOrderItemsEditor
            control={control}
            register={register}
            errors={errors}
            watch={watch}
            setValue={setValue}
            currency={lineCurrency}
            workType={workType}
            tevkifatNumerator={Number(financeSettings?.tevkifat_rate_numerator) || 9}
            tevkifatDenominator={Number(financeSettings?.tevkifat_rate_denominator) || 10}
          />
        </Card>

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
