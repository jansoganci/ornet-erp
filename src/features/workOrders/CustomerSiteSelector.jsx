import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, User, MapPin, Phone, Info } from 'lucide-react';
import { useCustomer } from '../customers/hooks';
import { useSitesByCustomer } from '../customerSites/hooks';
import {
  Button,
  Select,
  Card,
  Spinner,
  EmptyState,
  CustomerCombobox,
} from '../../components/ui';

export function CustomerSiteSelector({
  selectedCustomerId,
  selectedSiteId,
  onCustomerChange,
  onSiteChange,
  onAddNewSite,
  onAddNewCustomer,
  error,
  siteOptional = false,
  compact = false,
}) {
  const { t } = useTranslation(['workOrders', 'customers', 'common', 'proposals']);
  const [isSearching, setIsSearching] = useState(false);

  const { data: selectedCustomer } = useCustomer(selectedCustomerId);
  const { data: sites = [], isLoading: isLoadingSites } = useSitesByCustomer(selectedCustomerId);

  const selectedSite = useMemo(
    () => sites.find((s) => s.id === selectedSiteId),
    [sites, selectedSiteId]
  );

  const handleSiteSelect = (e) => {
    const newSiteId = e.target.value;
    onSiteChange(newSiteId || '');
  };

  return (
    <div className="space-y-4">
      {!compact && (
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
            {t('workOrders:form.sections.customerSelection')}
          </h3>
        </div>
      )}

      {!selectedCustomerId || isSearching ? (
        <div className="space-y-2">
          <CustomerCombobox
            value={selectedCustomerId || ''}
            selectedCustomer={selectedCustomer}
            onChange={(id) => {
              onCustomerChange(id || null);
              setIsSearching(false);
            }}
            placeholder={t('workOrders:form.placeholders.searchCustomer')}
          />
          {!isSearching && !selectedCustomerId && (
            <Button
              type="button"
              variant="outline"
              className="w-full border-dashed"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => onAddNewCustomer('')}
            >
              {t('workOrders:form.buttons.addCustomer')}
            </Button>
          )}
        </div>
      ) : compact ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-primary-100 bg-white p-4 dark:border-primary-900/30 dark:bg-[#171717]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <div className="space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary-600 dark:text-primary-400">
                    {t('workOrders:form.fields.selectCustomer')}
                  </p>
                  <p className="truncate text-base font-semibold text-neutral-900 dark:text-neutral-100">
                    {selectedCustomer?.company_name}
                  </p>
                </div>
                {selectedSite && (
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">
                      {t('workOrders:form.fields.selectSite')}
                    </p>
                    <p className="truncate text-sm text-neutral-700 dark:text-neutral-300">
                      {selectedSite.site_name || selectedSite.account_no || '—'}
                    </p>
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsSearching(true)}
                className="shrink-0 text-primary-600 hover:text-primary-700 hover:bg-primary-50 dark:hover:bg-primary-950/30 font-bold"
              >
                {t('workOrders:form.buttons.changeCustomer')}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <label className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">
                {t('workOrders:form.fields.selectSite')}
                {siteOptional && (
                  <span className="ml-2 text-[10px] font-normal lowercase tracking-normal text-neutral-400">
                    ({t('proposals:form.siteOptional')})
                  </span>
                )}
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={onAddNewSite}
                className="h-8 px-2 text-primary-600 font-bold"
              >
                {t('workOrders:form.buttons.addSite')}
              </Button>
            </div>

            {isLoadingSites ? (
              <div className="h-12 flex items-center justify-center">
                <Spinner size="sm" />
              </div>
            ) : sites.length > 0 ? (
              <Select
                key={`site-select-${selectedCustomerId}-${sites.length}-${selectedSiteId || 'none'}`}
                value={selectedSiteId || ''}
                onChange={handleSiteSelect}
                options={[
                  ...(siteOptional ? [{ value: '', label: t('proposals:form.noSite') }] : []),
                  ...sites.map((s) => ({
                    value: s.id,
                    label: s.site_name || s.account_no || '—',
                  })),
                ]}
                placeholder={t('workOrders:form.placeholders.selectSite')}
                error={error}
              />
            ) : (
              <EmptyState
                title={t('customers:sites.noSites')}
                size="sm"
                className="py-4"
              />
            )}
          </div>
        </div>
      ) : (
        <Card className="relative overflow-hidden border-primary-100 dark:border-primary-900/30 bg-white dark:bg-[#171717]">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary-600" />
          <div className="flex items-start justify-between p-2">
            <div className="flex items-start space-x-4">
              <div className="mt-1 p-3 bg-primary-50 dark:bg-primary-950/30 rounded-xl">
                <User className="w-6 h-6 text-primary-600 dark:text-primary-500" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-primary-600 dark:text-primary-400 uppercase tracking-widest mb-1">
                  {t('workOrders:form.fields.selectCustomer')}
                </p>
                <h4 className="font-bold text-neutral-900 dark:text-neutral-100 text-xl">
                  {selectedCustomer?.company_name}
                </h4>
                <div className="flex flex-wrap gap-x-6 gap-y-2 mt-2">
                  <span className="text-sm text-neutral-600 dark:text-neutral-400 flex items-center bg-neutral-50 dark:bg-[#1a1a1a] px-2 py-1 rounded-lg border border-neutral-100 dark:border-[#262626]">
                    <Phone className="w-3.5 h-3.5 mr-2 text-neutral-400" />
                    {selectedCustomer?.phone}
                  </span>
                  {selectedCustomer?.tax_number && (
                    <span className="text-sm text-neutral-600 dark:text-neutral-400 flex items-center bg-neutral-50 dark:bg-[#1a1a1a] px-2 py-1 rounded-lg border border-neutral-100 dark:border-[#262626]">
                      <Info className="w-3.5 h-3.5 mr-2 text-neutral-400" />
                      {selectedCustomer.tax_number}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsSearching(true)}
              className="text-primary-600 hover:text-primary-700 hover:bg-primary-50 dark:hover:bg-primary-950/30 font-bold"
            >
              {t('workOrders:form.buttons.changeCustomer')}
            </Button>
          </div>

          <div className="mt-8 pt-8 border-t border-neutral-100 dark:border-[#262626]">
            <div className="flex items-center justify-between mb-4">
              <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest flex items-center">
                <MapPin className="w-4 h-4 mr-2 text-primary-600" />
                {t('workOrders:form.fields.selectSite')}
                {siteOptional && (
                  <span className="ml-2 text-[10px] font-normal lowercase tracking-normal text-neutral-400">
                    ({t('proposals:form.siteOptional')})
                  </span>
                )}
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={onAddNewSite}
                className="h-8 px-3 text-primary-600 font-bold"
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
                    ...sites.map((s) => {
                      const loc = [s.site_name, s.address, s.district, s.city].filter(Boolean).join(', ');
                      return {
                        value: s.id,
                        label: loc ? `${loc} (${s.account_no || '---'})` : `Hesap: ${s.account_no || '---'}`,
                      };
                    }),
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
                    {(selectedSite.address || selectedSite.district || selectedSite.city) && (
                      <div>
                        <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1">
                          {t('customers:sites.fields.address')}
                        </p>
                        <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                          {[selectedSite.address, selectedSite.district, selectedSite.city].filter(Boolean).join(', ')}
                        </p>
                      </div>
                    )}
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
