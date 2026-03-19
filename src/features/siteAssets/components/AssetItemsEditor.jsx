import { useFieldArray, useWatch, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Package } from 'lucide-react';
import { Button, MaterialCombobox } from '../../../components/ui';
import { cn } from '../../../lib/utils';

export function AssetItemsEditor({ control, register, errors, setValue }) {
  const { t } = useTranslation('siteAssets');
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });
  const watchItems = useWatch({ control, name: 'items' }) ?? [];

  const handleAddItem = () => {
    append({ equipment_name: '', quantity: 1 });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-primary-600" />
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
            {t('items.sectionTitle')}
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
        <div className="grid grid-cols-[36px_1fr_100px_40px] gap-2 pb-2 border-b border-neutral-200 dark:border-[#262626]">
          <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-1 text-center">
            {t('items.sequence')}
          </span>
          <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-1">
            {t('items.materialName')}
          </span>
          <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-1">
            {t('items.quantity')}
          </span>
          <span />
        </div>

        {fields.map((field, index) => (
          <div
            key={field.id}
            className="border-b border-neutral-100 dark:border-[#1a1a1a]"
          >
            <div className="grid grid-cols-[36px_1fr_100px_40px] gap-2 py-2 items-center">
              <div className="px-1 text-center text-sm font-medium text-neutral-500 dark:text-neutral-400">
                {index + 1}
              </div>
              <div className="px-1">
                <MaterialCombobox
                  mode="proposals"
                  value={watchItems?.[index]?.equipment_name || ''}
                  placeholder={t('placeholders.materialName')}
                  onMaterialSelect={(payload) => {
                    setValue(`items.${index}.equipment_name`, payload.description, { shouldValidate: true });
                  }}
                  onDescriptionChange={(val) => {
                    setValue(`items.${index}.equipment_name`, val, { shouldValidate: true });
                  }}
                  error={errors?.items?.[index]?.equipment_name?.message}
                />
              </div>
              <div className="px-1 relative z-10">
                <Controller
                  control={control}
                  name={`items.${index}.quantity`}
                  render={({ field: f }) => (
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={f.value === undefined || f.value === null || f.value === '' ? '' : String(f.value)}
                      onChange={(e) => f.onChange(e.target.value)}
                      onBlur={() => {
                        const v = f.value;
                        const n = typeof v === 'string' ? parseInt(v.trim(), 10) : Number(v);
                        f.onChange(Number.isFinite(n) && n >= 1 ? n : 1);
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
          </div>
        ))}
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
        {fields.map((field, index) => (
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
                {t('items.materialName')}
              </label>
              <MaterialCombobox
                mode="proposals"
                value={watchItems?.[index]?.equipment_name || ''}
                placeholder={t('placeholders.materialName')}
                onMaterialSelect={(payload) => {
                  setValue(`items.${index}.equipment_name`, payload.description, { shouldValidate: true });
                }}
                onDescriptionChange={(val) => {
                  setValue(`items.${index}.equipment_name`, val, { shouldValidate: true });
                }}
                error={errors?.items?.[index]?.equipment_name?.message}
              />
            </div>

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
                    min={1}
                    max={999}
                    value={f.value === undefined || f.value === null || f.value === '' ? '' : String(f.value)}
                    onChange={(e) => f.onChange(e.target.value)}
                    onBlur={() => {
                      const v = f.value;
                      const n = typeof v === 'string' ? parseInt(v.trim(), 10) : Number(v);
                      f.onChange(Number.isFinite(n) && n >= 1 ? n : 1);
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
          </div>
        ))}
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
