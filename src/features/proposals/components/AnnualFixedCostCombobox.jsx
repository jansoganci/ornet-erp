import { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Check } from 'lucide-react';
import { ANNUAL_FIXED_COST_PRESETS } from '../schema';
import { cn } from '../../../lib/utils';

/**
 * Combobox for annual fixed cost descriptions.
 * Shows predefined presets as suggestions. User can type any custom value.
 *
 * @param {object} props
 * @param {string} props.value - Current field value
 * @param {function} props.onChange - Called with new description value
 * @param {string} [props.placeholder]
 * @param {string} [props.error]
 */
export function AnnualFixedCostCombobox({ value, onChange, placeholder, error }) {
  const { t } = useTranslation('proposals');
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  // Filter presets based on search
  const filteredPresets = useMemo(() => {
    if (!search.trim()) return ANNUAL_FIXED_COST_PRESETS;
    const term = search.trim().toLowerCase();
    return ANNUAL_FIXED_COST_PRESETS.filter(
      (p) => p.toLowerCase().includes(term)
    );
  }, [search]);

  // Is current value a known preset?
  const isCustomValue = value && !ANNUAL_FIXED_COST_PRESETS.includes(value);

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

  const handleSelect = (preset) => {
    onChange(preset);
    setIsOpen(false);
    setSearch('');
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    onChange(val);
    if (!isOpen && val.length > 0) setIsOpen(true);
    if (val.length === 0) setIsOpen(false);
  };

  const handleFocus = () => {
    setIsOpen(true);
  };

  const displayValue = isOpen ? search : (value || '');

  return (
    <div ref={dropdownRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={placeholder || t('annualFixed.description')}
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
        <div className="absolute z-50 left-0 top-full mt-1 min-w-[280px] w-full bg-white dark:bg-[#171717] border border-neutral-200 dark:border-[#262626] rounded-lg shadow-xl max-h-48 flex flex-col overflow-hidden">
          <div className="overflow-y-auto flex-1 py-1">
            {filteredPresets.length === 0 && !isCustomValue ? (
              <div className="p-3 text-center">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {search ? 'Eşleşen kayıt yok. Kendi gider adınızı yazmaya devam edin.' : 'Henüz gider tanımı yok'}
                </p>
              </div>
            ) : (
              <>
                {filteredPresets.map((preset) => (
                  <button
                    type="button"
                    key={preset}
                    className={cn(
                      'w-full px-3 py-2 text-left flex items-center justify-between hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors',
                      value === preset && 'bg-primary-50 dark:bg-primary-900/30'
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(preset);
                    }}
                  >
                    <span className="text-sm text-neutral-900 dark:text-neutral-50 truncate">
                      {preset}
                    </span>
                    {value === preset && (
                      <Check className="w-4 h-4 text-primary-600 shrink-0 ml-2" />
                    )}
                  </button>
                ))}
                {isCustomValue && (
                  <div className="px-3 py-2 border-t border-neutral-100 dark:border-neutral-800">
                    <p className="text-xs text-primary-600 dark:text-primary-400 italic">
                      Özel değer: &quot;{value}&quot;
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
