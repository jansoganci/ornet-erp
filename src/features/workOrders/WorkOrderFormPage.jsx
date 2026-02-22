import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save, X, Calendar, Clock, FileText, AlertTriangle } from 'lucide-react';
import { cn, getCurrencySymbol } from '../../lib/utils';
import { PageContainer, PageHeader } from '../../components/layout';
import { 
  Button, 
  Input, 
  Select, 
  Card, 
  Spinner,
  Textarea,
  FormSkeleton
} from '../../components/ui';
import { workOrderSchema, workOrderDefaultValues, WORK_TYPES, CURRENCIES } from './schema';
import { useWorkOrder, useCreateWorkOrder, useUpdateWorkOrder } from './hooks';
import { CustomerSiteSelector } from './CustomerSiteSelector';
import { WorkerSelector } from './WorkerSelector';
import { WorkOrderFormHero } from './components/WorkOrderFormHero';
import { WorkOrderItemsEditor } from './components/WorkOrderItemsEditor';
import { AccountNoWarning } from './AccountNoWarning';
import { SiteFormModal } from '../customerSites/SiteFormModal';
import { useSite } from '../customerSites/hooks';
import { useLinkWorkOrder } from '../proposals/hooks';
import { toast } from 'sonner';

export function WorkOrderFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation(['workOrders', 'common', 'errors']);
  const { t: tCommon } = useTranslation('common');
  const isEdit = !!id;

  const [showSiteModal, setShowSiteModal] = useState(false);

  const { data: workOrder, isLoading: isWorkOrderLoading } = useWorkOrder(id);
  const createMutation = useCreateWorkOrder();
  const updateMutation = useUpdateWorkOrder();
  const linkWorkOrderMutation = useLinkWorkOrder();

  const prefilledCustomerId = searchParams.get('customerId') || '';
  const prefilledSiteId = searchParams.get('siteId') || '';
  const prefilledDate = searchParams.get('date') || '';
  const prefilledTime = searchParams.get('time') || '';
  const prefilledProposalId = searchParams.get('proposalId') || '';

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(workOrderSchema),
    defaultValues: workOrderDefaultValues,
  });

  const selectedSiteId = watch('site_id');
  const workType = watch('work_type');
  const selectedCurrency = watch('currency') ?? 'TRY';
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
  }, [workType, setValue, watch]);

  // Prefill from URL params
  useEffect(() => {
    if (!isEdit) {
      if (prefilledSiteId) setValue('site_id', prefilledSiteId);
      if (prefilledDate) setValue('scheduled_date', prefilledDate);
      if (prefilledTime) setValue('scheduled_time', prefilledTime);
    }
  }, [isEdit, prefilledSiteId, prefilledDate, prefilledTime, setValue]);

  const [selectedCustomerId, setSelectedCustomerId] = useState(prefilledCustomerId);

  // Populate form when editing
  useEffect(() => {
    if (workOrder && isEdit) {
      const siteId = workOrder.site_id ?? '';
      const assignedTo = Array.isArray(workOrder.assigned_to) ? workOrder.assigned_to : [];
      const items = (workOrder.work_order_materials || []).map(wom => ({
        description: wom.description || wom.materials?.name || '',
        quantity: parseFloat(wom.quantity) || 1,
        unit: wom.unit || 'adet',
        unit_price: wom.unit_price ?? wom.unit_price_usd ?? 0,
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
        amount: workOrder.amount ?? '',
        currency: workOrder.currency || 'TRY',
        items: items.length > 0 ? items : workOrderDefaultValues.items,
        materials_discount_percent: workOrder.materials_discount_percent ?? 0,
      });
      if (workOrder.customer_id) setSelectedCustomerId(workOrder.customer_id);
    }
  }, [workOrder, isEdit, reset]);

  // Handle prefilled customer ID
  useEffect(() => {
    if (prefilledCustomerId) {
      setSelectedCustomerId(prefilledCustomerId);
    }
  }, [prefilledCustomerId]);

  const onSubmit = async (data) => {
    const hasAccountNo = siteData?.account_no != null && String(siteData.account_no).trim() !== '';
    if (['service', 'maintenance'].includes(data.work_type) && !hasAccountNo) {
      setError('site_id', { type: 'manual', message: t('workOrders:validation.accountNoRequired') });
      toast.error(t('workOrders:validation.accountNoRequired'));
      return;
    }

    try {
      const cleanValue = (val) => {
        if (val === '' || val === undefined) return null;
        if (typeof val === 'string') return val.trim() || null;
        return val;
      };

      const finalSiteId = data.site_id || selectedSiteId || (isEdit && workOrder?.site_id) || '';
      if (!finalSiteId) {
        setError('site_id', { type: 'manual', message: t('workOrders:validation.siteRequired') });
        toast.error(t('workOrders:validation.siteRequired'));
        return;
      }

      const formattedData = {
        site_id: finalSiteId,
        work_type: data.work_type, // Required
        status: data.status || 'pending',
        priority: data.priority || 'normal',
        currency: data.currency || 'TRY',
        // Optional fields - convert empty strings to null
        form_no: cleanValue(data.form_no),
        work_type_other: (data.work_type === 'other' && data.work_type_other?.trim()) ? data.work_type_other.trim() : null,
        scheduled_date: cleanValue(data.scheduled_date),
        scheduled_time: cleanValue(data.scheduled_time),
        description: cleanValue(data.description),
        notes: cleanValue(data.notes),
        amount: data.amount != null ? parseFloat(data.amount) : null,
        // assigned_to: ensure it's always an array of UUIDs (empty array is valid for UUID[])
        assigned_to: Array.isArray(data.assigned_to) && data.assigned_to.length > 0
          ? data.assigned_to.filter(uid => uid)
          : [],
        items: data.items || [],
        materials_discount_percent: data.materials_discount_percent ?? 0,
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
          navigate(`/work-orders/${newWo.id}`);
        }
      }
    } catch (err) {
      const errorMessage = err?.message || err?.details || err?.hint || t('common:errors.saveFailed');
      toast.error(`${errorMessage}${err?.code ? ` (${err.code})` : ''}`);
    }
  };

  const onInvalid = () => {
    toast.error(t('workOrders:validation.fillRequired'));
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
        {/* Hidden input to register site_id with react-hook-form */}
        <input type="hidden" {...register('site_id')} />

        {/* 1. Customer & Site Selection */}
        <Card className="rounded-[2rem] p-8 overflow-visible border-neutral-200/60 dark:border-[#262626] shadow-sm">
          <CustomerSiteSelector
            selectedCustomerId={selectedCustomerId}
            selectedSiteId={selectedSiteId}
            onCustomerChange={(cid) => setSelectedCustomerId(cid)}
            onSiteChange={(sid) => setValue('site_id', sid, { shouldValidate: true })}
            onAddNewCustomer={() => navigate('/customers/new')}
            onAddNewSite={() => setShowSiteModal(true)}
            error={errors.site_id?.message}
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
              onAddAccountNo={() => setShowSiteModal(true)}
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-neutral-100 dark:border-[#262626]">
              <Select
                label={t('common:fields.currency')}
                options={CURRENCIES.map((c) => ({ value: c, label: t(`common:currencies.${c}`) }))}
                error={errors.currency?.message}
                className="rounded-2xl"
                {...register('currency')}
              />
              <Input
                label={t('common:fields.amount')}
                type="number"
                step="0.01"
                rightIcon={<span className="text-neutral-400 font-bold">{getCurrencySymbol(selectedCurrency)}</span>}
                error={errors.amount?.message}
                className="rounded-2xl"
                {...register('amount')}
              />
            </div>
          </div>
        </Card>

        {/* 3. Materials */}
        <Card className="rounded-[2rem] p-8 overflow-hidden border-neutral-200/60 dark:border-[#262626] shadow-sm">
          <WorkOrderItemsEditor
            control={control}
            register={register}
            errors={errors}
            watch={watch}
            setValue={setValue}
            currency={selectedCurrency}
            workType={workType}
          />
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* 4. Workers */}
          <Card className="rounded-[2rem] p-8 border-neutral-200/60 dark:border-[#262626] shadow-sm">
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
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-[#171717]/80 backdrop-blur-md border-t border-neutral-200 dark:border-[#262626] z-50 flex gap-3 lg:hidden">
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
        onClose={() => setShowSiteModal(false)}
        customerId={selectedCustomerId || siteData?.customer_id || prefilledCustomerId}
        site={null}
      />
    </PageContainer>
  );
}
