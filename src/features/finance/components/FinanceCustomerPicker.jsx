import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CustomerCombobox, Select } from '../../../components/ui';
import { useCustomer } from '../../customers/hooks';
import { useSitesByCustomer } from '../../customerSites/hooks';

export function FinanceCustomerPicker({
  selectedCustomerId,
  selectedSiteId,
  onCustomerChange,
  onSiteChange,
}) {
  const { t } = useTranslation(['finance', 'workOrders', 'proposals']);
  const [isChanging, setIsChanging] = useState(false);

  const { data: selectedCustomer } = useCustomer(selectedCustomerId);
  const { data: sites = [] } = useSitesByCustomer(selectedCustomerId);

  const selectedSite = useMemo(
    () => sites.find((s) => s.id === selectedSiteId),
    [sites, selectedSiteId]
  );

  const siteOptions = useMemo(
    () => [
      { value: '', label: t('proposals:form.noSite') },
      ...sites.map((s) => ({
        value: s.id,
        label: s.site_name
          ? `${s.site_name}${s.account_no ? ` (${s.account_no})` : ''}`
          : s.account_no || '---',
      })),
    ],
    [sites, t]
  );

  const handleCustomerSelect = (id) => {
    onCustomerChange(id || '');
    onSiteChange('');
    setIsChanging(false);
  };

  const handleReset = () => {
    onCustomerChange('');
    onSiteChange('');
    setIsChanging(false);
  };

  if (!selectedCustomerId || isChanging) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {t('finance:income.fields.customer')}
        </label>
        <CustomerCombobox
          value={selectedCustomerId || ''}
          selectedCustomer={selectedCustomer ?? null}
          onChange={handleCustomerSelect}
          placeholder={t('workOrders:form.placeholders.searchCustomer')}
        />
        {isChanging && (
          <button
            type="button"
            onClick={() => setIsChanging(false)}
            className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
          >
            {t('common:actions.cancel')}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Customer row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
            {selectedCustomer?.company_name ?? '…'}
          </span>
          <Link
            to={`/customers/${selectedCustomerId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            title={t('finance:customer.openDetail')}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="shrink-0 text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline ml-3"
        >
          {t('workOrders:form.buttons.changeCustomer')}
        </button>
      </div>

      {/* Site selector */}
      {sites.length > 0 && (
        <div className="space-y-1.5">
          <Select
            label={t('workOrders:form.fields.selectSite')}
            value={selectedSiteId || ''}
            onChange={(e) => onSiteChange(e.target.value || '')}
            options={siteOptions}
          />
          {selectedSite?.account_no && (
            <p className="text-xs text-neutral-400 dark:text-neutral-500 font-mono pl-0.5">
              {t('finance:customer.accountNo')}: {selectedSite.account_no}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
