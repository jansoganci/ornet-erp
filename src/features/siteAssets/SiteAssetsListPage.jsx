import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HardDrive, ExternalLink, AlertTriangle, Upload } from 'lucide-react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { PageContainer, PageHeader } from '../../components/layout';
import { Card, Table, ErrorState, EmptyState, Badge, SearchInput, Select, TableSkeleton, Button } from '../../components/ui';
import { AddAssetModal } from './components/AddAssetModal';
import { useAssets } from './hooks';
import { formatDate } from '../../lib/utils';

const SUBSCRIPTION_STATUSES = ['active', 'paused', 'cancelled', 'none'];

function groupAssetsBySite(assets) {
  const bySite = new Map();
  for (const a of assets || []) {
    const key = a.site_id;
    if (!bySite.has(key)) {
      bySite.set(key, {
        site_id: a.site_id,
        site_name: a.site_name,
        account_no: a.account_no,
        company_name: a.company_name,
        customer_id: a.customer_id,
        subscription_id: a.subscription_id,
        subscription_status: a.subscription_status,
        equipment: [],
        earliest_installation_date: a.installation_date,
      });
    }
    const row = bySite.get(key);
    row.equipment.push({ name: a.equipment_name, quantity: a.quantity });
    if (a.installation_date && (!row.earliest_installation_date || a.installation_date < row.earliest_installation_date)) {
      row.earliest_installation_date = a.installation_date;
    }
  }
  return Array.from(bySite.values());
}

export function SiteAssetsListPage() {
  const { t } = useTranslation(['siteAssets', 'common']);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showAddModal, setShowAddModal] = useState(false);

  const searchFromUrl = searchParams.get('search') || '';
  const [localSearch, setLocalSearch] = useState(searchFromUrl);
  const debouncedSearch = useDebouncedValue(localSearch, 300);
  const statusFilter = searchParams.get('status') || '';

  useEffect(() => {
    setLocalSearch(searchFromUrl);
  }, [searchFromUrl]);

  useEffect(() => {
    if (searchFromUrl === debouncedSearch) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (debouncedSearch) next.set('search', debouncedSearch);
      else next.delete('search');
      return next;
    });
  }, [debouncedSearch, searchFromUrl, setSearchParams]);

  const effectiveFilters = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      subscription_status: statusFilter || undefined,
    }),
    [debouncedSearch, statusFilter]
  );

  const { data: assets, isLoading, error } = useAssets(effectiveFilters);
  const groupedRows = useMemo(() => groupAssetsBySite(assets), [assets]);

  const statusOptions = [
    { value: '', label: t('siteAssets:filters.allStatuses') },
    ...SUBSCRIPTION_STATUSES.map((s) => ({ value: s, label: t(`siteAssets:subscriptionStatus.${s}`) })),
  ];

  const handleFilterChange = (key, value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value && value !== '') next.set(key, value);
      else next.delete(key);
      return next;
    });
  };

  const columns = [
    {
      key: 'customer',
      header: t('siteAssets:fields.customer'),
      render: (_, row) => (
        <p className="font-medium text-neutral-900 dark:text-neutral-50 truncate max-w-[180px]">
          {row.company_name || '-'}
        </p>
      ),
    },
    {
      key: 'site',
      header: t('siteAssets:fields.siteAcc'),
      render: (_, row) => (
        <div>
          <p className="font-medium text-neutral-900 dark:text-neutral-50 truncate max-w-[150px]">
            {row.site_name || '-'}
          </p>
          {row.account_no && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">{row.account_no}</p>
          )}
        </div>
      ),
    },
    {
      key: 'equipment',
      header: t('siteAssets:fields.equipmentList'),
      render: (_, row) => (
        <div className="flex flex-wrap gap-1.5">
          {row.equipment.map((e, i) => (
            <Badge key={i} variant="info" size="sm">
              {e.name}: {e.quantity}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'installation_date',
      header: t('siteAssets:fields.installationDate'),
      className: 'hidden md:table-cell',
      render: (_, row) => (
        <span className="text-sm text-neutral-600 dark:text-neutral-400">
          {row.earliest_installation_date ? formatDate(row.earliest_installation_date) : '-'}
        </span>
      ),
    },
    {
      key: 'subscription_status',
      header: t('siteAssets:fields.subscriptionStatus'),
      render: (_, row) => {
        const status = row.subscription_status || 'none';
        const isCancelled = status === 'cancelled';
        return (
          <div className="flex flex-col gap-1">
            <Badge
              variant={isCancelled ? 'error' : status === 'active' ? 'success' : status === 'paused' ? 'warning' : 'default'}
              size="sm"
            >
              {t(`siteAssets:subscriptionStatus.${status}`)}
            </Badge>
            {isCancelled && (
              <span className="text-xs text-error-600 dark:text-error-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {t('siteAssets:alert.deviceRetrieval')}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      className: 'w-20',
      render: (_, row) =>
        row.subscription_id ? (
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<ExternalLink className="w-4 h-4" />}
            onClick={() => navigate(`/subscriptions/${row.subscription_id}`)}
          >
            {t('siteAssets:actions.viewSubscription')}
          </Button>
        ) : (
          <span className="text-xs text-neutral-400">—</span>
        ),
    },
  ];

  if (error) {
    return (
      <PageContainer maxWidth="full">
        <ErrorState message={t('common:errors.loadFailed')} />
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="full">
      <PageHeader
        title={t('siteAssets:title')}
        description={
          <Badge variant="primary" size="sm">
            {groupedRows.length} {t('siteAssets:section.sites')}
          </Badge>
        }
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              leftIcon={<Upload className="w-4 h-4" />}
              onClick={() => navigate('/equipment/import')}
            >
              {t('common:import.bulkImportButton')}
            </Button>
            <Button variant="primary" leftIcon={<HardDrive className="w-4 h-4" />} onClick={() => setShowAddModal(true)}>
              {t('siteAssets:addButton')}
            </Button>
          </div>
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
          <div className="w-full sm:w-44">
            <Select
              label={t('siteAssets:filters.subscriptionStatus')}
              options={statusOptions}
              value={statusFilter}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              size="sm"
            />
          </div>
        </div>
      </Card>

      <div className="mt-6 bg-white dark:bg-[#171717] rounded-2xl border border-neutral-200 dark:border-[#262626] overflow-hidden shadow-sm">
        <Table
          columns={columns}
          data={groupedRows}
          loading={isLoading}
          emptyMessage={t('siteAssets:empty.title')}
        />
      </div>

      <AddAssetModal open={showAddModal} onClose={() => setShowAddModal(false)} />
    </PageContainer>
  );
}
