import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, User, MapPin, Phone, Info, ChevronRight, Search } from 'lucide-react';
import { useCustomers } from '../customers/hooks';
import { useSitesByCustomer } from '../customerSites/hooks';
import { 
  SearchInput, 
  Button, 
  Select, 
  Card, 
  Badge, 
  Spinner, 
  EmptyState 
} from '../../components/ui';
import { cn } from '../../lib/utils';

export function CustomerSiteSelector({ 
  selectedCustomerId, 
  selectedSiteId, 
  onCustomerChange, 
  onSiteChange,
  onAddNewSite,
  onAddNewCustomer,
  error,
  siteOptional = false,
}) {
  const { t } = useTranslation(['workOrders', 'customers', 'common', 'proposals']);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const { data: customers = [], isLoading: isLoadingCustomers } = useCustomers({ search: searchTerm });
  
  const selectedCustomer = useMemo(() => 
    customers.find(c => c.id === selectedCustomerId), 
    [customers, selectedCustomerId]
  );

  const { data: sites = [], isLoading: isLoadingSites, refetch: refetchSites } = useSitesByCustomer(selectedCustomerId);

  const selectedSite = useMemo(() => 
    sites.find(s => s.id === selectedSiteId), 
    [sites, selectedSiteId]
  );

  const handleCustomerSelect = (customer) => {
    onCustomerChange(customer.id);
    setIsSearching(false);
    setSearchTerm('');
  };

  const handleSiteSelect = (e) => {
    const newSiteId = e.target.value;
    onSiteChange(newSiteId || '');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
          {t('workOrders:form.sections.customerSelection')}
        </h3>
      </div>

      {!selectedCustomerId || isSearching ? (
        <div className="space-y-2">
          <div className="relative">
            <SearchInput
              value={searchTerm}
              onChange={(val) => {
                setSearchTerm(val);
                setIsSearching(true);
              }}
              placeholder={t('workOrders:form.placeholders.searchCustomer')}
              className="w-full"
              autoFocus={isSearching}
            />
            
            {isSearching && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-[#171717] border border-neutral-200 dark:border-[#262626] rounded-lg shadow-xl max-h-64 overflow-y-auto">
                {isLoadingCustomers ? (
                  <div className="p-4 flex justify-center">
                    <Spinner size="sm" />
                  </div>
                ) : customers.length > 0 ? (
                  <div className="py-1">
                    {customers.map((customer) => (
                      <button
                        key={customer.id}
                        onClick={() => handleCustomerSelect(customer)}
                        className="w-full px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-[#262626] flex items-center justify-between group transition-colors"
                      >
                        <div>
                          <p className="font-medium text-neutral-900 dark:text-neutral-100">
                            {customer.company_name}
                          </p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center mt-0.5">
                            <Phone className="w-3 h-3 mr-1" />
                            {customer.phone}
                          </p>
                        </div>
                        <div className="flex items-center">
                          <Badge variant="secondary" className="mr-2">
                            {t('customers:sites.siteCount', { count: customer.sites_count || 0 })}
                          </Badge>
                          <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-primary-600 transition-colors" />
                        </div>
                      </button>
                    ))}
                  </div>
                ) : searchTerm.length > 0 ? (
                  <div className="p-4 text-center">
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-3">
                      {t('common:noResults')}
                    </p>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      leftIcon={<Plus className="w-4 h-4" />}
                      onClick={() => onAddNewCustomer(searchTerm)}
                    >
                      {t('workOrders:form.buttons.addCustomer')}
                    </Button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
          
          {!isSearching && !selectedCustomerId && (
            <Button 
              variant="outline" 
              className="w-full border-dashed" 
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => onAddNewCustomer('')}
            >
              {t('workOrders:form.buttons.addCustomer')}
            </Button>
          )}
        </div>
      ) : (
        <Card className="relative overflow-hidden border-primary-100 dark:border-primary-900/30">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary-600" />
          <div className="flex items-start justify-between p-1">
            <div className="flex items-start space-x-3">
              <div className="mt-1 p-2 bg-primary-50 dark:bg-primary-950/30 rounded-lg">
                <User className="w-5 h-5 text-primary-600 dark:text-primary-500" />
              </div>
              <div>
                <p className="text-xs font-medium text-primary-600 dark:text-primary-400 uppercase tracking-tighter mb-0.5">
                  {t('workOrders:form.fields.selectCustomer')}
                </p>
                <h4 className="font-bold text-neutral-900 dark:text-neutral-100 text-lg">
                  {selectedCustomer?.company_name}
                </h4>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                  <span className="text-sm text-neutral-600 dark:text-neutral-400 flex items-center">
                    <Phone className="w-3.5 h-3.5 mr-1.5 text-neutral-400" />
                    {selectedCustomer?.phone}
                  </span>
                  {selectedCustomer?.tax_number && (
                    <span className="text-sm text-neutral-600 dark:text-neutral-400 flex items-center">
                      <Info className="w-3.5 h-3.5 mr-1.5 text-neutral-400" />
                      {selectedCustomer.tax_number}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setIsSearching(true)}
              className="text-primary-600 hover:text-primary-700 hover:bg-primary-50 dark:hover:bg-primary-950/30"
            >
              {t('workOrders:form.buttons.changeCustomer')}
            </Button>
          </div>

          <div className="mt-6 pt-6 border-t border-neutral-100 dark:border-[#262626]">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 flex items-center">
                <MapPin className="w-4 h-4 mr-2 text-primary-600" />
                {t('workOrders:form.fields.selectSite')}
                {siteOptional && (
                  <span className="ml-1.5 text-xs font-normal text-neutral-500 dark:text-neutral-400">
                    {t('proposals:form.siteOptional')}
                  </span>
                )}
              </label>
              <Button 
                variant="ghost" 
                size="sm" 
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={onAddNewSite}
                className="h-8 px-2 text-primary-600"
              >
                {t('workOrders:form.buttons.addSite')}
              </Button>
            </div>

            {isLoadingSites ? (
              <div className="h-12 flex items-center justify-center">
                <Spinner size="sm" />
              </div>
            ) : sites.length > 0 ? (
              <div className="space-y-4">
                <Select
                  key={`site-select-${selectedCustomerId}-${sites.length}-${selectedSiteId || 'none'}`}
                  value={selectedSiteId || ''}
                  onChange={handleSiteSelect}
                  options={[
                    ...(siteOptional ? [{ value: '', label: t('proposals:form.noSite') }] : []),
                    ...sites.map(s => ({
                      value: s.id,
                      label: s.site_name ? `${s.site_name} (${s.account_no || '---'})` : `${s.address} (${s.account_no || '---'})`
                    }))
                  ]}
                  placeholder={t('workOrders:form.placeholders.selectSite')}
                  error={error}
                />

                {selectedSite && (
                  <div className="bg-neutral-50 dark:bg-[#1a1a1a] rounded-lg p-4 border border-neutral-100 dark:border-[#262626] space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1">
                          {t('customers:sites.fields.accountNo')}
                        </p>
                        <p className="text-sm font-mono font-bold text-neutral-900 dark:text-neutral-100">
                          {selectedSite.account_no || '---'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1">
                          {t('customers:sites.fields.contactName')}
                        </p>
                        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          {selectedSite.contact_name || '---'}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1">
                        {t('customers:sites.fields.address')}
                      </p>
                      <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                        {selectedSite.address} {selectedSite.district} {selectedSite.city}
                      </p>
                    </div>
                    {selectedSite.panel_info && (
                      <div className="pt-2 border-t border-neutral-200/50 dark:border-neutral-800/50">
                        <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1">
                          {t('customers:sites.fields.panelInfo')}
                        </p>
                        <p className="text-sm text-neutral-700 dark:text-neutral-300 italic">
                          {selectedSite.panel_info}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <EmptyState
                title={t('customers:sites.noSites')}
                size="sm"
                className="py-4"
              />
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
