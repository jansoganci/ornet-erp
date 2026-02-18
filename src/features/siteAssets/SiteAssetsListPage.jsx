import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { HardDrive } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/layout';
import { Card, Table, Spinner, ErrorState, EmptyState, Badge, SearchInput, Select, TableSkeleton } from '../../components/ui';
import { AssetStatusBadge } from './components/AssetStatusBadge';
import { useAssets } from './hooks';
import { ASSET_TYPES, ASSET_STATUSES } from './schema';
import { formatDate } from '../../lib/utils';

export function SiteAssetsListPage() {
  const { t } = useTranslation(['siteAssets', 'common']);
  const [filters, setFilters] = useState({});

  const { data: assets, isLoading, error } = useAssets(filters);

  if (isLoading) {
    return (
      <PageContainer>
        <PageHeader title={t('siteAssets:title')} />
        <div className="mt-6">
          <TableSkeleton cols={6} />
        </div>
      </PageContainer>
    );
  }

  const handleSearchChange = (value) => {
    setFilters((prev) => ({ ...prev, search: value || undefined }));
  };

  const handleStatusChange = (e) => {
    const val = e.target.value;
    setFilters((prev) => ({ ...prev, status: val || undefined }));
  };

  const handleTypeChange = (e) => {
    const val = e.target.value;
    setFilters((prev) => ({ ...prev, asset_type: val || undefined }));
  };

  const statusOptions = [
    { value: '', label: t('siteAssets:filters.allStatuses') },
    ...ASSET_STATUSES.map((s) => ({ value: s, label: t(`siteAssets:statuses.${s}`) })),
  ];

  const typeOptions = [
    { value: '', label: t('siteAssets:filters.allTypes') },
    ...ASSET_TYPES.map((type) => ({ value: type, label: t(`siteAssets:types.${type}`) })),
  ];

  const columns = [
    {
      key: 'asset_type',
      header: t('siteAssets:fields.assetType'),
      render: (_, asset) => (
        <div>
          <p className="font-medium text-neutral-900 dark:text-neutral-50">
            {t(`siteAssets:types.${asset.asset_type}`)}
          </p>
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
      />

      <Card padding="compact" className="mt-6">
        <div className="p-4 border-b border-neutral-100 dark:border-[#262626]">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <SearchInput
                placeholder={t('siteAssets:filters.search')}
                value={filters.search || ''}
                onChange={handleSearchChange}
              />
            </div>
            <div className="flex gap-2">
              <Select
                options={statusOptions}
                value={filters.status || ''}
                onChange={handleStatusChange}
                size="sm"
                className="w-36"
              />
              <Select
                options={typeOptions}
                value={filters.asset_type || ''}
                onChange={handleTypeChange}
                size="sm"
                className="w-44"
              />
            </div>
          </div>
        </div>

        <Table
          columns={columns}
          data={assets || []}
          loading={isLoading}
          emptyMessage={t('siteAssets:empty.title')}
        />
      </Card>
    </PageContainer>
  );
}
