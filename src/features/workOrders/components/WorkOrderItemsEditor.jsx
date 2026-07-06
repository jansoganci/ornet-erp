import { useMemo, useState } from 'react';
import { useFieldArray, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Package,
  PackageOpen,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button, MaterialCombobox } from '../../../components/ui';
import { cn, getCurrencySymbol, formatCurrency } from '../../../lib/utils';
import { inferLineRevenueType } from '../../../lib/inferLineRevenueType';
import {
  normalizeWorkOrderItemUnit,
  WORK_ORDER_REVENUE_TYPES,
} from '../schema';

const DESKTOP_ITEM_GRID =
  'grid-cols-[36px_minmax(220px,1.6fr)_72px_92px_minmax(200px,1.5fr)_minmax(200px,1.5fr)_40px]';
const DESKTOP_ITEM_GRID_COMPACT =
  'grid-cols-[36px_minmax(220px,1.8fr)_88px_96px_40px]';
const DESKTOP_LINKED_GRID =
  'grid-cols-[36px_minmax(240px,1.8fr)_88px_88px_120px_108px_40px]';

const UNIT_OPTIONS = [
  { value: 'adet', labelKey: 'items.units.adet' },
  { value: 'metre', labelKey: 'items.units.metre' },
  { value: 'set', labelKey: 'items.units.set' },
  { value: 'takim', labelKey: 'items.units.takim' },
];

const BLANK_ITEM = {
  description: '',
  quantity: 1,
  unit: 'adet',
  unit_price: 0,
  material_id: null,
  proposal_item_id: null,
  revenue_type: 'material',
  source_type: 'manual_extra',
  cost: null,
};

function applySelectedMaterialToRow(setValue, index, payload) {
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
  setValue(`items.${index}.unit_price`, payload.unit_price ?? null, { shouldDirty: true });
  setValue(`items.${index}.cost`, payload.cost_price ?? null, { shouldDirty: true });
}

function handleManualDescriptionChange(setValue, index, val) {
  setValue(`items.${index}.description`, val, { shouldValidate: true });
  setValue(`items.${index}.material_id`, null, { shouldDirty: true });
  setValue(`items.${index}.proposal_item_id`, null, { shouldDirty: true });
  setValue(`items.${index}.source_type`, 'manual_extra', { shouldDirty: true });
  setValue(
    `items.${index}.revenue_type`,
    inferLineRevenueType({ description: val }),
    { shouldDirty: true },
  );
}

export function WorkOrderItemsEditor({
  control,
  errors,
  watch,
  setValue,
  onMaterialSelect,
  currency = 'TRY',
  workType,
  linkedMode = false,
  hideCommercialFields = false,
  lockProposalDerivedRows = false,
  linkedExecutionMeta = {},
  linkedExecutionLoading = false,
}) {
  const { t } = useTranslation('proposals');
  const { t: tWo } = useTranslation('workOrders');
  const symbol = getCurrencySymbol(currency);
  const [showCompletedRows, setShowCompletedRows] = useState(false);
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const watchItemsValue = watch('items');
  const watchItems = useMemo(() => watchItemsValue || [], [watchItemsValue]);
  const discountPercent = Number(watch('materials_discount_percent')) || 0;
  const subtotal = watchItems.reduce((sum, item) => {
    const qty = parseFloat(item?.quantity) || 0;
    const price = parseFloat(item?.unit_price) || 0;
    return sum + qty * price;
  }, 0);
  const discountAmount = subtotal * (discountPercent / 100);
  const netTotal = subtotal - discountAmount;
  const canDeleteLastRow = workType === 'survey';

  const unitOptions = UNIT_OPTIONS.map((u) => ({
    value: u.value,
    label: t(u.labelKey),
  }));
  const revenueTypeOptions = WORK_ORDER_REVENUE_TYPES.map((value) => ({
    value,
    label: t(`items.revenueTypes.${value}`),
  }));

  const handleAddItem = () => {
    append(BLANK_ITEM, { shouldFocus: false });
  };

  function isProposalDerivedRow(index) {
    const row = watchItems?.[index];
    return row?.source_type === 'proposal_item' || !!row?.proposal_item_id;
  }

  function getExecutionState(index) {
    const row = watchItems?.[index];
    const proposalItemId = row?.proposal_item_id;
    const meta = proposalItemId ? linkedExecutionMeta?.[proposalItemId] : null;
    const quotedQuantity = Number(meta?.quotedQuantity) || 0;
    const previouslyCompletedQuantity = Number(meta?.previouslyCompletedQuantity) || 0;
    const currentVisitQuantity = parseFloat(row?.quantity) || 0;
    const remainingBeforeCurrent = quotedQuantity - previouslyCompletedQuantity;
    const remainingAfterCurrent = quotedQuantity - previouslyCompletedQuantity - currentVisitQuantity;
    const overEntered = currentVisitQuantity > Math.max(remainingBeforeCurrent, 0);
    const isCompletedReference = remainingBeforeCurrent <= 0 && currentVisitQuantity <= 0;

    return {
      quotedQuantity,
      previouslyCompletedQuantity,
      currentVisitQuantity,
      remainingBeforeCurrent,
      remainingAfterCurrent,
      overEntered,
      isCompletedReference,
    };
  }

  const orderedRowDescriptors = fields.map((field, index) => {
      const isProposalRow = isProposalDerivedRow(index);
      const execution = isProposalRow ? getExecutionState(index) : null;
      let bucket = 1;

      if (linkedMode && isProposalRow) {
        bucket = execution?.isCompletedReference ? 2 : 0;
      } else if (!isProposalRow) {
        bucket = 1;
      }

    return {
      id: field.id,
      index,
      bucket,
      isProposalRow,
      execution,
      sortOrder: watchItems?.[index]?.sort_order ?? index,
    };
  }).sort((a, b) => {
    if (a.bucket !== b.bucket) return a.bucket - b.bucket;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.index - b.index;
  });

  const completedRowDescriptors = orderedRowDescriptors.filter(
    (descriptor) => descriptor.bucket === 2,
  );
  const visibleRowDescriptors = linkedMode && !showCompletedRows
    ? orderedRowDescriptors.filter((descriptor) => descriptor.bucket !== 2)
    : orderedRowDescriptors;

  function renderMaterialCell(index, isLockedProposalRow) {
    if (isLockedProposalRow) {
      return (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-[#262626] dark:bg-[#1a1a1a]">
          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {watchItems?.[index]?.description || '—'}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:bg-[#111] dark:text-neutral-400">
              {watchItems?.[index]?.unit || 'adet'}
            </span>
            <span className="text-[11px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              {tWo('form.linkedMode.proposalRowLocked')}
            </span>
          </div>
        </div>
      );
    }

    return (
      <>
        <MaterialCombobox
          mode="proposals"
          value={watchItems?.[index]?.description || ''}
          placeholder={t('items.material')}
          onMaterialSelect={(payload) => {
            if (typeof onMaterialSelect === 'function') {
              onMaterialSelect(index, payload);
              return;
            }
            applySelectedMaterialToRow(setValue, index, payload);
          }}
          onDescriptionChange={(val) => handleManualDescriptionChange(setValue, index, val)}
          error={errors?.items?.[index]?.description?.message}
        />
        {!hideCommercialFields && (
          <div className="mt-2">
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              {t('items.revenueType')}
            </label>
            <Controller
              control={control}
              name={`items.${index}.revenue_type`}
              render={({ field }) => (
                <select
                  value={field.value ?? 'material'}
                  onChange={(e) => field.onChange(e.target.value)}
                  onBlur={field.onBlur}
                  className="block h-8 w-full rounded-lg border border-neutral-300 bg-white px-2 text-xs text-neutral-900 shadow-sm dark:border-neutral-500 dark:bg-[#171717] dark:text-neutral-50"
                >
                  {revenueTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              )}
            />
          </div>
        )}
      </>
    );
  }

  function renderDesktopItemRow(index) {
    const qty = parseFloat(watchItems?.[index]?.quantity) || 0;
    const price = parseFloat(watchItems?.[index]?.unit_price) || 0;
    const unitCost = parseFloat(watchItems?.[index]?.cost) || 0;
    const lineTotal = qty * price;
    const lineTotalCost = qty * unitCost;
    const isLockedProposalRow = lockProposalDerivedRows && isProposalDerivedRow(index);
    const allowRowRemoval = !isLockedProposalRow && (fields.length > 1 || canDeleteLastRow);
    const desktopGrid = hideCommercialFields ? DESKTOP_ITEM_GRID_COMPACT : DESKTOP_ITEM_GRID;

    return (
      <div key={fields[index]?.id} className="border-b border-neutral-100 dark:border-[#1a1a1a]">
        <div className={cn('grid', desktopGrid, 'gap-2 py-2 items-center')}>
          <div className="px-1 text-center text-sm font-medium text-neutral-500 dark:text-neutral-400">
            {index + 1}
          </div>
          <div className="px-1">
            {renderMaterialCell(index, isLockedProposalRow)}
          </div>
          <div className="px-1 relative z-10">
            <Controller
              control={control}
              name={`items.${index}.quantity`}
              render={({ field }) => (
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={field.value === undefined || field.value === null || field.value === '' ? '' : String(field.value)}
                  onChange={(e) => field.onChange(e.target.value)}
                  onBlur={() => {
                    const n = parseFloat(String(field.value).trim());
                    field.onChange(Number.isFinite(n) && n >= 0 ? n : 0);
                    field.onBlur();
                  }}
                  className={cn(
                    'block h-9 w-full rounded-lg border bg-white px-2 text-center text-sm text-neutral-900 shadow-sm dark:border-neutral-500 dark:bg-[#171717] dark:text-neutral-50',
                    errors?.items?.[index]?.quantity
                      ? 'border-error-500'
                      : 'border-neutral-300 focus:border-primary-600 focus:ring-primary-600/20'
                  )}
                />
              )}
            />
          </div>
          <div className="px-1 relative z-10">
            <Controller
              control={control}
              name={`items.${index}.unit`}
              render={({ field }) => (
                <select
                  value={field.value ?? 'adet'}
                  onChange={(e) => field.onChange(e.target.value)}
                  onBlur={field.onBlur}
                  className="block h-9 w-full cursor-pointer appearance-none rounded-lg border border-neutral-300 bg-white px-2 text-sm text-neutral-900 shadow-sm dark:border-neutral-500 dark:bg-[#171717] dark:text-neutral-50"
                >
                  {unitOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              )}
            />
          </div>
          {!hideCommercialFields && (
            <>
              <div className="px-1 grid grid-cols-[1fr_auto] gap-1.5 items-center rounded-lg bg-primary-50/60 dark:bg-primary-950/20 border border-primary-100 dark:border-primary-900/40 px-2 py-1.5">
                <div className="relative z-10 min-w-0">
                  <span className="absolute inset-y-0 left-2 flex items-center text-neutral-400 text-xs pointer-events-none z-10">{symbol}</span>
                  <Controller
                    control={control}
                    name={`items.${index}.unit_price`}
                    render={({ field }) => (
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={field.value === undefined || field.value === null || field.value === '' ? '' : String(field.value)}
                        onChange={(e) => field.onChange(e.target.value)}
                        onBlur={() => {
                          const n = parseFloat(String(field.value).trim());
                          field.onChange(Number.isFinite(n) && n >= 0 ? n : 0);
                          field.onBlur();
                        }}
                        className={cn(
                          'block h-9 w-full rounded-lg border bg-white pl-6 pr-2 text-sm text-neutral-900 shadow-sm dark:border-neutral-500 dark:bg-[#171717] dark:text-neutral-50',
                          errors?.items?.[index]?.unit_price
                            ? 'border-error-500'
                            : 'border-neutral-300'
                        )}
                      />
                    )}
                  />
                </div>
                <div className="text-right shrink-0 pl-1 border-l border-primary-200/80 dark:border-primary-800/60">
                  <span className="block text-[10px] font-medium uppercase tracking-wide text-primary-600/80 dark:text-primary-400/80 leading-tight">
                    {t('items.salesTotal')}
                  </span>
                  <span className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 tabular-nums whitespace-nowrap">
                    {formatCurrency(lineTotal, currency)}
                  </span>
                </div>
              </div>
              <div className="px-1 grid grid-cols-[1fr_auto] gap-1.5 items-center rounded-lg bg-neutral-50 dark:bg-[#1a1a1a] border border-neutral-200 dark:border-[#333] px-2 py-1.5">
                <div className="relative z-10 min-w-0">
                  <span className="absolute inset-y-0 left-2 flex items-center text-neutral-400 text-xs pointer-events-none z-10">{symbol}</span>
                  <Controller
                    control={control}
                    name={`items.${index}.cost`}
                    render={({ field }) => (
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={field.value === undefined || field.value === null || field.value === '' ? '' : String(field.value)}
                        onChange={(e) => field.onChange(e.target.value)}
                        onBlur={() => {
                          const n = parseFloat(String(field.value).trim());
                          field.onChange(Number.isFinite(n) && n >= 0 ? n : 0);
                          field.onBlur();
                        }}
                        className="block h-9 w-full rounded-lg border border-neutral-300 bg-white pl-6 pr-2 text-sm text-neutral-900 shadow-sm dark:border-neutral-500 dark:bg-[#171717] dark:text-neutral-50"
                      />
                    )}
                  />
                </div>
                <div className="text-right shrink-0 pl-1 border-l border-neutral-200 dark:border-[#333]">
                  <span className="block text-[10px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400 leading-tight">
                    {t('items.totalCost')}
                  </span>
                  <span className="font-semibold text-sm text-neutral-700 dark:text-neutral-300 tabular-nums whitespace-nowrap">
                    {formatCurrency(lineTotalCost, currency)}
                  </span>
                </div>
              </div>
            </>
          )}
          <div className="flex items-center justify-center">
            {allowRowRemoval && (
              <button
                type="button"
                onClick={() => remove(index)}
                className="rounded p-1 text-neutral-400 hover:bg-error-50 hover:text-error-500 dark:hover:bg-error-900/20"
                aria-label={t('items.removeRow')}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderLinkedDesktopRow(descriptor) {
    const { index, execution } = descriptor;
    const allowRemoval = !isProposalDerivedRow(index) && (fields.length > 1 || canDeleteLastRow);
    const remainingTone = execution?.overEntered
      ? 'text-error-600 dark:text-error-400'
      : execution?.remainingAfterCurrent > 0
        ? 'text-amber-700 dark:text-amber-300'
        : 'text-emerald-700 dark:text-emerald-300';

    return (
      <div
        key={fields[index]?.id}
        className={cn(
          'border-b border-neutral-100 dark:border-[#1a1a1a]',
          descriptor.bucket === 2 && 'opacity-70',
        )}
      >
        <div className={cn('grid', DESKTOP_LINKED_GRID, 'gap-2 py-2 items-center')}>
          <div className="px-1 text-center text-sm font-medium text-neutral-500 dark:text-neutral-400">
            {index + 1}
          </div>
          <div className="px-1">
            {renderMaterialCell(index, isProposalDerivedRow(index))}
          </div>
          <div className="px-1 text-center">
            <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 tabular-nums">
              {execution?.quotedQuantity ?? 0}
            </p>
          </div>
          <div className="px-1 text-center">
            <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 tabular-nums">
              {execution?.previouslyCompletedQuantity ?? 0}
            </p>
          </div>
          <div className="px-1">
            <Controller
              control={control}
              name={`items.${index}.quantity`}
              render={({ field }) => (
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={field.value === undefined || field.value === null || field.value === '' ? '' : String(field.value)}
                  onChange={(e) => field.onChange(e.target.value)}
                  onBlur={() => {
                    const n = parseFloat(String(field.value).trim());
                    field.onChange(Number.isFinite(n) && n >= 0 ? n : 0);
                    field.onBlur();
                  }}
                  className={cn(
                    'block h-9 w-full rounded-lg border bg-white px-3 text-center text-sm text-neutral-900 shadow-sm dark:border-neutral-500 dark:bg-[#171717] dark:text-neutral-50',
                    execution?.overEntered
                      ? 'border-error-500 focus:border-error-500'
                      : errors?.items?.[index]?.quantity
                        ? 'border-error-500'
                        : 'border-neutral-300 focus:border-primary-600 focus:ring-primary-600/20'
                  )}
                />
              )}
            />
            {execution?.overEntered && (
              <p className="mt-1 text-[11px] font-medium text-error-600 dark:text-error-400">
                {tWo('form.linkedMode.overEntryWarning')}
              </p>
            )}
          </div>
          <div className="px-1">
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-center dark:border-[#262626] dark:bg-[#1a1a1a]">
              <p className={cn('text-sm font-semibold tabular-nums', remainingTone)}>
                {execution?.remainingAfterCurrent ?? 0}
              </p>
              {execution?.overEntered ? (
                <div className="mt-1 flex items-center justify-center gap-1 text-[11px] font-medium text-error-600 dark:text-error-400">
                  <AlertTriangle className="h-3 w-3" />
                  <span>{tWo('form.linkedMode.overEntryShort')}</span>
                </div>
              ) : execution?.remainingAfterCurrent <= 0 ? (
                <div className="mt-1 flex items-center justify-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>{tWo('form.linkedMode.completedBadge')}</span>
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex items-center justify-center">
            {allowRemoval && (
              <button
                type="button"
                onClick={() => remove(index)}
                className="rounded p-1 text-neutral-400 hover:bg-error-50 hover:text-error-500 dark:hover:bg-error-900/20"
                aria-label={t('items.removeRow')}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderMobileItemCard(index) {
    const qty = parseFloat(watchItems?.[index]?.quantity) || 0;
    const price = parseFloat(watchItems?.[index]?.unit_price) || 0;
    const unitCost = parseFloat(watchItems?.[index]?.cost) || 0;
    const lineTotal = qty * price;
    const lineTotalCost = qty * unitCost;
    const isLockedProposalRow = lockProposalDerivedRows && isProposalDerivedRow(index);
    const allowRowRemoval = !isLockedProposalRow && (fields.length > 1 || canDeleteLastRow);

    return (
      <div key={fields[index]?.id} className="space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-[#262626] dark:bg-[#1a1a1a]">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase text-neutral-500">#{index + 1}</span>
          {allowRowRemoval && (
            <button
              type="button"
              onClick={() => remove(index)}
              className="rounded p-1 text-neutral-400 hover:bg-error-50 hover:text-error-500 dark:hover:bg-error-900/20"
              aria-label={t('items.removeRow')}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">{t('items.material')}</label>
          {renderMaterialCell(index, isLockedProposalRow)}
        </div>
        {!hideCommercialFields && (
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">{t('items.revenueType')}</label>
            <Controller
              control={control}
              name={`items.${index}.revenue_type`}
              render={({ field }) => (
                <select
                  value={field.value ?? 'material'}
                  onChange={(e) => field.onChange(e.target.value)}
                  onBlur={field.onBlur}
                  className="block h-10 w-full cursor-pointer appearance-none rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 shadow-sm dark:border-neutral-500 dark:bg-[#171717] dark:text-neutral-50"
                >
                  {revenueTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              )}
            />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">{t('items.quantity')}</label>
            <Controller
              control={control}
              name={`items.${index}.quantity`}
              render={({ field }) => (
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={field.value === undefined || field.value === null || field.value === '' ? '' : String(field.value)}
                  onChange={(e) => field.onChange(e.target.value)}
                  onBlur={() => {
                    const n = parseFloat(String(field.value).trim());
                    field.onChange(Number.isFinite(n) && n >= 0 ? n : 0);
                    field.onBlur();
                  }}
                  className="block h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-center text-sm text-neutral-900 shadow-sm dark:border-neutral-500 dark:bg-[#171717] dark:text-neutral-50"
                />
              )}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">{t('items.unit')}</label>
            <Controller
              control={control}
              name={`items.${index}.unit`}
              render={({ field }) => (
                <select
                  value={field.value ?? 'adet'}
                  onChange={(e) => field.onChange(e.target.value)}
                  onBlur={field.onBlur}
                  className="block h-10 w-full cursor-pointer appearance-none rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 shadow-sm dark:border-neutral-500 dark:bg-[#171717] dark:text-neutral-50"
                >
                  {unitOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              )}
            />
          </div>
        </div>
        {!hideCommercialFields && (
          <>
            <div className="rounded-lg border border-primary-100 bg-primary-50/60 p-3 space-y-2 dark:border-primary-900/40 dark:bg-primary-950/20">
              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">{t('items.unitPrice')}</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-neutral-400 text-xs pointer-events-none">{symbol}</span>
                    <Controller
                      control={control}
                      name={`items.${index}.unit_price`}
                      render={({ field }) => (
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={field.value === undefined || field.value === null || field.value === '' ? '' : String(field.value)}
                          onChange={(e) => field.onChange(e.target.value)}
                          onBlur={() => {
                            const n = parseFloat(String(field.value).trim());
                            field.onChange(Number.isFinite(n) && n >= 0 ? n : 0);
                            field.onBlur();
                          }}
                          className="block h-10 w-full rounded-lg border border-neutral-300 bg-white pl-6 pr-3 text-sm text-neutral-900 shadow-sm dark:border-neutral-500 dark:bg-[#171717] dark:text-neutral-50"
                        />
                      )}
                    />
                  </div>
                </div>
                <div className="border-l border-primary-200/80 pl-3 text-right dark:border-primary-800/60">
                  <span className="mb-1 block text-xs font-medium text-primary-600/80 dark:text-primary-400/80">{t('items.salesTotal')}</span>
                  <p className="tabular-nums font-bold text-neutral-900 dark:text-neutral-100">{formatCurrency(lineTotal, currency)}</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 space-y-2 dark:border-[#262626] dark:bg-[#1a1a1a]">
              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">{t('items.unitCost')}</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-neutral-400 text-xs pointer-events-none">{symbol}</span>
                    <Controller
                      control={control}
                      name={`items.${index}.cost`}
                      render={({ field }) => (
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={field.value === undefined || field.value === null || field.value === '' ? '' : String(field.value)}
                          onChange={(e) => field.onChange(e.target.value)}
                          onBlur={() => {
                            const n = parseFloat(String(field.value).trim());
                            field.onChange(Number.isFinite(n) && n >= 0 ? n : 0);
                            field.onBlur();
                          }}
                          className="block h-10 w-full rounded-lg border border-neutral-300 bg-white pl-6 pr-3 text-sm text-neutral-900 shadow-sm dark:border-neutral-500 dark:bg-[#171717] dark:text-neutral-50"
                        />
                      )}
                    />
                  </div>
                </div>
                <div className="border-l border-neutral-200 pl-3 text-right dark:border-[#333]">
                  <span className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">{t('items.totalCost')}</span>
                  <p className="tabular-nums font-bold text-neutral-700 dark:text-neutral-300">{formatCurrency(lineTotalCost, currency)}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  function renderLinkedMobileCard(descriptor) {
    const { index, execution } = descriptor;
    const allowRemoval = !isProposalDerivedRow(index) && (fields.length > 1 || canDeleteLastRow);

    return (
      <div
        key={fields[index]?.id}
        className={cn(
          'space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-[#262626] dark:bg-[#1a1a1a]',
          descriptor.bucket === 2 && 'opacity-70',
        )}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase text-neutral-500">#{index + 1}</span>
          {allowRemoval && (
            <button
              type="button"
              onClick={() => remove(index)}
              className="rounded p-1 text-neutral-400 hover:bg-error-50 hover:text-error-500 dark:hover:bg-error-900/20"
              aria-label={t('items.removeRow')}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">{t('items.material')}</label>
          {renderMaterialCell(index, isProposalDerivedRow(index))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-[#333] dark:bg-[#111]">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              {tWo('form.linkedMode.quotedQuantity')}
            </p>
            <p className="mt-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100 tabular-nums">
              {execution?.quotedQuantity ?? 0}
            </p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-[#333] dark:bg-[#111]">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              {tWo('form.linkedMode.previouslyCompletedQuantity')}
            </p>
            <p className="mt-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100 tabular-nums">
              {execution?.previouslyCompletedQuantity ?? 0}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">{tWo('form.linkedMode.thisVisitQuantity')}</label>
            <Controller
              control={control}
              name={`items.${index}.quantity`}
              render={({ field }) => (
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={field.value === undefined || field.value === null || field.value === '' ? '' : String(field.value)}
                  onChange={(e) => field.onChange(e.target.value)}
                  onBlur={() => {
                    const n = parseFloat(String(field.value).trim());
                    field.onChange(Number.isFinite(n) && n >= 0 ? n : 0);
                    field.onBlur();
                  }}
                  className={cn(
                    'block h-10 w-full rounded-lg border bg-white px-3 text-center text-sm text-neutral-900 shadow-sm dark:border-neutral-500 dark:bg-[#171717] dark:text-neutral-50',
                    execution?.overEntered ? 'border-error-500' : 'border-neutral-300',
                  )}
                />
              )}
            />
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-[#333] dark:bg-[#111]">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              {tWo('form.linkedMode.remainingQuantity')}
            </p>
            <p
              className={cn(
                'mt-1 text-sm font-semibold tabular-nums',
                execution?.overEntered
                  ? 'text-error-600 dark:text-error-400'
                  : execution?.remainingAfterCurrent > 0
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-emerald-700 dark:text-emerald-300',
              )}
            >
              {execution?.remainingAfterCurrent ?? 0}
            </p>
          </div>
        </div>

        {execution?.overEntered && (
          <div className="flex items-start gap-2 rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-xs text-error-700 dark:border-error-900/40 dark:bg-error-950/20 dark:text-error-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{tWo('form.linkedMode.overEntryWarning')}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-primary-600" />
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
            {t('form.sections.items')}
          </h3>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={handleAddItem}
        >
          {linkedMode ? tWo('form.linkedMode.addExtraItem') : t('items.addItem')}
        </Button>
      </div>

      {linkedMode && (
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50/70 px-4 py-3 text-sm text-neutral-600 dark:border-[#262626] dark:bg-[#1a1a1a] dark:text-neutral-300">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>{tWo('form.linkedMode.executionHint')}</p>
            {completedRowDescriptors.length > 0 && (
              <button
                type="button"
                onClick={() => setShowCompletedRows((open) => !open)}
                className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-700 dark:border-[#333] dark:bg-[#111] dark:text-neutral-200"
              >
                {showCompletedRows ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                <span>
                  {showCompletedRows
                    ? tWo('form.linkedMode.hideCompletedRows')
                    : tWo('form.linkedMode.showCompletedRows', { count: completedRowDescriptors.length })}
                </span>
              </button>
            )}
          </div>
          {linkedExecutionLoading && (
            <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
              {tWo('form.linkedMode.loadingExecution')}
            </p>
          )}
        </div>
      )}

      <div className="hidden md:block">
        {fields.length > 0 && (
          <div
            className={cn(
              'grid gap-2 pb-2 border-b border-neutral-200 dark:border-[#262626]',
              linkedMode ? DESKTOP_LINKED_GRID : (hideCommercialFields ? DESKTOP_ITEM_GRID_COMPACT : DESKTOP_ITEM_GRID),
            )}
          >
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-1 text-center">{t('items.sequence')}</span>
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-1">{t('items.material')}</span>
            {linkedMode ? (
              <>
                <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-1 text-center">{tWo('form.linkedMode.quotedQuantity')}</span>
                <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-1 text-center">{tWo('form.linkedMode.previouslyCompletedQuantity')}</span>
                <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-1 text-center">{tWo('form.linkedMode.thisVisitQuantity')}</span>
                <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-1 text-center">{tWo('form.linkedMode.remainingQuantity')}</span>
              </>
            ) : (
              <>
                <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-1">{t('items.quantity')}</span>
                <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-1">{t('items.unit')}</span>
                {!hideCommercialFields && (
                  <>
                    <span className="text-xs font-semibold text-primary-600/90 dark:text-primary-400/90 uppercase tracking-wider px-1">
                      {t('items.unitPrice')} / {t('items.salesTotal')}
                    </span>
                    <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-1">
                      {t('items.unitCost')} / {t('items.totalCost')}
                    </span>
                  </>
                )}
              </>
            )}
            <span />
          </div>
        )}

        {visibleRowDescriptors.map((descriptor) => (
          linkedMode && descriptor.isProposalRow
            ? renderLinkedDesktopRow(descriptor)
            : renderDesktopItemRow(descriptor.index)
        ))}
      </div>

      <div className="md:hidden space-y-4">
        {visibleRowDescriptors.map((descriptor) => (
          linkedMode && descriptor.isProposalRow
            ? renderLinkedMobileCard(descriptor)
            : renderMobileItemCard(descriptor.index)
        ))}
      </div>

      {fields.length === 0 && workType === 'survey' && (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-neutral-400 dark:text-neutral-500">
          <PackageOpen className="w-8 h-8" />
          <p className="text-sm">{tWo('form.hints.materialsOptional')}</p>
        </div>
      )}

      {!hideCommercialFields && (
        <div className="space-y-2 border-t-2 border-neutral-300 pt-4 dark:border-[#333]">
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-600 dark:text-neutral-400">{t('detail.subtotal')}</span>
            <span className="text-neutral-900 dark:text-neutral-100">{formatCurrency(subtotal, currency)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <label className="shrink-0 text-sm text-neutral-600 dark:text-neutral-400">
              {t('form.fields.discountPercent')}
            </label>
            <Controller
              control={control}
              name="materials_discount_percent"
              render={({ field }) => (
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={field.value === undefined || field.value === null || field.value === '' ? '' : String(field.value)}
                  onChange={(e) => field.onChange(e.target.value)}
                  onBlur={() => {
                    const n = parseFloat(String(field.value).trim());
                    field.onChange(Number.isFinite(n) && n >= 0 ? Math.min(n, 100) : 0);
                    field.onBlur();
                  }}
                  className="block h-10 w-full max-w-[120px] rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 shadow-sm dark:border-neutral-500 dark:bg-[#171717] dark:text-neutral-50"
                />
              )}
            />
          </div>
          {discountPercent > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-600 dark:text-neutral-400">{t('detail.discountAmount')}</span>
              <span className="text-neutral-900 dark:text-neutral-100">{formatCurrency(-discountAmount, currency)}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-[#333]">
            <span className="text-sm font-bold text-neutral-700 dark:text-neutral-300 uppercase">
              {t('detail.netAmount')}
            </span>
            <span className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
              {formatCurrency(netTotal, currency)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
