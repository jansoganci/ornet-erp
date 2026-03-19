import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Check, ChevronDown } from 'lucide-react';
import { Spinner } from '../../../components/ui/Spinner';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useCustomers } from '../../customers/hooks';
import { useSitesByCustomer } from '../../customerSites/hooks';
import { useCreateServiceRequest } from '../hooks';
import { normalizeForSearch } from '../../../lib/normalizeForSearch';
import { cn } from '../../../lib/utils';

function detectRegion(city, district) {
  const istanbul = normalizeForSearch(city) === 'istanbul';
  if (!istanbul) return 'outside_istanbul';

  const europeanDistricts = [
    'fatih', 'beyoglu', 'sisli', 'besiktas', 'bakirkoy',
    'bayrampasa', 'eyupsultan', 'kagithane', 'sariyer',
    'zeytinburnu', 'gungoren', 'esenler', 'bagcilar',
    'bahcelievler', 'avcilar', 'kucukcekmece', 'buyukcekmece',
    'basaksehir', 'sultangazi', 'arnavutkoy', 'catalca',
    'esenyurt', 'beylikduzu', 'silivri',
  ];

  const normalizedDistrict = normalizeForSearch(district);
  return europeanDistricts.includes(normalizedDistrict)
    ? 'istanbul_europe'
    : 'istanbul_anatolia';
}

export function QuickEntryRow() {
  const { t } = useTranslation('operations');
  const createMutation = useCreateServiceRequest();

  // Customer search
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerOpen, setCustomerOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const debouncedCustomerSearch = useDebouncedValue(customerSearch, 300);
  const customerRef = useRef(null);

  // Site selection
  const [siteOpen, setSiteOpen] = useState(false);
  const [selectedSite, setSelectedSite] = useState(null);
  const siteRef = useRef(null);

  // Description
  const [description, setDescription] = useState('');
  const descRef = useRef(null);

  const { data: customers = [], isLoading: customersLoading } = useCustomers({ search: debouncedCustomerSearch });
  const { data: sites = [] } = useSitesByCustomer(selectedCustomer?.id);

  // Auto-select when customer has exactly one site
  const autoSiteId = sites.length === 1 ? sites[0].id : null;
  useEffect(() => {
    if (autoSiteId && sites.length === 1) {
      setSelectedSite(sites[0]);
    } else if (sites.length === 0) {
      setSelectedSite(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSiteId]);

  // Click outside handlers
  useEffect(() => {
    const handler = (e) => {
      if (customerRef.current && !customerRef.current.contains(e.target)) setCustomerOpen(false);
      if (siteRef.current && !siteRef.current.contains(e.target)) setSiteOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer);
    setCustomerSearch('');
    setCustomerOpen(false);
    setSelectedSite(null);
    // Focus site field next, or description if only 1 site
    setTimeout(() => {
      if (sites.length <= 1) {
        descRef.current?.focus();
      }
    }, 50);
  };

  const handleSiteSelect = (site) => {
    setSelectedSite(site);
    setSiteOpen(false);
    descRef.current?.focus();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedCustomer || !description.trim()) return;

    const region = selectedSite
      ? detectRegion(selectedSite.city, selectedSite.district)
      : 'istanbul_europe';

    createMutation.mutate(
      {
        customer_id: selectedCustomer.id,
        site_id: selectedSite?.id || null,
        description: description.trim(),
        region,
      },
      {
        onSuccess: () => {
          setSelectedCustomer(null);
          setSelectedSite(null);
          setDescription('');
          setCustomerSearch('');
          customerRef.current?.querySelector('input')?.focus();
        },
      }
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 p-3 bg-neutral-50 dark:bg-[#0f0f0f] rounded-lg border border-neutral-200 dark:border-[#262626]"
    >
      {/* Plus icon */}
      <div className="flex items-center justify-center w-8 h-9 text-primary-600 dark:text-primary-400 shrink-0">
        <Plus className="w-5 h-5" />
      </div>

      {/* Customer combobox */}
      <div ref={customerRef} className="relative flex-1 min-w-0 max-w-[200px]">
        <div className="relative">
          <input
            type="text"
            value={customerOpen ? customerSearch : (selectedCustomer?.company_name || '')}
            onChange={(e) => {
              setCustomerSearch(e.target.value);
              if (!customerOpen) setCustomerOpen(true);
              if (!e.target.value && selectedCustomer) {
                setSelectedCustomer(null);
                setSelectedSite(null);
              }
            }}
            onFocus={() => setCustomerOpen(true)}
            placeholder={t('quickEntry.customerPlaceholder')}
            className="block w-full h-9 rounded-lg border border-neutral-300 dark:border-[#262626] shadow-sm text-sm bg-white dark:bg-[#171717] text-neutral-900 dark:text-neutral-50 pl-8 pr-3 placeholder:text-neutral-500 dark:placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600"
          />
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
        </div>
        {customerOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#171717] border border-neutral-200 dark:border-[#262626] rounded-lg shadow-xl max-h-48 overflow-y-auto py-1">
            {customersLoading ? (
              <div className="p-3 flex justify-center"><Spinner size="sm" /></div>
            ) : customers.length === 0 ? (
              <p className="p-3 text-xs text-neutral-500 text-center">{t('filters.search')}</p>
            ) : (
              customers.slice(0, 20).map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => handleCustomerSelect(c)}
                  className={cn(
                    'w-full px-3 py-2 text-left text-sm hover:bg-primary-50 dark:hover:bg-primary-900/20',
                    selectedCustomer?.id === c.id && 'bg-primary-50 dark:bg-primary-900/30'
                  )}
                >
                  <span className="font-medium text-neutral-900 dark:text-neutral-50 truncate block">{c.company_name}</span>
                  {c.phone && <span className="text-xs text-neutral-500 truncate block">{c.phone}</span>}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Site dropdown */}
      <div ref={siteRef} className="relative flex-1 min-w-0 max-w-[180px]">
        <button
          type="button"
          onClick={() => selectedCustomer && setSiteOpen(!siteOpen)}
          disabled={!selectedCustomer}
          className={cn(
            'flex items-center justify-between w-full h-9 rounded-lg border shadow-sm text-sm px-3',
            'bg-white dark:bg-[#171717] border-neutral-300 dark:border-[#262626]',
            'focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600',
            !selectedCustomer && 'opacity-50 cursor-not-allowed',
          )}
        >
          <span className={cn(
            'truncate',
            selectedSite ? 'text-neutral-900 dark:text-neutral-50' : 'text-neutral-500 dark:text-neutral-600',
          )}>
            {selectedSite?.site_name || t('quickEntry.sitePlaceholder')}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-neutral-400 shrink-0 ml-1" />
        </button>
        {siteOpen && sites.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#171717] border border-neutral-200 dark:border-[#262626] rounded-lg shadow-xl max-h-48 overflow-y-auto py-1">
            {sites.map((s) => (
              <button
                type="button"
                key={s.id}
                onClick={() => handleSiteSelect(s)}
                className={cn(
                  'w-full px-3 py-2 text-left text-sm hover:bg-primary-50 dark:hover:bg-primary-900/20 flex items-center justify-between',
                  selectedSite?.id === s.id && 'bg-primary-50 dark:bg-primary-900/30'
                )}
              >
                <div className="min-w-0">
                  <span className="text-neutral-900 dark:text-neutral-50 truncate block">{s.site_name}</span>
                  {s.account_no && <span className="text-xs text-neutral-500 truncate block">{s.account_no}</span>}
                </div>
                {selectedSite?.id === s.id && <Check className="w-3.5 h-3.5 text-primary-600 shrink-0" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Description */}
      <div className="flex-[2] min-w-0">
        <input
          ref={descRef}
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('quickEntry.descriptionPlaceholder')}
          className="block w-full h-9 rounded-lg border border-neutral-300 dark:border-[#262626] shadow-sm text-sm bg-white dark:bg-[#171717] text-neutral-900 dark:text-neutral-50 px-3 placeholder:text-neutral-500 dark:placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600"
        />
      </div>

      {/* Submit hint */}
      <button
        type="submit"
        disabled={!selectedCustomer || !description.trim() || createMutation.isPending}
        className={cn(
          'shrink-0 h-9 px-3 rounded-lg text-xs font-medium transition-colors',
          selectedCustomer && description.trim()
            ? 'bg-primary-600 hover:bg-primary-700 text-white'
            : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed',
        )}
      >
        {createMutation.isPending ? <Spinner size="sm" /> : t('quickEntry.hint')}
      </button>
    </form>
  );
}
