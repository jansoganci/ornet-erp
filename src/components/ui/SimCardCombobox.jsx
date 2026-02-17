import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Search, Check, Plus } from 'lucide-react';
import { Spinner } from './Spinner';
import { Badge } from './Badge';
import { useSimCardsForSubscription } from '../../features/simCards/hooks';
import { cn } from '../../lib/utils';

/**
 * Searchable SIM card combobox for subscription form.
 * Same design as MaterialCombobox - search bar with dropdown results.
 *
 * @param {object} props
 * @param {string} props.value - sim_card_id (uuid)
 * @param {object|null} props.selectedSim - SIM object for display when closed
 * @param {function} props.onChange - (sim_card_id) => void
 * @param {function} [props.onSelect] - (sim) => void
 * @param {string} props.siteId - Required for filtering eligible SIMs
 * @param {string} [props.label]
 * @param {string} [props.placeholder]
 * @param {string} [props.error]
 * @param {boolean} [props.disabled]
 */
export function SimCardCombobox({
  value,
  selectedSim = null,
  onChange,
  onSelect,
  siteId,
  label,
  placeholder,
  error,
  disabled,
}) {
  const { t } = useTranslation(['simCards', 'subscriptions']);
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  const { data: simCards = [], isLoading } = useSimCardsForSubscription(siteId, search);

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

  const handleSelect = (sim) => {
    onChange?.(sim.id);
    onSelect?.(sim);
    setIsOpen(false);
    setSearch('');
  };

  const handleClear = () => {
    onChange?.('');
    onSelect?.(null);
    setSearch('');
    setIsOpen(false);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    if (!val.trim() && value) {
      onChange?.('');
      onSelect?.(null);
    }
    if (!isOpen && val.length >= 0) setIsOpen(true);
  };

  const handleFocus = () => {
    if (!disabled) setIsOpen(true);
  };

  const displayValue = selectedSim
    ? `${selectedSim.phone_number} (${t(`simCards:operators.${selectedSim.operator}`)})`
    : '';

  const isSelected = (sim) => value === sim.id;

  const defaultPlaceholder = disabled
    ? t('subscriptions:form.fields.simCardSelectSiteFirst', 'Önce lokasyon seçin')
    : t('subscriptions:form.fields.noSim');

  return (
    <div ref={dropdownRef} className="relative">
      {label && (
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? search : displayValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={placeholder ?? defaultPlaceholder}
          disabled={disabled}
          className={cn(
            'block w-full h-9 rounded-lg border shadow-sm text-sm transition-colors',
            'placeholder:text-neutral-500 dark:placeholder:text-neutral-600',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            'bg-white dark:bg-[#171717] text-neutral-900 dark:text-neutral-50',
            'pl-9 pr-3',
            disabled && 'opacity-60 cursor-not-allowed',
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

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#171717] border border-neutral-200 dark:border-[#262626] rounded-lg shadow-xl max-h-60 flex flex-col overflow-hidden">
          <div className="overflow-y-auto flex-1 py-1">
            {isLoading ? (
              <div className="p-3 flex justify-center">
                <Spinner size="sm" />
              </div>
            ) : simCards.length === 0 ? (
              <div className="p-3 text-center">
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                  {t('simCards:list.empty.title', 'SIM kart bulunamadı')}
                </p>
                {search && (
                  <p className="text-xs text-neutral-400">
                    {t('subscriptions:form.fields.simCardSearchHint', 'Farklı bir arama deneyin veya yeni SIM ekleyin')}
                  </p>
                )}
              </div>
            ) : (
              <>
                {value && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClear();
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 border-b border-neutral-100 dark:border-neutral-800"
                  >
                    {t('subscriptions:form.fields.simCardClearSelection', 'Seçimi kaldır')}
                  </button>
                )}
                {simCards.map((sim) => (
                  <button
                    type="button"
                    key={sim.id}
                    className={cn(
                      'w-full px-3 py-2 text-left flex items-center justify-between hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors',
                      isSelected(sim) && 'bg-primary-50 dark:bg-primary-900/30'
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(sim);
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 truncate">
                          {sim.phone_number}
                        </span>
                        <Badge variant="default" size="sm">
                          {t(`simCards:operators.${sim.operator}`)}
                        </Badge>
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                        {sim.buyer?.company_name || '-'}
                      </p>
                    </div>
                    {isSelected(sim) && (
                      <Check className="w-4 h-4 text-primary-600 shrink-0 ml-2" />
                    )}
                  </button>
                ))}
              </>
            )}
          </div>
          <div className="p-1.5 border-t border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#1a1a1a]">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/sim-cards/new');
                setIsOpen(false);
              }}
              className="text-xs text-primary-600 dark:text-primary-400 font-medium flex items-center justify-center gap-1 hover:underline py-1 w-full"
            >
              <Plus className="w-3 h-3" />
              {t('simCards:actions.add', 'Yeni SIM Kart Ekle')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
