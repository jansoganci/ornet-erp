import { useState, useMemo, forwardRef, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Package, Check, Plus } from 'lucide-react';
import { useMaterials, useMaterial } from '../materials/hooks';
import { Input, Card, Spinner, Badge } from '../../components/ui';
import { cn } from '../../lib/utils';
import { MaterialFormModal } from '../materials/MaterialFormModal';

export const MaterialAutocomplete = forwardRef(({ value, onChange, error, label, onMaterialSelect }, ref) => {
  const { t } = useTranslation(['workOrders', 'materials']);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [localSelectedMaterial, setLocalSelectedMaterial] = useState(null);
  const dropdownRef = useRef(null);
  const lastValueRef = useRef(null);

  // Debounce search input (300ms)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, [search]);

  // Normalize filters for consistent query key
  const materialsFilters = useMemo(() => {
    const filters = { active: true };
    if (debouncedSearch && debouncedSearch.trim()) {
      filters.search = debouncedSearch.trim();
    }
    return filters;
  }, [debouncedSearch]);

  // Fetch materials with search filter
  const { data: materials = [], isLoading } = useMaterials(materialsFilters);

  // Always fetch selected material separately when value exists
  const { data: selectedMaterialData } = useMaterial(value || null);

  // Sync localSelectedMaterial when value or data sources change
  useEffect(() => {
    if (!value) {
      if (lastValueRef.current !== null) {
        setLocalSelectedMaterial(null);
        lastValueRef.current = null;
      }
      return;
    }
    
    // Skip if we already have this material set
    if (lastValueRef.current === value && localSelectedMaterial && localSelectedMaterial.id === value) {
      return;
    }
    
    // Try to find in filtered list
    const materialInList = materials?.find(m => m.id === value);
    if (materialInList) {
      setLocalSelectedMaterial(materialInList);
      lastValueRef.current = value;
      return;
    }
    // Otherwise use separately fetched material
    if (selectedMaterialData && selectedMaterialData.id === value) {
      setLocalSelectedMaterial(selectedMaterialData);
      lastValueRef.current = value;
    }
  }, [value, materials, selectedMaterialData, localSelectedMaterial]);

  const selectedMaterial = useMemo(() => {
    if (!value) return null;
    // First check local state (most recent selection)
    if (localSelectedMaterial && localSelectedMaterial.id === value) {
      return localSelectedMaterial;
    }
    // Then try to find in filtered list
    const materialInList = materials?.find(m => m.id === value);
    if (materialInList) return materialInList;
    // Otherwise use separately fetched material
    if (selectedMaterialData) return selectedMaterialData;
    return null;
  }, [value, materials, selectedMaterialData, localSelectedMaterial]);

  const handleSelect = (material) => {
    // Store material locally immediately
    setLocalSelectedMaterial(material);
    lastValueRef.current = material.id;
    onChange(material.id);
    if (onMaterialSelect) {
      onMaterialSelect(material);
    }
    setIsOpen(false);
    setSearch('');
  };

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  // Handle Escape key to close dropdown
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setSearch('');
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleCreateSuccess = (newMaterial) => {
    // Store material locally immediately
    setLocalSelectedMaterial(newMaterial);
    lastValueRef.current = newMaterial.id;
    // Auto-select the newly created material
    onChange(newMaterial.id);
    if (onMaterialSelect) {
      onMaterialSelect(newMaterial);
    }
    setIsOpen(false);
    setSearch('');
    setShowCreateModal(false);
  };

  return (
    <div
      ref={(node) => {
        dropdownRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      }}
      className="space-y-1 relative"
    >
      {label && (
        <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
          {label}
        </label>
      )}
      
      <div 
        className={cn(
          "flex items-center justify-between w-full px-3 py-2 bg-white dark:bg-[#171717] border rounded-md cursor-pointer transition-colors shadow-sm",
          error ? "border-error-500" : "border-neutral-300 dark:border-[#262626] hover:border-primary-500 dark:hover:border-primary-400",
          isOpen && "ring-2 ring-primary-500/20 border-primary-500"
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {selectedMaterial ? (
            <span className="font-medium text-neutral-900 dark:text-neutral-50 truncate">
              {selectedMaterial.code} - {selectedMaterial.name}
            </span>
          ) : (
            <span className="text-neutral-500 dark:text-neutral-500">
              {t('materials:list.searchPlaceholder')}
            </span>
          )}
        </div>
        <Search className="w-4 h-4 text-neutral-400 dark:text-neutral-500 shrink-0" />
      </div>

      {error && <p className="text-xs text-error-600 dark:text-error-400">{error}</p>}

      {isOpen && (
        <Card className="absolute z-50 w-full mt-1 p-0 shadow-xl border border-neutral-200 dark:border-[#262626] max-h-80 flex flex-col overflow-hidden animate-slide-up">
          <div className="p-2 border-b border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#1a1a1a]">
            <Input
              autoFocus
              placeholder={t('materials:list.searchPlaceholder')}
              value={search}
              onChange={(e) => {
                const v = e.target.value;
                setSearch(v);
                if (v.trim()) {
                  onChange('');
                  if (onMaterialSelect) onMaterialSelect(null);
                }
              }}
              className="h-9"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          
          <div className="overflow-y-auto flex-1 py-1 bg-white dark:bg-[#171717]">
            {isLoading ? (
              <div className="p-4 flex justify-center">
                <Spinner size="sm" />
              </div>
            ) : materials?.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-2">
                  {t('workOrders:form.materialSelect.noResults', 'Malzeme bulunamadı')}
                </p>
                {search && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCreateModal(true);
                    }}
                    className="text-sm text-primary-600 dark:text-primary-400 font-medium flex items-center justify-center gap-1 hover:underline mx-auto"
                  >
                    <Plus className="w-4 h-4" />
                    {t('workOrders:form.materialSelect.addNew', 'Yeni Malzeme Ekle')}
                  </button>
                )}
              </div>
            ) : (
              materials?.map((material) => (
                <div
                  key={material.id}
                  className={cn(
                    "px-4 py-2 cursor-pointer flex items-center justify-between hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors",
                    value === material.id && "bg-primary-50 dark:bg-primary-900/30"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(material);
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-neutral-900 dark:text-neutral-50 truncate">
                        {material.code}
                      </p>
                      {material.category && (
                        <Badge variant="secondary" size="sm">
                          {t(`materials:categories.${material.category}`)}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                      {material.name}
                    </p>
                  </div>
                  {value === material.id && <Check className="w-4 h-4 text-primary-600 dark:text-primary-400 shrink-0 ml-2" />}
                </div>
              ))
            )}
          </div>
          
          <div className="p-2 border-t border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#1a1a1a]">
            <button
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
        </Card>
      )}

      <MaterialFormModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
});

MaterialAutocomplete.displayName = 'MaterialAutocomplete';
