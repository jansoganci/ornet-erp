import { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Check } from 'lucide-react';
import { Spinner } from './Spinner';
import { Badge } from './Badge';
import { useMaterials } from '../../features/materials/hooks';
import { MaterialFormModal } from '../../features/materials/MaterialFormModal';
import { cn } from '../../lib/utils';

/**
 * Shared material selection combobox.
 * Supports two modes: proposals (free text + material) and work orders (material only).
 *
 * @param {object} props
 * @param {string} props.value - Display value (proposals: description string; work orders: material_id)
 * @param {object|null} props.selectedMaterial - For work orders: material object for display when closed
 * @param {'proposals'|'workOrders'} props.mode
 * @param {function} props.onMaterialSelect - Called when material selected. Proposals: (payload) => void. Work orders: (material) => void
 * @param {function} [props.onDescriptionChange] - Proposals only: called when user types (clears material)
 * @param {function} [props.onChange] - Work orders only: (material_id) => void
 * @param {string} [props.placeholder]
 * @param {string} [props.error]
 */
export function MaterialCombobox({
  value,
  selectedMaterial = null,
  mode = 'proposals',
  onMaterialSelect,
  onDescriptionChange,
  onChange,
  placeholder,
  error,
}) {
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

  // Sort: name matches before code matches (case-insensitive)
  const sortedMaterials = useMemo(() => {
    if (!search.trim()) return materials;
    const term = search.trim().toLowerCase();
    return [...materials].sort((a, b) => {
      const aNameMatch = (a.name || '').toLowerCase().includes(term);
      const aCodeMatch = (a.code || '').toLowerCase().includes(term);
      const bNameMatch = (b.name || '').toLowerCase().includes(term);
      const bCodeMatch = (b.code || '').toLowerCase().includes(term);
      const aScore = aNameMatch ? 2 : aCodeMatch ? 1 : 0;
      const bScore = bNameMatch ? 2 : bCodeMatch ? 1 : 0;
      return bScore - aScore; // higher first
    });
  }, [materials, search]);

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
    if (mode === 'proposals') {
      onMaterialSelect?.({
        description: material.name,
        material_id: material.id,
        unit: material.unit || 'adet',
      });
    } else {
      onChange?.(material.id);
      onMaterialSelect?.(material);
    }
    setIsOpen(false);
    setSearch('');
  };

  const handleCreateSuccess = (newMaterial) => {
    if (mode === 'proposals') {
      onMaterialSelect?.({
        description: newMaterial.name,
        material_id: newMaterial.id,
        unit: newMaterial.unit || 'adet',
      });
    } else {
      onChange?.(newMaterial.id);
      onMaterialSelect?.(newMaterial);
    }
    setShowCreateModal(false);
    setIsOpen(false);
    setSearch('');
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    if (mode === 'proposals') {
      onDescriptionChange?.(val);
    } else {
      if (val.trim()) {
        onChange?.('');
        onMaterialSelect?.(null);
      }
    }
    if (!isOpen && val.length > 0) setIsOpen(true);
  };

  const handleFocus = () => {
    setIsOpen(true);
  };

  const displayValue = mode === 'workOrders' && selectedMaterial
    ? `${selectedMaterial.name} (${selectedMaterial.code})`
    : value || '';

  const isSelected = (material) =>
    mode === 'proposals' ? value === material.name : value === material.id;

  const defaultPlaceholder =
    mode === 'proposals'
      ? t('proposals:items.material')
      : t('materials:list.searchPlaceholder');

  return (
    <div ref={dropdownRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? search : displayValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={placeholder ?? defaultPlaceholder}
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
            ) : sortedMaterials.length === 0 ? (
              <div className="p-3 text-center">
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                  {t('workOrders:form.materialSelect.noResults', 'Malzeme bulunamadı')}
                </p>
                {search && (
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
                )}
              </div>
            ) : (
              sortedMaterials.map((material) => (
                <button
                  type="button"
                  key={material.id}
                  className={cn(
                    'w-full px-3 py-2 text-left flex items-center justify-between hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors',
                    isSelected(material) && 'bg-primary-50 dark:bg-primary-900/30'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(material);
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 truncate">
                        {material.name}
                      </span>
                      {material.category && (
                        <Badge variant="default" size="sm">
                          {t(`materials:categories.${material.category}`)}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                      {material.code}
                    </p>
                  </div>
                  {isSelected(material) && (
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
