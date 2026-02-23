import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HardDrive, Layers } from 'lucide-react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { PageContainer, PageHeader } from '../../components/layout';
import { Card, Table, Spinner, ErrorState, EmptyState, Badge, SearchInput, Select, TableSkeleton, DateRangeFilter, Button } from '../../components/ui';
import { AssetStatusBadge } from './components/AssetStatusBadge';
import { OwnershipBadge } from './components/OwnershipBadge';
import { BulkAssetRegisterModal } from './components/BulkAssetRegisterModal';
import { useAssets } from './hooks';
import { ASSET_TYPES, ASSET_STATUSES, OWNERSHIP_TYPES } from './schema';
import { formatDate } from '../../lib/utils';

export function SiteAssetsListPage() {
  const { t } = useTranslation(['siteAssets', 'common']);
  const [searchParams, setSearchParams] = useSearchParams();
  const [showBulkModal, setShowBulkModal] = useState(false);

  const searchFromUrl = searchParams.get('search') || '';
  const [localSearch, setLocalSearch] = useState(searchFromUrl);
  const debouncedSearch = useDebouncedValue(localSearch, 300);

  const status = searchParams.get('status') || '';
  const assetType = searchParams.get('assetType') || '';
  const ownershipType = searchParams.get('ownershipType') || '';
  const yearParam = searchParams.get('year') || '';
  const monthParam = searchParams.get('month') || '';

  // Sync local search from URL
  useEffect(() => {
    setLocalSearch(searchFromUrl);
  }, [searchFromUrl]);

  // Sync debounced search to URL
  useEffect(() => {
    if (searchFromUrl === debouncedSearch) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (debouncedSearch) next.set('search', debouncedSearch);
      else next.delete('search');
      return next;
    });
  }, [debouncedSearch, searchFromUrl, setSearchParams]);

  const handleFilterChange = (key, value) => {
    setSearchParams((prev) => {
      if (value && value !== 'all' && value !== '') prev.set(key, value);
      else prev.delete(key);
      return prev;
    });
  };

  const effectiveFilters = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      status: status || undefined,
      asset_type: assetType || undefined,
      ownership_type: ownershipType || undefined,
      year: yearParam || undefined,
      month: monthParam || undefined,
    }),
    [debouncedSearch, status, assetType, ownershipType, yearParam, monthParam]
  );

  const { data: assets, isLoading, error } = useAssets(effectiveFilters);

  const statusOptions = [
    { value: '', label: t('siteAssets:filters.allStatuses') },
    ...ASSET_STATUSES.map((s) => ({ value: s, label: t(`siteAssets:statuses.${s}`) })),
  ];

  const typeOptions = [
    { value: '', label: t('siteAssets:filters.allTypes') },
    ...ASSET_TYPES.map((type) => ({ value: type, label: t(`siteAssets:types.${type}`) })),
  ];

  const ownershipOptions = [
    { value: '', label: t('siteAssets:filters.allOwnerships') },
    ...OWNERSHIP_TYPES.map((type) => ({ value: type, label: t(`siteAssets:ownerships.${type}`) })),
  ];

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - 2 + i).toString());
  const yearOptions = [
    { value: '', label: t('common:filters.all') },
    ...years.map((y) => ({ value: y, label: y })),
  ];

  const monthOptions = [
    { value: '', label: t('common:filters.all') },
    ...Object.entries(t('notifications:months', { returnObjects: true })).map(([val, label]) => ({
      value: val,
      label,
    })),
  ];

  const columns = [
    {
      key: 'asset_type',
      header: t('siteAssets:fields.assetType'),
      render: (_, asset) => (
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-neutral-900 dark:text-neutral-50">
              {t(`siteAssets:types.${asset.asset_type}`)}
            </p>
            <OwnershipBadge type={asset.ownership_type} />
          </div>
          {asset.brand && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {asset.brand} {asset.model || ''}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'serial_number',
      header: t('siteAssets:fields.serialNumber'),
      className: 'hidden md:table-cell',
      render: (_, asset) => (
        <span className="text-sm font-mono text-neutral-600 dark:text-neutral-400">
          {asset.serial_number || '-'}
        </span>
      ),
    },
    {
      key: 'site',
      header: t('siteAssets:fields.site'),
      render: (_, asset) => (
        <div>
          <p className="font-medium text-neutral-900 dark:text-neutral-50 truncate max-w-[150px]">
            {asset.site_name || '-'}
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {asset.customer_name || '-'}
          </p>
        </div>
      ),
    },
    {
      key: 'location_note',
      header: t('siteAssets:fields.locationNote'),
      className: 'hidden lg:table-cell',
      render: (_, asset) => (
        <span className="text-sm text-neutral-600 dark:text-neutral-400 truncate max-w-[150px] block">
          {asset.location_note || '-'}
        </span>
      ),
    },
    {
      key: 'installed_at',
      header: t('siteAssets:fields.installedAt'),
      className: 'hidden md:table-cell',
      render: (_, asset) => (
        <span className="text-sm text-neutral-600 dark:text-neutral-400">
          {asset.installed_at ? formatDate(asset.installed_at) : '-'}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('siteAssets:detail.status'),
      render: (_, asset) => <AssetStatusBadge status={asset.status} />,
    },
  ];

  if (error) {
    return (
      <PageContainer>
        <ErrorState message={t('common:errors.loadFailed')} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={t('siteAssets:title')}
        description={
          <Badge variant="primary" size="sm">
            {assets?.length || 0} {t('siteAssets:section.title').toLowerCase()}
          </Badge>
        }
        actions={
          <Button
            variant="outline"
            leftIcon={<Layers className="w-4 h-4" />}
            onClick={() => setShowBulkModal(true)}
          >
            {t('siteAssets:bulkRegister.title')}
          </Button>
        }
      />

      <Card className="p-3 mt-6 border-neutral-200/60 dark:border-neutral-800/60">
        <div className="flex flex-col lg:flex-row items-end gap-3">
          <div className="flex-1 min-w-[200px] w-full">
            <SearchInput
              placeholder={t('siteAssets:filters.search')}
              value={localSearch}
              onChange={(v) => setLocalSearch(v ?? '')}
              size="sm"
            />
          </div>
          <div className="flex flex-wrap items-end gap-3 w-full lg:w-auto">
            <div className="w-full sm:flex-1 md:w-40">
              <Select
                label={t('siteAssets:filters.status')}
                options={statusOptions}
                value={status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                size="sm"
              />
            </div>
            <div className="w-full sm:flex-1 md:w-44">
              <Select
                label={t('siteAssets:filters.type')}
                options={typeOptions}
                value={assetType}
                onChange={(e) => handleFilterChange('assetType', e.target.value)}
                size="sm"
              />
            </div>
            <div className="w-full sm:flex-1 md:w-44">
              <Select
                label={t('siteAssets:filters.ownership')}
                options={ownershipOptions}
                value={ownershipType}
                onChange={(e) => handleFilterChange('ownershipType', e.target.value)}
                size="sm"
              />
            </div>
            <div className="w-full sm:flex-1 md:w-32">
              <Select
                label={t('siteAssets:filters.selectYear')}
                options={yearOptions}
                value={yearParam}
                onChange={(e) => handleFilterChange('year', e.target.value)}
                size="sm"
              />
            </div>
            <div className="w-full sm:flex-1 md:w-36">
              <Select
                label={t('siteAssets:filters.selectMonth')}
                options={monthOptions}
                value={monthParam}
                onChange={(e) => handleFilterChange('month', e.target.value)}
                size="sm"
              />
            </div>
          </div>
        </div>
      </Card>

      <div className="mt-6 bg-white dark:bg-[#171717] rounded-2xl border border-neutral-200 dark:border-[#262626] overflow-hidden shadow-sm">
        <Table
          columns={columns}
          data={assets || []}
          loading={isLoading}
          emptyMessage={t('siteAssets:empty.title')}
        />
      </div>

      <BulkAssetRegisterModal
        open={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        siteId={undefined}
        customerId={undefined}
      />
    </PageContainer>
  );
}
