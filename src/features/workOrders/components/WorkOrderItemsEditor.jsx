import { useFieldArray, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Package } from 'lucide-react';
import { Button, Input, MaterialCombobox } from '../../../components/ui';
import { cn, getCurrencySymbol, formatCurrency } from '../../../lib/utils';

const UNIT_OPTIONS = [
  { value: 'adet', labelKey: 'items.units.adet' },
  { value: 'metre', labelKey: 'items.units.metre' },
  { value: 'set', labelKey: 'items.units.set' },
  { value: 'takim', labelKey: 'items.units.takim' },
];

export function WorkOrderItemsEditor({ control, register, errors, watch, setValue, currency = 'TRY' }) {
  const { t } = useTranslation('proposals');
  const symbol = getCurrencySymbol(currency);
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const watchItems = watch('items');
  const discountPercent = Number(watch('materials_discount_percent')) || 0;
  const subtotal = (watchItems || []).reduce((sum, item) => {
    const qty = parseFloat(item?.quantity) || 0;
    const price = parseFloat(item?.unit_price) || 0;
    return sum + qty * price;
  }, 0);
  const discountAmount = subtotal * (discountPercent / 100);
  const grandTotal = subtotal - discountAmount;
  const totalCosts = (watchItems || []).reduce((sum, item) => {
    const qty = parseFloat(item?.quantity) || 0;
    const cost = parseFloat(item?.cost) || 0;
    return sum + cost * qty;
  }, 0);
  const netProfit = grandTotal - totalCosts;

  const handleAddItem = () => {
    append({
      description: '',
      quantity: 1,
      unit: 'adet',
      unit_price: 0,
      material_id: null,
      cost: null,
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
            {t('items.material')}
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
          const price = parseFloat(watchItems?.[index]?.unit_price) || 0;
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
                    mode="proposals"
                    value={watchItems?.[index]?.description || ''}
                    placeholder={t('items.material')}
                    onMaterialSelect={(payload) => {
                      setValue(`items.${index}.description`, payload.description, { shouldValidate: true });
                      setValue(`items.${index}.material_id`, payload.material_id ?? null);
                      if (payload.unit) setValue(`items.${index}.unit`, payload.unit);
                    }}
                    onDescriptionChange={(val) => {
                      setValue(`items.${index}.description`, val, { shouldValidate: true });
                      setValue(`items.${index}.material_id`, null);
                    }}
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
                  <span className="absolute inset-y-0 left-3 flex items-center text-neutral-400 text-xs pointer-events-none z-10" aria-hidden>{symbol}</span>
                  <Controller
                    control={control}
                    name={`items.${index}.unit_price`}
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
                    {formatCurrency(lineTotal, currency)}
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
                      name={`items.${index}.cost`}
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
          const price = parseFloat(watchItems?.[index]?.unit_price) || 0;
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

              <div>
                <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  {t('items.material')}
                </label>
                <MaterialCombobox
                  mode="proposals"
                  value={watchItems?.[index]?.description || ''}
                  placeholder={t('items.material')}
                  onMaterialSelect={(payload) => {
                    setValue(`items.${index}.description`, payload.description, { shouldValidate: true });
                    setValue(`items.${index}.material_id`, payload.material_id ?? null);
                    if (payload.unit) setValue(`items.${index}.unit`, payload.unit);
                  }}
                  onDescriptionChange={(val) => {
                    setValue(`items.${index}.description`, val, { shouldValidate: true });
                    setValue(`items.${index}.material_id`, null);
                  }}
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
                    render={({ field: f }) => (
                      <select
                        value={f.value ?? 'adet'}
                        onChange={(e) => f.onChange(e.target.value)}
                        onBlur={f.onBlur}
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
                    {symbol}
                  </span>
                  <Controller
                    control={control}
                    name={`items.${index}.unit_price`}
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
                  {formatCurrency(lineTotal, currency)}
                </span>
              </div>
              <div className="pt-2 mt-2 border-t border-neutral-200 dark:border-[#262626]">
                <p className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
                  {t('items.costTracking')}
                </p>
                <div>
                  <label className="block text-[10px] text-neutral-500 mb-0.5">
                    {t('items.cost')}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">{symbol}</span>
                    <Controller
                      control={control}
                      name={`items.${index}.cost`}
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

      {/* Totals */}
      <div className="pt-4 border-t-2 border-neutral-300 dark:border-[#333] space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-600 dark:text-neutral-400">{t('detail.subtotal')}</span>
          <span className="text-neutral-900 dark:text-neutral-100">{formatCurrency(subtotal, currency)}</span>
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
            error={errors.materials_discount_percent?.message}
            {...register('materials_discount_percent')}
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
            {t('detail.total')}
          </span>
          <span className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            {formatCurrency(grandTotal, currency)}
          </span>
        </div>
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
            {formatCurrency(netProfit, currency)}
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
