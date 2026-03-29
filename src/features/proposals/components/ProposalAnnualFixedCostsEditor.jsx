import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Input } from '../../../components/ui';
import { cn, getCurrencySymbol, formatCurrency } from '../../../lib/utils';
import { calcAnnualFixedLineTotal, sumAnnualFixedCostsByCurrency } from '../../../lib/proposalCalc';
import { ANNUAL_FIXED_COST_CURRENCIES } from '../schema';

function isPersistableAnnualRow(row) {
  return String(row?.description ?? '').trim().length > 0;
}

export function ProposalAnnualFixedCostsEditor({
  control,
  register,
  errors,
  watch,
  fields,
  append,
  remove,
}) {
  const { t } = useTranslation('proposals');
  const { t: tCommon } = useTranslation('common');
  const watchRows = watch('annual_fixed_costs') || [];

  const currencyOptions = ANNUAL_FIXED_COST_CURRENCIES.map((c) => ({
    value: c,
    label: tCommon(`currencies.${c}`),
  }));

  const handleAddRow = () => {
    append(
      {
        description: '',
        quantity: 1,
        unit: 'adet',
        unit_price: 0,
        currency: 'TRY',
      },
      { shouldFocus: false },
    );
  };

  const persistedLikeRows = (watchRows || []).filter(isPersistableAnnualRow);
  const subtotalsByCurrency = sumAnnualFixedCostsByCurrency(persistedLikeRows);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={handleAddRow}
        >
          {t('annualFixed.addRow')}
        </Button>
      </div>

      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        {t('annualFixed.hint')}
      </p>

      {fields.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400 py-2">
          {t('annualFixed.empty')}
        </p>
      ) : null}

      {/* Desktop */}
      <div className="hidden md:block">
        {fields.length > 0 && (
          <div className="grid grid-cols-[36px_minmax(160px,1fr)_72px_100px_88px_100px_100px_40px] gap-2 pb-2 border-b border-neutral-200 dark:border-[#262626]">
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-1 text-center">
              {t('items.sequence')}
            </span>
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-1">
              {t('annualFixed.description')}
            </span>
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-1">
              {t('items.quantity')}
            </span>
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-1">
              {t('items.unit')}
            </span>
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-1">
              {tCommon('fields.currency')}
            </span>
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-1">
              {t('items.unitPrice')}
            </span>
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-1 text-right">
              {t('items.total')}
            </span>
            <span />
          </div>
        )}

        {fields.map((field, index) => {
          const rowCur = watchRows?.[index]?.currency || 'TRY';
          const symbol = getCurrencySymbol(rowCur);
          const qty = parseFloat(watchRows?.[index]?.quantity) || 0;
          const price = parseFloat(watchRows?.[index]?.unit_price) || 0;
          const lineTotal = calcAnnualFixedLineTotal(qty, price);

          return (
            <div
              key={field.id}
              className="grid grid-cols-[36px_minmax(160px,1fr)_72px_100px_88px_100px_100px_40px] gap-2 py-2 border-b border-neutral-100 dark:border-[#1a1a1a] items-center min-w-0"
            >
              <div className="px-1 text-center text-sm font-medium text-neutral-500 dark:text-neutral-400 shrink-0">
                {index + 1}
              </div>
              <div className="min-w-0 px-1 w-full">
                <Controller
                  control={control}
                  name={`annual_fixed_costs.${index}.description`}
                  render={({ field: f }) => (
                    <Input
                      placeholder={t('annualFixed.description')}
                      error={errors?.annual_fixed_costs?.[index]?.description?.message}
                      ref={f.ref}
                      name={f.name}
                      value={f.value ?? ''}
                      onChange={f.onChange}
                      onBlur={f.onBlur}
                      wrapperClassName="w-full min-w-[160px]"
                      className="text-neutral-900 dark:text-neutral-50"
                    />
                  )}
                />
              </div>
              <div className="px-1 relative z-10">
                <Controller
                  control={control}
                  name={`annual_fixed_costs.${index}.quantity`}
                  render={({ field: f }) => (
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={
                        f.value === undefined || f.value === null || f.value === ''
                          ? ''
                          : typeof f.value === 'string'
                            ? f.value
                            : String(f.value)
                      }
                      onChange={(e) => f.onChange(e.target.value)}
                      onBlur={() => {
                        const v = f.value;
                        const n = typeof v === 'string' ? parseFloat(v.trim()) : Number(v);
                        f.onChange(Number.isFinite(n) && n > 0 ? n : 1);
                        f.onBlur();
                      }}
                      className={cn(
                        'block w-full h-9 rounded-lg border shadow-sm text-sm transition-colors text-center',
                        'bg-white dark:bg-[#171717] text-neutral-900 dark:text-neutral-50',
                        'border-neutral-300 dark:border-neutral-500 focus:border-primary-600 focus:ring-primary-600/20 px-2',
                      )}
                    />
                  )}
                />
              </div>
              <div className="px-1">
                <Input
                  placeholder="adet"
                  error={errors?.annual_fixed_costs?.[index]?.unit?.message}
                  {...register(`annual_fixed_costs.${index}.unit`)}
                />
              </div>
              <div className="px-1 relative z-10">
                <Controller
                  control={control}
                  name={`annual_fixed_costs.${index}.currency`}
                  render={({ field: f }) => (
                    <select
                      value={f.value ?? 'TRY'}
                      onChange={(e) => f.onChange(e.target.value)}
                      onBlur={f.onBlur}
                      className={cn(
                        'block w-full h-9 rounded-lg border shadow-sm text-sm appearance-none cursor-pointer',
                        'bg-white dark:bg-[#171717] text-neutral-900 dark:text-neutral-50 border-neutral-300 dark:border-neutral-500 px-2',
                      )}
                    >
                      {currencyOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )}
                />
              </div>
              <div className="px-1 relative z-10">
                <span
                  className="absolute inset-y-0 left-3 flex items-center text-neutral-400 text-xs pointer-events-none z-10"
                  aria-hidden
                >
                  {symbol}
                </span>
                <Controller
                  control={control}
                  name={`annual_fixed_costs.${index}.unit_price`}
                  render={({ field: f }) => (
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={
                        f.value === undefined || f.value === null || f.value === ''
                          ? ''
                          : typeof f.value === 'string'
                            ? f.value
                            : String(f.value)
                      }
                      onChange={(e) => f.onChange(e.target.value)}
                      onBlur={() => {
                        const v = f.value;
                        const n = typeof v === 'string' ? parseFloat(v.trim()) : Number(v);
                        f.onChange(Number.isFinite(n) && n >= 0 ? n : 0);
                        f.onBlur();
                      }}
                      className={cn(
                        'block w-full h-9 rounded-lg border shadow-sm text-sm relative pl-6 pr-2',
                        'bg-white dark:bg-[#171717] text-neutral-900 dark:text-neutral-50 border-neutral-300 dark:border-neutral-500',
                      )}
                    />
                  )}
                />
              </div>
              <div className="px-1 text-right">
                <span className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
                  {formatCurrency(lineTotal, rowCur)}
                </span>
              </div>
              <div className="flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="p-1 rounded text-neutral-400 hover:text-error-500 hover:bg-error-50 dark:hover:bg-error-900/20"
                  aria-label={t('annualFixed.removeRow')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile */}
      <div className="md:hidden space-y-4">
        {fields.map((field, index) => {
          const rowCur = watchRows?.[index]?.currency || 'TRY';
          const symbol = getCurrencySymbol(rowCur);
          const qty = parseFloat(watchRows?.[index]?.quantity) || 0;
          const price = parseFloat(watchRows?.[index]?.unit_price) || 0;
          const lineTotal = calcAnnualFixedLineTotal(qty, price);

          return (
            <div
              key={field.id}
              className="p-4 bg-neutral-50 dark:bg-[#1a1a1a] rounded-lg border border-neutral-200 dark:border-[#262626] space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-500 uppercase">#{index + 1}</span>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="p-1 rounded text-neutral-400 hover:text-error-500"
                  aria-label={t('annualFixed.removeRow')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <Controller
                control={control}
                name={`annual_fixed_costs.${index}.description`}
                render={({ field: f }) => (
                  <Input
                    label={t('annualFixed.description')}
                    error={errors?.annual_fixed_costs?.[index]?.description?.message}
                    ref={f.ref}
                    name={f.name}
                    value={f.value ?? ''}
                    onChange={f.onChange}
                    onBlur={f.onBlur}
                    wrapperClassName="w-full"
                    className="text-neutral-900 dark:text-neutral-50"
                  />
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                    {t('items.quantity')}
                  </label>
                  <Controller
                    control={control}
                    name={`annual_fixed_costs.${index}.quantity`}
                    render={({ field }) => (
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={
                          field.value === undefined || field.value === null || field.value === ''
                            ? ''
                            : typeof field.value === 'string'
                              ? field.value
                              : String(field.value)
                        }
                        onChange={(e) => field.onChange(e.target.value)}
                        onBlur={() => {
                          const v = field.value;
                          const n = typeof v === 'string' ? parseFloat(v.trim()) : Number(v);
                          field.onChange(Number.isFinite(n) && n > 0 ? n : 1);
                          field.onBlur();
                        }}
                        className={cn(
                          'block w-full h-10 rounded-lg border shadow-sm text-sm text-center',
                          'bg-white dark:bg-[#171717] text-neutral-900 dark:text-neutral-50 border-neutral-300 dark:border-neutral-500 px-3',
                        )}
                      />
                    )}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                    {t('items.unit')}
                  </label>
                  <Input {...register(`annual_fixed_costs.${index}.unit`)} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  {tCommon('fields.currency')}
                </label>
                <Controller
                  control={control}
                  name={`annual_fixed_costs.${index}.currency`}
                  render={({ field }) => (
                    <select
                      value={field.value ?? 'TRY'}
                      onChange={(e) => field.onChange(e.target.value)}
                      onBlur={field.onBlur}
                      className={cn(
                        'block w-full h-10 rounded-lg border shadow-sm text-sm appearance-none cursor-pointer',
                        'bg-white dark:bg-[#171717] text-neutral-900 dark:text-neutral-50 border-neutral-300 dark:border-neutral-500 px-3',
                      )}
                    >
                      {currencyOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )}
                />
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
                    name={`annual_fixed_costs.${index}.unit_price`}
                    render={({ field }) => (
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={
                          field.value === undefined || field.value === null || field.value === ''
                            ? ''
                            : typeof field.value === 'string'
                              ? field.value
                              : String(field.value)
                        }
                        onChange={(e) => field.onChange(e.target.value)}
                        onBlur={() => {
                          const v = field.value;
                          const n = typeof v === 'string' ? parseFloat(v.trim()) : Number(v);
                          field.onChange(Number.isFinite(n) && n >= 0 ? n : 0);
                          field.onBlur();
                        }}
                        className={cn(
                          'block w-full h-10 rounded-lg border shadow-sm text-sm pl-6 pr-3',
                          'bg-white dark:bg-[#171717] text-neutral-900 dark:text-neutral-50 border-neutral-300 dark:border-neutral-500',
                        )}
                      />
                    )}
                  />
                </div>
              </div>
              <div className="flex justify-between pt-2 border-t border-neutral-200 dark:border-[#262626]">
                <span className="text-xs text-neutral-500">{t('items.total')}</span>
                <span className="font-bold">{formatCurrency(lineTotal, rowCur)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {Object.keys(subtotalsByCurrency).length > 0 && (
        <div className="pt-4 border-t border-neutral-200 dark:border-[#333] space-y-1">
          {Object.entries(subtotalsByCurrency).map(([cur, sum]) => (
            <div key={cur} className="flex items-center justify-between text-sm">
              <span className="text-neutral-600 dark:text-neutral-400">
                {t('annualFixed.subtotalForCurrency', { currency: cur })}
              </span>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                {formatCurrency(sum, cur)}
              </span>
            </div>
          ))}
        </div>
      )}

      {errors?.annual_fixed_costs?.root?.message && (
        <p className="text-sm text-error-600 dark:text-error-400">{errors.annual_fixed_costs.root.message}</p>
      )}
    </div>
  );
}
