import { useMemo } from 'react';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Package, Layers, PenLine } from 'lucide-react';
import { MaterialCombobox } from '../../../components/ui';
import { cn, getCurrencySymbol, formatCurrency } from '../../../lib/utils';
import {
  calcSectionTotal,
  calcTotalCosts,
  calcItemLineTotal,
  calcVatTevkifatSummary,
} from '../../../lib/proposalCalc';

const UNIT_OPTIONS = [
  { value: 'adet', labelKey: 'items.units.adet' },
  { value: 'metre', labelKey: 'items.units.metre' },
  { value: 'set', labelKey: 'items.units.set' },
  { value: 'takim', labelKey: 'items.units.takim' },
];

const BLANK_ITEM = {
  section_local_id: null,
  description: '',
  quantity: 1,
  unit: 'adet',
  unit_price: 0,
  material_id: null,
  cost: null,
  margin_percent: null,
  product_cost: null,
  labor_cost: null,
  shipping_cost: null,
  material_cost: null,
  misc_cost: null,
};

export function ProposalItemsEditor({
  control,
  errors,
  watch,
  setValue,
  currency = 'USD',
  // Items field array
  fields,
  append,
  remove,
  // Sections field array
  sectionFields,
  appendSection,
  removeSection,
  tevkifatNumerator = 9,
  tevkifatDenominator = 10,
}) {
  const { t } = useTranslation('proposals');
  const symbol = getCurrencySymbol(currency);

  const watchItems = watch('items') || [];
  const watchSections = watch('sections') || [];
  const vatRate = watch('has_vat') ? (Number(watch('vat_rate')) || 0) : 0;
  const hasTevkifat = !!watch('has_tevkifat');

  // Grand total = sum of per-section discounted totals
  const grandTotal = watchSections.reduce((sum, section) => {
    const sectionItems = watchItems.filter((item) => item.section_local_id === section._local_id);
    const { sectionTotal } = calcSectionTotal(sectionItems, section.discount_percent, currency);
    return sum + sectionTotal;
  }, 0);

  const { vatAmount, totalWithVat, withheldVat, totalPayable } = calcVatTevkifatSummary(
    grandTotal, vatRate, hasTevkifat, tevkifatNumerator, tevkifatDenominator,
  );
  const totalCosts = calcTotalCosts(watchItems, currency);
  const netProfit = grandTotal - totalCosts;

  const unitOptions = UNIT_OPTIONS.map((u) => ({ value: u.value, label: t(u.labelKey) }));

  // Map flat items array to groups: { sectionLocalId, items: [{ field, index }] }
  const itemsBySection = useMemo(() => {
    const map = {};
    for (let i = 0; i < fields.length; i++) {
      const key = watchItems[i]?.section_local_id ?? '__ungrouped__';
      if (!map[key]) map[key] = [];
      map[key].push({ field: fields[i], flatIndex: i });
    }
    return map;
  }, [fields, watchItems]);

  const hasSections = sectionFields.length > 0;

  // Per-section subtotal for display
  const sectionSubtotal = (sectionLocalId) => {
    const entries = itemsBySection[sectionLocalId] || [];
    return entries.reduce((sum, { flatIndex }) => {
      const qty = parseFloat(watchItems[flatIndex]?.quantity) || 0;
      const price = parseFloat(watchItems[flatIndex]?.unit_price) || 0;
      return sum + calcItemLineTotal(qty, price);
    }, 0);
  };

  const handleAddSection = () => {
    const newLocalId = crypto.randomUUID();
    appendSection({ _local_id: newLocalId, title: '' });
  };

  const handleDeleteSection = (sectionIdx, sectionLocalId) => {
    // Delete all items in this section (from end to start to avoid index shifting)
    const itemsToDelete = [];
    fields.forEach((_, i) => {
      if (watchItems[i]?.section_local_id === sectionLocalId) {
        itemsToDelete.push(i);
      }
    });
    // Remove items in reverse order to maintain correct indices
    itemsToDelete.reverse().forEach((idx) => remove(idx));
    
    // Remove the section
    removeSection(sectionIdx);
  };

  const handleAddItemToSection = (sectionLocalId) => {
    append({ ...BLANK_ITEM, section_local_id: sectionLocalId }, { shouldFocus: false });
  };

  // ─── Item Row ──────────────────────────────────────────────────────────────
  // Renders a single item row. Used in section blocks.
  function renderDesktopItemRow(flatIndex, displaySequence = flatIndex + 1) {
    const qty = parseFloat(watchItems?.[flatIndex]?.quantity) || 0;
    const price = parseFloat(watchItems?.[flatIndex]?.unit_price) || 0;
    const lineTotal = calcItemLineTotal(qty, price);

    return (
      <div key={fields[flatIndex]?.id} className="border-b border-neutral-100 dark:border-[#1a1a1a]">
        <div className="grid grid-cols-[36px_1fr_80px_100px_120px_100px_40px] gap-2 py-2 items-center">
          <div className="px-1 text-center text-sm font-medium text-neutral-500 dark:text-neutral-400">
            {displaySequence}
          </div>
          <div className="px-1">
            <MaterialCombobox
              mode="proposals"
              value={watchItems?.[flatIndex]?.description || ''}
              placeholder={t('items.material')}
              onMaterialSelect={(payload) => {
                setValue(`items.${flatIndex}.description`, payload.description);
                setValue(`items.${flatIndex}.material_id`, payload.material_id ?? null);
                if (payload.unit) setValue(`items.${flatIndex}.unit`, payload.unit);
              }}
              onDescriptionChange={(val) => {
                setValue(`items.${flatIndex}.description`, val);
                setValue(`items.${flatIndex}.material_id`, null);
              }}
              error={errors?.items?.[flatIndex]?.description?.message}
            />
          </div>
          {/* Quantity */}
          <div className="px-1 relative z-10">
            <Controller
              control={control}
              name={`items.${flatIndex}.quantity`}
              render={({ field: f }) => (
                <input
                  type="number" min={0} step={0.01}
                  value={f.value === undefined || f.value === null || f.value === '' ? '' : String(f.value)}
                  onChange={(e) => f.onChange(e.target.value)}
                  onBlur={() => {
                    const n = parseFloat(String(f.value).trim());
                    f.onChange(Number.isFinite(n) && n >= 0 ? n : 0);
                    f.onBlur();
                  }}
                  className={cn(
                    'block w-full h-9 rounded-lg border shadow-sm text-sm transition-colors text-center px-2',
                    'bg-white dark:bg-[#171717] text-neutral-900 dark:text-neutral-50',
                    errors?.items?.[flatIndex]?.quantity
                      ? 'border-error-500 focus:border-error-500'
                      : 'border-neutral-300 dark:border-neutral-500 focus:border-primary-600',
                  )}
                />
              )}
            />
          </div>
          {/* Unit */}
          <div className="px-1 relative z-10">
            <Controller
              control={control}
              name={`items.${flatIndex}.unit`}
              render={({ field: f }) => (
                <select
                  value={f.value ?? 'adet'}
                  onChange={(e) => f.onChange(e.target.value)}
                  onBlur={f.onBlur}
                  className="block w-full h-9 rounded-lg border shadow-sm text-sm appearance-none cursor-pointer bg-white dark:bg-[#171717] text-neutral-900 dark:text-neutral-50 border-neutral-300 dark:border-neutral-500 px-2"
                >
                  {unitOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              )}
            />
          </div>
          {/* Unit Price */}
          <div className="px-1 relative z-10">
            <span className="absolute inset-y-0 left-3 flex items-center text-neutral-400 text-xs pointer-events-none z-10">{symbol}</span>
            <Controller
              control={control}
              name={`items.${flatIndex}.unit_price`}
              render={({ field: f }) => (
                <input
                  type="number" min={0} step={0.01}
                  value={f.value === undefined || f.value === null || f.value === '' ? '' : String(f.value)}
                  onChange={(e) => f.onChange(e.target.value)}
                  onBlur={() => {
                    const n = parseFloat(String(f.value).trim());
                    f.onChange(Number.isFinite(n) && n >= 0 ? n : 0);
                    f.onBlur();
                  }}
                  className={cn(
                    'block w-full h-9 rounded-lg border shadow-sm text-sm relative pl-6 pr-2',
                    'bg-white dark:bg-[#171717] text-neutral-900 dark:text-neutral-50',
                    errors?.items?.[flatIndex]?.unit_price
                      ? 'border-error-500' : 'border-neutral-300 dark:border-neutral-500',
                  )}
                />
              )}
            />
          </div>
          {/* Line Total */}
          <div className="px-1 text-right">
            <span className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
              {formatCurrency(lineTotal, currency)}
            </span>
          </div>
          {/* Delete */}
          <div className="flex items-center justify-center">
            {fields.length > 1 && (
              <button
                type="button"
                onClick={() => remove(flatIndex)}
                className="p-1 rounded text-neutral-400 hover:text-error-500 hover:bg-error-50 dark:hover:bg-error-900/20"
                aria-label={t('items.removeRow')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        {/* Cost tracking */}
        <div className="py-2 px-1 bg-neutral-50 dark:bg-[#1a1a1a] rounded-b border-t border-neutral-100 dark:border-[#262626]">
          <p className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
            {t('items.costTracking')}
          </p>
          <div className="max-w-[140px]">
            <label className="block text-[10px] font-medium text-neutral-500 dark:text-neutral-400 mb-0.5">
              {t('items.cost')}
            </label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">{symbol}</span>
              <Controller
                control={control}
                name={`items.${flatIndex}.cost`}
                render={({ field: f }) => (
                  <input
                    type="number" min={0} step={0.01}
                    value={f.value === undefined || f.value === null || f.value === '' ? '' : Number(f.value)}
                    onChange={(e) => { const v = e.target.value; f.onChange(v === '' ? null : (parseFloat(v) || 0)); }}
                    onBlur={f.onBlur}
                    className="block w-full h-8 rounded border text-xs pl-5 pr-1 bg-white dark:bg-[#171717] text-neutral-900 dark:text-neutral-50 border-neutral-200 dark:border-[#262626]"
                  />
                )}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderMobileItemCard(flatIndex, displaySequence = flatIndex + 1) {
    const qty = parseFloat(watchItems?.[flatIndex]?.quantity) || 0;
    const price = parseFloat(watchItems?.[flatIndex]?.unit_price) || 0;
    const lineTotal = calcItemLineTotal(qty, price);

    return (
      <div key={fields[flatIndex]?.id} className="p-4 bg-neutral-50 dark:bg-[#1a1a1a] rounded-lg border border-neutral-200 dark:border-[#262626] space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-neutral-500 uppercase">#{displaySequence}</span>
          {fields.length > 1 && (
            <button
              type="button"
              onClick={() => remove(flatIndex)}
              className="p-1 rounded text-neutral-400 hover:text-error-500 hover:bg-error-50 dark:hover:bg-error-900/20"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">{t('items.material')}</label>
          <MaterialCombobox
            mode="proposals"
            value={watchItems?.[flatIndex]?.description || ''}
            placeholder={t('items.material')}
            onMaterialSelect={(payload) => {
              setValue(`items.${flatIndex}.description`, payload.description);
              setValue(`items.${flatIndex}.material_id`, payload.material_id ?? null);
              if (payload.unit) setValue(`items.${flatIndex}.unit`, payload.unit);
            }}
            onDescriptionChange={(val) => {
              setValue(`items.${flatIndex}.description`, val);
              setValue(`items.${flatIndex}.material_id`, null);
            }}
            error={errors?.items?.[flatIndex]?.description?.message}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">{t('items.quantity')}</label>
            <Controller
              control={control}
              name={`items.${flatIndex}.quantity`}
              render={({ field }) => (
                <input
                  type="number" min={0} step={0.01}
                  value={field.value === undefined || field.value === null || field.value === '' ? '' : String(field.value)}
                  onChange={(e) => field.onChange(e.target.value)}
                  onBlur={() => {
                    const n = parseFloat(String(field.value).trim());
                    field.onChange(Number.isFinite(n) && n >= 0 ? n : 0);
                    field.onBlur();
                  }}
                  className={cn(
                    'block w-full h-10 rounded-lg border shadow-sm text-sm text-center px-3',
                    'bg-white dark:bg-[#171717] text-neutral-900 dark:text-neutral-50',
                    errors?.items?.[flatIndex]?.quantity
                      ? 'border-error-500' : 'border-neutral-300 dark:border-neutral-500',
                  )}
                />
              )}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">{t('items.unit')}</label>
            <Controller
              control={control}
              name={`items.${flatIndex}.unit`}
              render={({ field }) => (
                <select
                  value={field.value ?? 'adet'}
                  onChange={(e) => field.onChange(e.target.value)}
                  onBlur={field.onBlur}
                  className="block w-full h-10 rounded-lg border shadow-sm text-sm appearance-none cursor-pointer bg-white dark:bg-[#171717] text-neutral-900 dark:text-neutral-50 border-neutral-300 dark:border-neutral-500 px-3"
                >
                  {unitOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              )}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">{t('items.unitPrice')}</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-3 flex items-center text-neutral-400 text-xs pointer-events-none">{symbol}</span>
            <Controller
              control={control}
              name={`items.${flatIndex}.unit_price`}
              render={({ field }) => (
                <input
                  type="number" min={0} step={0.01}
                  value={field.value === undefined || field.value === null || field.value === '' ? '' : String(field.value)}
                  onChange={(e) => field.onChange(e.target.value)}
                  onBlur={() => {
                    const n = parseFloat(String(field.value).trim());
                    field.onChange(Number.isFinite(n) && n >= 0 ? n : 0);
                    field.onBlur();
                  }}
                  className={cn(
                    'block w-full h-10 rounded-lg border shadow-sm text-sm pl-6 pr-3',
                    'bg-white dark:bg-[#171717] text-neutral-900 dark:text-neutral-50',
                    errors?.items?.[flatIndex]?.unit_price
                      ? 'border-error-500' : 'border-neutral-300 dark:border-neutral-500',
                  )}
                />
              )}
            />
          </div>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-[#262626]">
          <span className="text-xs text-neutral-500">{t('items.total')}</span>
          <span className="font-bold text-neutral-900 dark:text-neutral-100">{formatCurrency(lineTotal, currency)}</span>
        </div>
        {/* Cost tracking */}
        <div className="pt-2 mt-2 border-t border-neutral-200 dark:border-[#262626]">
          <p className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
            {t('items.costTracking')}
          </p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">{symbol}</span>
            <Controller
              control={control}
              name={`items.${flatIndex}.cost`}
              render={({ field: f }) => (
                <input
                  type="number" min={0} step={0.01}
                  value={f.value === undefined || f.value === null || f.value === '' ? '' : Number(f.value)}
                  onChange={(e) => { const v = e.target.value; f.onChange(v === '' ? null : (parseFloat(v) || 0)); }}
                  onBlur={f.onBlur}
                  className="block w-full h-10 rounded border text-sm pl-8 pr-3 bg-white dark:bg-[#171717] text-neutral-900 dark:text-neutral-50 border-neutral-200 dark:border-[#262626]"
                />
              )}
            />
          </div>
        </div>
      </div>
    );
  }

  // ─── Section Block ─────────────────────────────────────────────────────────
  function renderSectionBlock(section, sectionIdx) {
    const localId = section._local_id;
    const entries = itemsBySection[localId] || [];
    const subtotal = sectionSubtotal(localId);

    return (
      <div key={section.id} className="rounded-xl border border-neutral-200 dark:border-[#262626] overflow-hidden">
        {/* Section Header */}
        <div className="flex items-center gap-2 px-4 py-3 bg-neutral-100 dark:bg-[#1f1f1f] border-b border-neutral-200 dark:border-[#262626]">
          <PenLine className="w-4 h-4 text-neutral-400 shrink-0" />
          <Controller
            control={control}
            name={`sections.${sectionIdx}.title`}
            render={({ field: f }) => (
              <input
                type="text"
                placeholder={t('sections.titlePlaceholder')}
                value={f.value ?? ''}
                onChange={f.onChange}
                onBlur={f.onBlur}
                className={cn(
                  'flex-1 min-w-0 bg-transparent border-none outline-none text-sm font-semibold',
                  'text-neutral-800 dark:text-neutral-100 placeholder-neutral-400',
                  'focus:ring-0',
                )}
              />
            )}
          />
          <button
            type="button"
            onClick={() => handleDeleteSection(sectionIdx, localId)}
            className="ml-auto p-1.5 rounded text-neutral-400 hover:text-error-500 hover:bg-error-50 dark:hover:bg-error-900/20 transition-colors shrink-0"
            aria-label={t('sections.deleteSection')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Desktop Items */}
        <div className="hidden md:block px-4">
          {entries.length > 0 && (
            <div className="grid grid-cols-[36px_1fr_80px_100px_120px_100px_40px] gap-2 pb-2 pt-3 border-b border-neutral-200 dark:border-[#262626]">
              <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-1 text-center">{t('items.sequence')}</span>
              <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-1">{t('items.material')}</span>
              <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-1">{t('items.quantity')}</span>
              <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-1">{t('items.unit')}</span>
              <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-1">{t('items.unitPrice')}</span>
              <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-1 text-right">{t('items.total')}</span>
              <span />
            </div>
          )}
          {entries.map(({ flatIndex }, localIdx) => renderDesktopItemRow(flatIndex, localIdx + 1))}
        </div>

        {/* Mobile Items */}
        <div className="md:hidden p-4 space-y-3">
          {entries.map(({ flatIndex }, localIdx) => renderMobileItemCard(flatIndex, localIdx + 1))}
        </div>

        {/* Add Item Button */}
        <div className="px-4 pb-3 pt-2 border-t border-neutral-200 dark:border-[#262626]">
          <button
            type="button"
            onClick={() => handleAddItemToSection(localId)}
            className="w-full py-3 px-4 flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-neutral-300 dark:border-neutral-600 bg-transparent hover:bg-neutral-50 dark:hover:bg-neutral-900/50 hover:border-primary-400 dark:hover:border-primary-600 transition-colors text-neutral-600 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 font-medium text-sm"
          >
            <Plus className="w-4 h-4" />
            {t('items.addItem')}
          </button>
        </div>

        {/* Section Totals */}
        {entries.length === 0 ? (
          <div className="px-4 py-3 bg-neutral-50 dark:bg-[#1a1a1a] border-t border-neutral-200 dark:border-[#262626]">
            <span className="text-xs text-neutral-400 italic">{t('sections.emptySection')}</span>
          </div>
        ) : (() => {
          const sectionItems = entries.map(({ flatIndex }) => watchItems[flatIndex] ?? {});
          const sectionDiscountPct = Number(watchSections[sectionIdx]?.discount_percent) || 0;
          const { subtotal: secSub, discountAmount: secDisc, sectionTotal: secNet } = calcSectionTotal(sectionItems, sectionDiscountPct, currency);
          const { vatAmount: secVat, totalWithVat: secTotalWithVat } = calcVatTevkifatSummary(secNet, vatRate, false, 0, 1);
          return (
            <div className="px-4 py-3 bg-neutral-50 dark:bg-[#1a1a1a] border-t border-neutral-200 dark:border-[#262626] space-y-1.5">
              {/* Subtotal row */}
              <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                <span>{t('sections.sectionSubtotal')}</span>
                <span className="font-medium tabular-nums">{formatCurrency(secSub, currency)}</span>
              </div>

              {/* Discount input row */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-neutral-500 dark:text-neutral-400 shrink-0">{t('sections.discount')} %</span>
                <Controller
                  control={control}
                  name={`sections.${sectionIdx}.discount_percent`}
                  render={({ field: f }) => (
                    <input
                      type="number" min={0} max={100} step={0.01}
                      value={f.value === undefined || f.value === null || f.value === '' ? '' : String(f.value)}
                      onChange={(e) => f.onChange(e.target.value)}
                      onBlur={() => {
                        const n = parseFloat(String(f.value).trim());
                        f.onChange(Number.isFinite(n) && n >= 0 ? Math.min(n, 100) : 0);
                        f.onBlur();
                      }}
                      placeholder="0"
                      className="w-20 h-7 rounded border text-xs text-center bg-white dark:bg-[#171717] text-neutral-900 dark:text-neutral-50 border-neutral-300 dark:border-neutral-600 focus:border-primary-500 outline-none"
                    />
                  )}
                />
              </div>

              {/* Discount amount */}
              {sectionDiscountPct > 0 && (
                <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                  <span>{t('sections.discountAmount')}</span>
                  <span className="tabular-nums text-error-600 dark:text-error-400">-{formatCurrency(secDisc, currency)}</span>
                </div>
              )}

              {/* Section net total */}
              <div className="flex items-center justify-between text-xs font-bold text-neutral-800 dark:text-neutral-100 pt-0.5 border-t border-neutral-200 dark:border-[#333]">
                <span>{t('sections.sectionTotal')}</span>
                <span className="tabular-nums">{formatCurrency(secNet, currency)}</span>
              </div>

              {/* VAT on section */}
              {vatRate > 0 && (
                <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                  <span>KDV (%{vatRate})</span>
                  <span className="tabular-nums">{formatCurrency(secVat, currency)}</span>
                </div>
              )}
              {vatRate > 0 && (
                <div className="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-300 font-semibold">
                  <span>{t('sections.sectionTotalWithVat')}</span>
                  <span className="tabular-nums">{formatCurrency(secTotalWithVat, currency)}</span>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    );
  }


  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-primary-600" />
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
            {t('form.sections.items')}
          </h3>
        </div>
        {hasSections && (
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {t('sections.sectionCount', { count: sectionFields.length })}
          </span>
        )}
      </div>

      {/* Section blocks */}
      {sectionFields.map((section, idx) => renderSectionBlock(section, idx))}

      {/* Add Section button */}
      <button
        type="button"
        onClick={handleAddSection}
        className="w-full py-3 px-4 flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary-300 dark:border-primary-700 bg-transparent hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:border-primary-500 dark:hover:border-primary-500 transition-colors text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium text-sm"
      >
        <Layers className="w-4 h-4" />
        {t('sections.addSection')}
      </button>

      {/* ─── Grand Totals ──────────────────────────────────────────────────── */}
      <div className="pt-4 border-t-2 border-neutral-300 dark:border-[#333] space-y-2">
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm font-bold text-neutral-700 dark:text-neutral-300 uppercase">{t('detail.total')}</span>
          <span className="text-xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">{formatCurrency(grandTotal, currency)}</span>
        </div>
        {vatRate > 0 && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-600 dark:text-neutral-400">{t('detail.vatAmount')} (%{vatRate})</span>
              <span className="text-neutral-900 dark:text-neutral-100 tabular-nums">{formatCurrency(vatAmount, currency)}</span>
            </div>
            <div className="flex items-center justify-between text-sm font-semibold">
              <span className="text-neutral-700 dark:text-neutral-300">{t('detail.totalWithVat')}</span>
              <span className="text-neutral-900 dark:text-neutral-100 tabular-nums">{formatCurrency(totalWithVat, currency)}</span>
            </div>
          </>
        )}
        {hasTevkifat && vatRate > 0 && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-600 dark:text-neutral-400">{t('detail.withheldVat')}</span>
              <span className="text-neutral-900 dark:text-neutral-100 tabular-nums">-{formatCurrency(withheldVat, currency)}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-[#333]">
              <span className="text-sm font-bold text-primary-700 dark:text-primary-300 uppercase">{t('detail.totalPayable')}</span>
              <span className="text-xl font-bold text-primary-600 dark:text-primary-400 tabular-nums">{formatCurrency(totalPayable, currency)}</span>
            </div>
          </>
        )}
        <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-[#333]">
          <span className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">
            {t('detail.netProfit')} (Dahili)
          </span>
          <span className={cn(
            'text-lg font-bold',
            netProfit >= 0 ? 'text-green-600 dark:text-green-500' : 'text-error-600 dark:text-error-400',
          )}>
            {formatCurrency(netProfit, currency)}
          </span>
        </div>
      </div>

      {errors?.items?.root?.message && (
        <p className="text-sm text-error-600 dark:text-error-400">{errors.items.root.message}</p>
      )}
      {errors?.items?.message && (
        <p className="text-sm text-error-600 dark:text-error-400">{errors.items.message}</p>
      )}
    </div>
  );
}
