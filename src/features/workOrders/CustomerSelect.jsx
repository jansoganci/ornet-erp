import { useState, useMemo, forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, UserPlus, Check } from 'lucide-react';
import { useCustomers } from '../customers/hooks';
import { Input, Card, Spinner } from '../../components/ui';
import { cn } from '../../lib/utils';
import { Link } from 'react-router-dom';

export const CustomerSelect = forwardRef(({ value, onChange, error, label }, ref) => {
  const { t } = useTranslation('workOrders');
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  
  const { data: customers, isLoading } = useCustomers({ search });

  const selectedCustomer = useMemo(() => {
    if (!value || !customers) return null;
    return customers.find(c => c.id === value);
  }, [value, customers]);

  const handleSelect = (customer) => {
    onChange(customer.id);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div ref={ref} className="space-y-1 relative">
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
          {selectedCustomer ? (
            <span className="font-medium text-neutral-900 dark:text-neutral-50 truncate">
              {selectedCustomer.name}
            </span>
          ) : (
            <span className="text-neutral-500 dark:text-neutral-500">
              {t('form.placeholders.selectCustomer')}
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
              placeholder={t('form.placeholders.searchCustomer')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          
          <div className="overflow-y-auto flex-1 py-1 bg-white dark:bg-[#171717]">
            {isLoading ? (
              <div className="p-4 flex justify-center">
                <Spinner size="sm" />
              </div>
            ) : customers?.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-2">
                  {t('form.customerSelect.noResults')}
                </p>
                <Link 
                  to="/customers/new" 
                  className="text-sm text-primary-600 dark:text-primary-400 font-medium flex items-center justify-center gap-1 hover:underline"
                >
                  <UserPlus className="w-4 h-4" />
                  {t('form.customerSelect.addNew')}
                </Link>
              </div>
            ) : (
              customers?.map((customer) => (
                <div
                  key={customer.id}
                  className={cn(
                    "px-4 py-2 cursor-pointer flex items-center justify-between hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors",
                    value === customer.id && "bg-primary-50 dark:bg-primary-900/30"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(customer);
                  }}
                >
                  <div>
                    <p className="font-medium text-neutral-900 dark:text-neutral-50">{customer.name}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">{customer.phone}</p>
                  </div>
                  {value === customer.id && <Check className="w-4 h-4 text-primary-600 dark:text-primary-400" />}
                </div>
              ))
            )}
          </div>
          
          <div className="p-2 border-t border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#1a1a1a]">
            <Link 
              to="/customers/new" 
              className="text-xs text-primary-600 dark:text-primary-400 font-medium flex items-center justify-center gap-1 hover:underline py-1"
            >
              <UserPlus className="w-3 h-3" />
              {t('form.customerSelect.addNew')}
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
});

CustomerSelect.displayName = 'CustomerSelect';
