import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Check } from 'lucide-react';
import { Spinner } from '../../../components/ui/Spinner';
import { useWorkOrders } from '../../workOrders/hooks';
import { cn } from '../../../lib/utils';

export function WorkOrderCombobox({ value, selectedWorkOrder: selectedWoProp, onSelect, placeholder, error, proposalId }) {
  const { t } = useTranslation(['finance', 'common']);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);

  const { data: workOrders = [], isLoading } = useWorkOrders({
    search: search.trim() || undefined,
  });

  const selectedWo = selectedWoProp || workOrders.find((wo) => wo.id === value);

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

  const handleSelect = (wo) => {
    onSelect?.(wo);
    setIsOpen(false);
    setSearch('');
  };

  const handleClear = () => {
    onSelect?.(null);
    setSearch('');
    setIsOpen(false);
  };

  const handleInputChange = (e) => {
    setSearch(e.target.value);
    if (!isOpen) setIsOpen(true);
  };

  const displayValue = selectedWo
    ? `${selectedWo.form_no || selectedWo.id?.slice(0, 8)} — ${selectedWo.company_name || ''}`.trim()
    : '';

  return (
    <div ref={dropdownRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={isOpen ? search : displayValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder ?? t('income.placeholders.workOrder')}
          className={cn(
            'block w-full h-10 rounded-lg border shadow-sm text-sm transition-colors',
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
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#171717] border border-neutral-200 dark:border-[#262626] rounded-lg shadow-xl max-h-60 overflow-y-auto">
          {isLoading ? (
            <div className="p-3 flex justify-center">
              <Spinner size="sm" />
            </div>
          ) : workOrders.length === 0 ? (
            <div className="p-3 text-center text-sm text-neutral-500">
              {t('income.placeholders.noWorkOrders', 'İş emri bulunamadı')}
            </div>
          ) : (
            <>
              {value && (
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm text-primary-600 dark:text-primary-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                  onClick={handleClear}
                >
                  {t('common:actions.clear', 'Temizle')}
                </button>
              )}
              {workOrders.map((wo) => (
                <button
                  type="button"
                  key={wo.id}
                  className={cn(
                    'w-full px-3 py-2 text-left flex items-center justify-between hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors',
                    value === wo.id && 'bg-primary-50 dark:bg-primary-900/30'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(wo);
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 truncate block">
                      {wo.form_no || wo.id?.slice(0, 8)}
                    </span>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400 truncate block">
                      {wo.company_name || wo.account_no || '-'}
                    </span>
                  </div>
                  {value === wo.id && (
                    <Check className="w-4 h-4 text-primary-600 shrink-0 ml-2" />
                  )}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
