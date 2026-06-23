import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Package2, Wrench } from 'lucide-react';
import { SearchInput, EmptyState, Spinner, Badge, Card } from '../../../components/ui';
import { formatDate } from '../../../lib/utils';
import { normalizeForSearch } from '../../../lib/normalizeForSearch';
import { toCSV, downloadCSV } from '../../../lib/csvExport';
import { useAssetsBySite } from '../../siteAssets/hooks';

export function SubscriptionAssetsTab({ siteId }) {
  const { t } = useTranslation('subscriptions');
  const { t: tCommon } = useTranslation('common');

  const { data: assets = [], isLoading, error } = useAssetsBySite(siteId);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return assets;
    const normalized = normalizeForSearch(search);
    return assets.filter((a) => {
      const haystack = normalizeForSearch(a.equipment_name || '');
      return haystack.includes(normalized);
    });
  }, [assets, search]);

  const groupedAssets = useMemo(() => {
    const grouped = new Map();
    for (const asset of filtered) {
      const key = asset.equipment_name || t('detail.noDescription');
      const current = grouped.get(key) || {
        equipment_name: key,
        quantity: 0,
        latest_installation_date: null,
        records: 0,
      };
      current.quantity += Number(asset.quantity) || 0;
      current.records += 1;
      if (asset.installation_date && (!current.latest_installation_date || asset.installation_date > current.latest_installation_date)) {
        current.latest_installation_date = asset.installation_date;
      }
      grouped.set(key, current);
    }
    return Array.from(grouped.values()).sort((a, b) => b.quantity - a.quantity || a.equipment_name.localeCompare(b.equipment_name, 'tr'));
  }, [filtered, t]);

  const totalUnits = groupedAssets.reduce((sum, asset) => sum + asset.quantity, 0);
  const latestInstallation = groupedAssets
    .map((asset) => asset.latest_installation_date)
    .filter(Boolean)
    .sort()
    .at(-1);

  const handleExport = () => {
    const rows = groupedAssets.map((a) => ({
      equipment_name: a.equipment_name,
      quantity: a.quantity,
      installation_date: a.latest_installation_date ? formatDate(a.latest_installation_date) : '',
    }));
    const csv = toCSV(rows, [
      { key: 'equipment_name', header: t('detail.tabContent.assets.columns.equipmentName') },
      { key: 'quantity', header: t('detail.tabContent.assets.columns.quantity') },
      { key: 'installation_date', header: t('detail.tabContent.assets.columns.installationDate') },
    ]);
    downloadCSV(csv, t('detail.tabContent.assets.exportFilename'));
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title={tCommon('errors.loadFailed')}
        description={error.message}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <SummaryMiniCard
          icon={Package2}
          label={t('detail.tabContent.assets.columns.equipmentName')}
          value={groupedAssets.length}
          helper={t('detail.fields.equipmentTypes', 'farklı ekipman')}
        />
        <SummaryMiniCard
          icon={Wrench}
          label={t('detail.tabContent.assets.columns.quantity')}
          value={totalUnits}
          helper={t('detail.fields.equipmentUnits', 'toplam adet')}
        />
        <SummaryMiniCard
          icon={Package2}
          label={t('detail.tabContent.assets.columns.installationDate')}
          value={latestInstallation ? formatDate(latestInstallation) : '—'}
          helper={t('detail.fields.lastInstallation', 'son kurulum')}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t('detail.tabContent.searchPlaceholder')}
          className="max-w-xs"
        />
        {groupedAssets.length > 0 && (
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-1.5 text-xs font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            {t('detail.tabContent.exportCsv')}
          </button>
        )}
      </div>

      {groupedAssets.length === 0 ? (
        <EmptyState title={t('detail.tabContent.assets.empty')} />
      ) : (
        <Card className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-[#262626] dark:bg-[#171717]">
          <div className="divide-y divide-neutral-200 dark:divide-[#262626]">
            {groupedAssets.map((asset) => (
              <div
                key={asset.equipment_name}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                    {asset.equipment_name}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    {asset.latest_installation_date
                      ? `${t('detail.tabContent.assets.columns.installationDate')}: ${formatDate(asset.latest_installation_date)}`
                      : t('detail.noNotes')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="success" size="sm">
                    {t('statuses.active')}
                  </Badge>
                  <span className="whitespace-nowrap text-sm font-semibold text-neutral-800 dark:text-neutral-100">
                    {asset.quantity} {t('detail.tabContent.assets.columns.quantity').toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function SummaryMiniCard({ icon: Icon, label, value, helper }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm dark:border-[#262626] dark:bg-[#171717]">
      <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
        <Icon className="h-4 w-4" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em]">{label}</p>
      </div>
      <p className="mt-2 text-lg font-semibold text-neutral-900 dark:text-neutral-50">{value}</p>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{helper}</p>
    </div>
  );
}
