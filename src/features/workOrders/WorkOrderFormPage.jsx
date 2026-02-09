import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save, X, Calendar, Clock, FileText, Package, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { PageContainer, PageHeader } from '../../components/layout';
import { 
  Button, 
  Input, 
  Select, 
  Card, 
  Spinner,
  Textarea,
  Badge
} from '../../components/ui';
import { workOrderSchema, workOrderDefaultValues, WORK_TYPES } from './schema';
import { useWorkOrder, useCreateWorkOrder, useUpdateWorkOrder } from './hooks';
import { CustomerSiteSelector } from './CustomerSiteSelector';
import { WorkerSelector } from './WorkerSelector';
import { MaterialSelector } from './MaterialSelector';
import { AccountNoWarning } from './AccountNoWarning';
import { SiteFormModal } from '../customerSites/SiteFormModal';
import { useSite } from '../customerSites/hooks';
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

  const prefilledCustomerId = searchParams.get('customerId') || '';
  const prefilledSiteId = searchParams.get('siteId') || '';
  const prefilledDate = searchParams.get('date') || '';
  const prefilledTime = searchParams.get('time') || '';

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
  const { data: siteData } = useSite(selectedSiteId);

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
      const materials = (workOrder.work_order_materials || []).map(wom => ({
        material_id: wom.material_id,
        quantity: Math.max(1, Number(wom.quantity) || 1),
        notes: wom.notes || '',
        material: wom.materials
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
        materials,
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
    console.log('[EDIT_SAVE] onSubmit çağrıldı. data.site_id:', data.site_id, 'selectedSiteId:', selectedSiteId, 'workOrder?.site_id:', workOrder?.site_id);

    const hasAccountNo = siteData?.account_no != null && String(siteData.account_no).trim() !== '';
    if (['service', 'maintenance'].includes(data.work_type) && !hasAccountNo) {
      console.error('[EDIT_SAVE] Hesap no yok');
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
        console.error('[EDIT_SAVE] site_id yok. data.site_id:', data.site_id, 'selectedSiteId:', selectedSiteId);
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
          ? data.assigned_to.filter(id => id) // Remove any empty/null values
          : [], // Empty array is valid
        materials: data.materials || [],
      };

      console.log('[EDIT_SAVE] formattedData hazır, API çağrılıyor:', formattedData);

      if (isEdit) {
        console.log('[EDIT_SAVE] updateMutation.mutateAsync çağrılıyor, id:', id);
        await updateMutation.mutateAsync({ id, ...formattedData });
        console.log('[EDIT_SAVE] Güncelleme başarılı, yönlendiriliyor');
        navigate(`/work-orders/${id}`);
      } else {
        const newWo = await createMutation.mutateAsync(formattedData);
        navigate(`/work-orders/${newWo.id}`);
      }
    } catch (err) {
      console.error('[EDIT_SAVE] Save failed:', err);
      console.error('[EDIT_SAVE] Error details:', {
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        code: err?.code,
        statusCode: err?.status,
        fullError: err
      });
      const errorMessage = err?.message || err?.details || err?.hint || t('common:errors.saveFailed');
      toast.error(`${errorMessage}${err?.code ? ` (${err.code})` : ''}`);
    }
  };

  const onInvalid = (errors) => {
    console.error('[EDIT_SAVE] Validation hatası - form gönderilmedi.');
    console.error('[EDIT_SAVE] Hatalı alanlar:', Object.keys(errors));
    Object.entries(errors).forEach(([field, err]) => {
      console.error(`  - ${field}:`, err?.message || err);
    });
    toast.error(t('workOrders:validation.fillRequired'));
  };

  if (isEdit && isWorkOrderLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  const priorityOptions = [
    { value: 'low', label: t('workOrders:priorities.low') },
    { value: 'normal', label: t('workOrders:priorities.normal') },
    { value: 'high', label: t('workOrders:priorities.high') },
    { value: 'urgent', label: t('workOrders:priorities.urgent') },
  ];

  return (
    <PageContainer maxWidth="lg" padding="default" className="space-y-6 pb-24">
      <PageHeader
        title={isEdit ? t('workOrders:form.editTitle') : t('workOrders:form.addTitle')}
        breadcrumbs={[
          { label: tCommon('nav.workOrders'), to: '/work-orders' },
          ...(isEdit && workOrder ? [{ label: `#${workOrder.id.slice(0, 8)}`, to: `/work-orders/${id}` }] : []),
          { label: isEdit ? t('workOrders:form.editTitle') : t('workOrders:form.addTitle') }
        ]}
      />

      <form
        onSubmit={handleSubmit(onSubmit, onInvalid)}
        className="space-y-8 mt-6"
      >
        {/* Hidden input to register site_id with react-hook-form */}
        <input type="hidden" {...register('site_id')} />

        {/* 1. Customer & Site Selection */}
        <Card className="p-1 overflow-visible">
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <Card header={
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-primary-600" />
                <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-sm">
                  {t('workOrders:form.sections.workInfo')}
                </h3>
              </div>
            } className="p-6">
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label={t('workOrders:form.fields.formNo')}
                    placeholder={t('workOrders:form.placeholders.formNo')}
                    error={errors.form_no?.message}
                    {...register('form_no')}
                  />
                  <Select
                    label={t('workOrders:form.fields.priority')}
                    options={priorityOptions}
                    error={errors.priority?.message}
                    {...register('priority')}
                  />
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    {t('workOrders:form.fields.workType')}
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {WORK_TYPES.map((type) => (
                      <label 
                        key={type}
                        className={cn(
                          "relative flex items-center px-4 py-2 rounded-xl border-2 cursor-pointer transition-all duration-200",
                          workType === type 
                            ? "bg-primary-50 border-primary-600 dark:bg-primary-950/30 dark:border-primary-500" 
                            : "bg-white border-neutral-200 hover:border-neutral-300 dark:bg-[#171717] dark:border-[#262626]"
                        )}
                      >
                        <input
                          type="radio"
                          className="sr-only"
                          value={type}
                          {...register('work_type')}
                        />
                        <span className={cn(
                          "text-sm font-bold",
                          workType === type ? "text-primary-700 dark:text-primary-400" : "text-neutral-600 dark:text-neutral-400"
                        )}>
                          {tCommon(`workType.${type}`)}
                        </span>
                      </label>
                    ))}
                  </div>
                  {errors.work_type && (
                    <p className="text-sm text-error-600 mt-1">{errors.work_type.message}</p>
                  )}
                </div>

                {workType === 'other' && (
                  <Input
                    label={t('workOrders:form.fields.workTypeOther')}
                    placeholder={t('workOrders:form.placeholders.workTypeOther')}
                    error={errors.work_type_other?.message}
                    {...register('work_type_other')}
                  />
                )}

                <AccountNoWarning 
                  workType={workType} 
                  accountNo={siteData?.account_no}
                  onAddAccountNo={() => setShowSiteModal(true)}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label={t('workOrders:form.fields.scheduledDate')}
                    type="date"
                    leftIcon={Calendar}
                    error={errors.scheduled_date?.message}
                    {...register('scheduled_date')}
                  />
                  <Input
                    label={t('workOrders:form.fields.scheduledTime')}
                    type="time"
                    leftIcon={Clock}
                    error={errors.scheduled_time?.message}
                    {...register('scheduled_time')}
                  />
                </div>

                <Textarea
                  label={t('workOrders:form.fields.description')}
                  placeholder={t('workOrders:form.placeholders.description')}
                  error={errors.description?.message}
                  {...register('description')}
                />

                <Input
                  label={t('common:fields.amount')}
                  type="number"
                  step="0.01"
                  rightIcon={<span className="text-neutral-400">₺</span>}
                  error={errors.amount?.message}
                  {...register('amount')}
                />
              </div>
            </Card>

            {/* 3. Materials */}
            <Card className="p-6">
              <Controller
                name="materials"
                control={control}
                render={({ field }) => (
                  <MaterialSelector
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </Card>
          </div>

          <div className="space-y-8">
            {/* 4. Workers */}
            <Card className="p-6">
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
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-warning-600" />
                <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-sm">
                  {t('workOrders:form.sections.notes')}
                </h3>
              </div>
            } className="p-6">
              <Textarea
                placeholder={t('workOrders:form.placeholders.notes')}
                error={errors.notes?.message}
                {...register('notes')}
              />
            </Card>
          </div>
        </div>

        {/* Floating Action Bar for Mobile */}
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
            loading={isSubmitting || createMutation.isPending || updateMutation.isPending}
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
        customerId={selectedCustomerId || siteData?.customer_id || prefilledCustomerId}
        site={null}
      />
    </PageContainer>
  );
}
