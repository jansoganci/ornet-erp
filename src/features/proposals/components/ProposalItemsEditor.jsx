import { useState, useRef, useEffect, useMemo } from 'react';
import { useFieldArray, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Search, Check, Package } from 'lucide-react';
import { Button, IconButton, Spinner, Badge, Input } from '../../../components/ui';
import { useMaterials } from '../../materials/hooks';
import { MaterialFormModal } from '../../materials/MaterialFormModal';
import { cn } from '../../../lib/utils';

const UNIT_OPTIONS = [
  { value: 'adet', labelKey: 'items.units.adet' },
  { value: 'metre', labelKey: 'items.units.metre' },
  { value: 'set', labelKey: 'items.units.set' },
  { value: 'takim', labelKey: 'items.units.takim' },
];

function MaterialCombobox({ value, onChange, error }) {
  const { t } = useTranslation(['proposals', 'materials', 'workOrders']);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  const filters = useMemo(() => {
    const f = { active: true };
    if (search.trim()) f.search = search.trim();
    return f;
  }, [search]);

  const { data: materials = [], isLoading } = useMaterials(filters);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const handleSelect = (material) => {
    onChange(material.name);
    setIsOpen(false);
    setSearch('');
  };

  const handleCreateSuccess = (newMaterial) => {
    onChange(newMaterial.name);
    setShowCreateModal(false);
    setIsOpen(false);
    setSearch('');
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    onChange(val);
    if (!isOpen && val.length > 0) setIsOpen(true);
  };

  const handleFocus = () => {
    setIsOpen(true);
  };

  return (
    <div ref={dropdownRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value || ''}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={t('proposals:items.description')}
          className={cn(
            'block w-full h-9 rounded-lg border shadow-sm text-sm transition-colors',
            'placeholder:text-neutral-500 dark:placeholder:text-neutral-600',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            'bg-white dark:bg-[#171717] text-neutral-900 dark:text-neutral-50',
            'pl-9 pr-3',
            error
              ? 'border-error-500 focus:border-error-500 focus:ring-error-500/20'
              : 'border-neutral-300 dark:border-[#262626] focus:border-primary-600 focus:ring-primary-600/20'
          )}
        />
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="w-4 h-4 text-neutral-400" />
        </div>
      </div>

      {error && (
        <p className="mt-1 text-xs text-error-600 dark:text-error-400">{error}</p>
      )}

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#171717] border border-neutral-200 dark:border-[#262626] rounded-lg shadow-xl max-h-60 flex flex-col overflow-hidden">
          <div className="overflow-y-auto flex-1 py-1">
            {isLoading ? (
              <div className="p-3 flex justify-center">
                <Spinner size="sm" />
              </div>
            ) : materials.length === 0 ? (
              <div className="p-3 text-center">
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                  {t('workOrders:form.materialSelect.noResults', 'Malzeme bulunamadı')}
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCreateModal(true);
                  }}
                  className="text-xs text-primary-600 dark:text-primary-400 font-medium flex items-center justify-center gap-1 hover:underline mx-auto"
                >
                  <Plus className="w-3 h-3" />
                  {t('workOrders:form.materialSelect.addNew', 'Yeni Malzeme Ekle')}
                </button>
              </div>
            ) : (
              materials.map((material) => (
                <button
                  type="button"
                  key={material.id}
                  className={cn(
                    'w-full px-3 py-2 text-left flex items-center justify-between hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors',
                    value === material.name && 'bg-primary-50 dark:bg-primary-900/30'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(material);
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-neutral-900 dark:text-neutral-50 truncate">
                        {material.code}
                      </span>
                      {material.category && (
                        <Badge variant="default" size="sm">
                          {t(`materials:categories.${material.category}`)}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                      {material.name}
                    </p>
                  </div>
                  {value === material.name && (
                    <Check className="w-4 h-4 text-primary-600 shrink-0 ml-2" />
                  )}
                </button>
              ))
            )}
          </div>
          <div className="p-1.5 border-t border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#1a1a1a]">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowCreateModal(true);
              }}
              className="text-xs text-primary-600 dark:text-primary-400 font-medium flex items-center justify-center gap-1 hover:underline py-1 w-full"
            >
              <Plus className="w-3 h-3" />
              {t('workOrders:form.materialSelect.addNew', 'Yeni Malzeme Ekle')}
            </button>
          </div>
        </div>
      )}

      <MaterialFormModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}

export function ProposalItemsEditor({ control, register, errors, watch, setValue }) {
  const { t } = useTranslation('proposals');
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const watchItems = watch('items');
  const discountPercent = Number(watch('discount_percent')) || 0;
  const subtotal = (watchItems || []).reduce((sum, item) => {
    const qty = parseFloat(item?.quantity) || 0;
    const price = parseFloat(item?.unit_price_usd) || 0;
    return sum + qty * price;
  }, 0);
  const discountAmount = subtotal * (discountPercent / 100);
  const grandTotal = subtotal - discountAmount;
  const totalCosts = (watchItems || []).reduce((sum, item) => {
    const qty = parseFloat(item?.quantity) || 0;
    const cost = parseFloat(item?.cost_usd) || 0;
    return sum + cost * qty;
  }, 0);
  const netProfit = grandTotal - totalCosts;
  const formatUsd = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2 });

  const handleAddItem = () => {
    append({
      description: '',
      quantity: 1,
      unit: 'adet',
      unit_price_usd: 0,
      cost_usd: null,
      margin_percent: null,
      product_cost_usd: null,
      labor_cost_usd: null,
      shipping_cost_usd: null,
      material_cost_usd: null,
      misc_cost_usd: null,
    });
  };

  const unitOptions = UNIT_OPTIONS.map((u) => ({
    value: u.value,
    label: t(u.labelKey),
  }));

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
          {t('items.addItem')}
        </Button>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block">
        <div className="grid grid-cols-[36px_1fr_80px_100px_120px_100px_40px] gap-2 pb-2 border-b border-neutral-200 dark:border-[#262626]">
          <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-1 text-center">
            {t('items.sequence')}
          </span>
          <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-1">
            {t('items.description')}
          </span>
          <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-1">
            {t('items.quantity')}
          </span>
          <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-1">
            {t('items.unit')}
          </span>
          <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-1">
            {t('items.unitPrice')}
          </span>
          <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-1 text-right">
            {t('items.total')}
          </span>
          <span />
        </div>

        {fields.map((field, index) => {
          const qty = parseFloat(watchItems?.[index]?.quantity) || 0;
          const price = parseFloat(watchItems?.[index]?.unit_price_usd) || 0;
          const lineTotal = qty * price;

          return (
            <div
              key={field.id}
              className="border-b border-neutral-100 dark:border-[#1a1a1a]"
            >
              <div className="grid grid-cols-[36px_1fr_80px_100px_120px_100px_40px] gap-2 py-2 items-center">
                <div className="px-1 text-center text-sm font-medium text-neutral-500 dark:text-neutral-400">
                  {index + 1}
                </div>
                <div className="px-1">
                  <MaterialCombobox
                    value={watchItems?.[index]?.description || ''}
                    onChange={(val) => setValue(`items.${index}.description`, val, { shouldValidate: true })}
                    error={errors?.items?.[index]?.description?.message}
                  />
                </div>
                <div className="px-1 relative z-10">
                  <Controller
                    control={control}
                    name={`items.${index}.quantity`}
                    render={({ field: f }) => (
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={f.value === undefined || f.value === null || f.value === '' ? '' : (typeof f.value === 'string' ? f.value : String(f.value))}
                        onChange={(e) => f.onChange(e.target.value)}
                        onBlur={() => {
                          const v = f.value;
                          const n = typeof v === 'string' ? parseFloat(v.trim()) : Number(v);
                          f.onChange(Number.isFinite(n) && n >= 0 ? n : 0);
                          f.onBlur();
                        }}
                        className={cn(
                          'block w-full h-9 rounded-lg border shadow-sm text-sm transition-colors text-center',
                          'bg-white dark:bg-[#171717] text-neutral-900 dark:text-neutral-50',
                          'border-neutral-300 dark:border-neutral-500 focus:border-primary-600 focus:ring-primary-600/20 px-2'
                        )}
                      />
                    )}
                  />
                </div>
                <div className="px-1 relative z-10">
                  <Controller
                    control={control}
                    name={`items.${index}.unit`}
                    render={({ field: f }) => (
                      <select
                        value={f.value ?? 'adet'}
                        onChange={(e) => f.onChange(e.target.value)}
                        onBlur={f.onBlur}
                        className={cn(
                          'block w-full h-9 rounded-lg border shadow-sm text-sm appearance-none cursor-pointer',
                          'bg-white dark:bg-[#171717] text-neutral-900 dark:text-neutral-50 border-neutral-300 dark:border-neutral-500 px-2'
                        )}
                      >
                        {unitOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    )}
                  />
                </div>
                <div className="px-1 relative z-10">
                  <span className="absolute inset-y-0 left-3 flex items-center text-neutral-400 text-xs pointer-events-none z-10" aria-hidden>$</span>
                  <Controller
                    control={control}
                    name={`items.${index}.unit_price_usd`}
                    render={({ field: f }) => (
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={f.value === undefined || f.value === null || f.value === '' ? '' : (typeof f.value === 'string' ? f.value : String(f.value))}
                        onChange={(e) => f.onChange(e.target.value)}
                        onBlur={() => {
                          const v = f.value;
                          const n = typeof v === 'string' ? parseFloat(v.trim()) : Number(v);
                          f.onChange(Number.isFinite(n) && n >= 0 ? n : 0);
                          f.onBlur();
                        }}
                        className={cn(
                          'block w-full h-9 rounded-lg border shadow-sm text-sm relative pl-6 pr-2',
                          'bg-white dark:bg-[#171717] text-neutral-900 dark:text-neutral-50 border-neutral-300 dark:border-neutral-500'
                        )}
                      />
                    )}
                  />
                </div>
                <div className="px-1 text-right">
                  <span className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
                    ${lineTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-center">
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="p-1 rounded text-neutral-400 hover:text-error-500 hover:bg-error-50 dark:hover:bg-error-900/20"
                      aria-label="Delete row"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              {/* Cost tracking (internal only, single total cost per item) */}
              <div className="py-2 px-1 bg-neutral-50 dark:bg-[#1a1a1a] rounded-b border-t border-neutral-100 dark:border-[#262626]">
                <p className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
                  {t('items.costTracking')}
                </p>
                <div className="max-w-[140px]">
                  <label className="block text-[10px] font-medium text-neutral-500 dark:text-neutral-400 mb-0.5">
                    {t('items.cost')}
                  </label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">$</span>
                    <Controller
                      control={control}
                      name={`items.${index}.cost_usd`}
                      render={({ field: f }) => (
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={f.value === undefined || f.value === null || f.value === '' ? '' : Number(f.value)}
                          onChange={(e) => {
                            const v = e.target.value;
                            f.onChange(v === '' ? null : (parseFloat(v) || 0));
                          }}
                          onBlur={f.onBlur}
                          className={cn(
                            'block w-full h-8 rounded border text-xs pl-5 pr-1',
                            'bg-white dark:bg-[#171717] text-neutral-900 dark:text-neutral-50 border-neutral-200 dark:border-[#262626]'
                          )}
                        />
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
        {fields.map((field, index) => {
          const qty = parseFloat(watchItems?.[index]?.quantity) || 0;
          const price = parseFloat(watchItems?.[index]?.unit_price_usd) || 0;
          const lineTotal = qty * price;

          return (
            <div
              key={field.id}
              className="p-4 bg-neutral-50 dark:bg-[#1a1a1a] rounded-lg border border-neutral-200 dark:border-[#262626] space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-500 uppercase">
                  #{index + 1}
                </span>
                {fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="p-1 rounded text-neutral-400 hover:text-error-500 hover:bg-error-50 dark:hover:bg-error-900/20 transition-colors"
                    aria-label="Delete row"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Description - Material Combobox */}
              <div>
                <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  {t('items.description')}
                </label>
                <MaterialCombobox
                  value={watchItems?.[index]?.description || ''}
                  onChange={(val) => setValue(`items.${index}.description`, val, { shouldValidate: true })}
                  error={errors?.items?.[index]?.description?.message}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                    {t('items.quantity')}
                  </label>
                  <Controller
                    control={control}
                    name={`items.${index}.quantity`}
                    render={({ field }) => (
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={field.value === undefined || field.value === null || field.value === '' ? '' : (typeof field.value === 'string' ? field.value : String(field.value))}
                        onChange={(e) => field.onChange(e.target.value)}
                        onBlur={() => {
                          const v = field.value;
                          const n = typeof v === 'string' ? parseFloat(v.trim()) : Number(v);
                          field.onChange(Number.isFinite(n) && n >= 0 ? n : 0);
                          field.onBlur();
                        }}
                        className={cn(
                          'block w-full h-10 rounded-lg border shadow-sm text-sm transition-colors text-center',
                          'focus:outline-none focus:ring-2 focus:ring-offset-0',
                          'bg-white dark:bg-[#171717] text-neutral-900 dark:text-neutral-50',
                          'border-neutral-300 dark:border-neutral-500 focus:border-primary-600 focus:ring-primary-600/20',
                          'px-3'
                        )}
                      />
                    )}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                    {t('items.unit')}
                  </label>
                  <Controller
                    control={control}
                    name={`items.${index}.unit`}
                    render={({ field }) => (
                      <select
                        value={field.value ?? 'adet'}
                        onChange={(e) => field.onChange(e.target.value)}
                        onBlur={field.onBlur}
                        className={cn(
                          'block w-full h-10 rounded-lg border shadow-sm text-sm transition-colors appearance-none cursor-pointer',
                          'focus:outline-none focus:ring-2 focus:ring-offset-0',
                          'bg-white dark:bg-[#171717] text-neutral-900 dark:text-neutral-50',
                          'border-neutral-300 dark:border-neutral-500 focus:border-primary-600 focus:ring-primary-600/20',
                          'px-3'
                        )}
                      >
                        {unitOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    )}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  {t('items.unitPrice')}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 flex items-center text-neutral-400 text-xs pointer-events-none">
                    $
                  </span>
                  <Controller
                    control={control}
                    name={`items.${index}.unit_price_usd`}
                    render={({ field }) => (
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={field.value === undefined || field.value === null || field.value === '' ? '' : (typeof field.value === 'string' ? field.value : String(field.value))}
                        onChange={(e) => field.onChange(e.target.value)}
                        onBlur={() => {
                          const v = field.value;
                          const n = typeof v === 'string' ? parseFloat(v.trim()) : Number(v);
                          field.onChange(Number.isFinite(n) && n >= 0 ? n : 0);
                          field.onBlur();
                        }}
                        className={cn(
                          'block w-full h-10 rounded-lg border shadow-sm text-sm transition-colors',
                          'focus:outline-none focus:ring-2 focus:ring-offset-0',
                          'bg-white dark:bg-[#171717] text-neutral-900 dark:text-neutral-50',
                          'border-neutral-300 dark:border-neutral-500 focus:border-primary-600 focus:ring-primary-600/20',
                          'pl-6 pr-3'
                        )}
                      />
                    )}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-[#262626]">
                <span className="text-xs text-neutral-500">{t('items.total')}</span>
                <span className="font-bold text-neutral-900 dark:text-neutral-100">
                  ${lineTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              {/* Cost tracking - mobile (single total cost) */}
              <div className="pt-2 mt-2 border-t border-neutral-200 dark:border-[#262626]">
                <p className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
                  {t('items.costTracking')}
                </p>
                <div>
                  <label className="block text-[10px] text-neutral-500 mb-0.5">
                    {t('items.cost')}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">$</span>
                    <Controller
                      control={control}
                      name={`items.${index}.cost_usd`}
                      render={({ field: f }) => (
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={f.value === undefined || f.value === null || f.value === '' ? '' : Number(f.value)}
                          onChange={(e) => {
                            const v = e.target.value;
                            f.onChange(v === '' ? null : (parseFloat(v) || 0));
                          }}
                          onBlur={f.onBlur}
                          className={cn(
                            'block w-full h-10 rounded border text-sm pl-8 pr-3',
                            'bg-white dark:bg-[#171717] text-neutral-900 dark:text-neutral-50 border-neutral-200 dark:border-[#262626]'
                          )}
                        />
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Totals: Subtotal, Discount, Grand Total */}
      <div className="pt-4 border-t-2 border-neutral-300 dark:border-[#333] space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-600 dark:text-neutral-400">{t('detail.subtotal')}</span>
          <span className="text-neutral-900 dark:text-neutral-100">${formatUsd(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <label className="text-sm text-neutral-600 dark:text-neutral-400 shrink-0">
            {t('form.fields.discountPercent')}
          </label>
          <Input
            type="number"
            min={0}
            max={100}
            step={0.01}
            placeholder="0"
            wrapperClassName="max-w-[120px]"
            error={errors.discount_percent?.message}
            {...register('discount_percent')}
          />
        </div>
        {discountPercent > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-600 dark:text-neutral-400">{t('detail.discountAmount')}</span>
            <span className="text-neutral-900 dark:text-neutral-100">-${formatUsd(discountAmount)}</span>
          </div>
        )}
        <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-[#333]">
          <span className="text-sm font-bold text-neutral-700 dark:text-neutral-300 uppercase">
            {t('detail.total')}
          </span>
          <span className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            ${formatUsd(grandTotal)}
          </span>
        </div>
        {/* Net Kar (internal only) */}
        <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-[#333]">
          <span className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">
            {t('detail.netProfit')} (Dahili)
          </span>
          <span className={cn(
            'text-lg font-bold',
            netProfit >= 0 
              ? 'text-green-600 dark:text-green-500' 
              : 'text-error-600 dark:text-error-400'
          )}>
            ${formatUsd(netProfit)}
          </span>
        </div>
      </div>

      {errors?.items?.root?.message && (
        <p className="text-sm text-error-600 dark:text-error-400">
          {errors.items.root.message}
        </p>
      )}
      {errors?.items?.message && (
        <p className="text-sm text-error-600 dark:text-error-400">
          {errors.items.message}
        </p>
      )}
    </div>
  );
}
