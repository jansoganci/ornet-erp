import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HardDrive, Plus, Edit, Trash2, AlertTriangle } from 'lucide-react';
import { Card, Badge, Button, Table, IconButton, Modal } from '../../../components/ui';
import { AssetStatusBadge } from './AssetStatusBadge';
import { AssetFormModal } from './AssetFormModal';
import { useAssetsByCustomer, useDeleteAsset, useUpdateAsset } from '../hooks';

export function SiteAssetsCard({ customerId, sites = [] }) {
  const { t } = useTranslation(['siteAssets', 'common']);
  const { data: assets = [], isLoading } = useAssetsByCustomer(customerId);
  const deleteAsset = useDeleteAsset();
  const updateAsset = useUpdateAsset();

  const [showFormModal, setShowFormModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selectedSiteId, setSelectedSiteId] = useState(null);

  const handleAdd = (siteId) => {
    setSelectedAsset(null);
    setSelectedSiteId(siteId || (sites.length === 1 ? sites[0].id : null));
    setShowFormModal(true);
  };

  const handleEdit = (asset) => {
    setSelectedAsset(asset);
    setSelectedSiteId(asset.site_id);
    setShowFormModal(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteAsset.mutateAsync(deleteTarget.id);
    } catch (err) {
      console.error(err);
    }
    setDeleteTarget(null);
  };

  const handleMarkFaulty = async (asset) => {
    try {
      await updateAsset.mutateAsync({
        id: asset.id,
        data: { status: asset.status === 'faulty' ? 'active' : 'faulty' },
      });
    } catch (err) {
      console.error(err);
    }
  };

  const activeAssets = assets.filter((a) => a.status === 'active' || a.status === 'faulty');

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
      key: 'status',
      header: t('siteAssets:detail.status'),
      render: (_, asset) => <AssetStatusBadge status={asset.status} />,
    },
    {
      key: 'actions',
      header: '',
      className: 'w-24',
      render: (_, asset) => (
        <div className="flex items-center gap-1 justify-end">
          <IconButton
            icon={Edit}
            size="sm"
            variant="ghost"
            aria-label={t('siteAssets:actions.edit')}
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(asset);
            }}
          />
          <IconButton
            icon={AlertTriangle}
            size="sm"
            variant="ghost"
            aria-label={t('siteAssets:actions.markFaulty')}
            className={asset.status === 'faulty' ? 'text-error-500' : ''}
            onClick={(e) => {
              e.stopPropagation();
              handleMarkFaulty(asset);
            }}
          />
          <IconButton
            icon={Trash2}
            size="sm"
            variant="ghost"
            aria-label={t('common:actions.delete')}
            className="text-error-600 dark:text-error-400"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(asset);
            }}
          />
        </div>
      ),
    },
  ];

  // Group assets by site for multi-site display
  const assetsBySite = sites.reduce((acc, site) => {
    acc[site.id] = activeAssets.filter((a) => a.site_id === site.id);
    return acc;
  }, {});

  const showSiteGrouping = sites.length > 1;

  return (
    <>
      <Card
        padding="compact"
        header={
          <div className="flex items-center justify-between w-full">
            <h2 className="font-semibold text-neutral-900 dark:text-neutral-50 flex items-center">
              <HardDrive className="w-5 h-5 mr-2 text-primary-600" />
              {t('siteAssets:section.title')}
            </h2>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{activeAssets.length}</Badge>
              <Button
                size="sm"
                variant="outline"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => handleAdd()}
              >
                {t('siteAssets:addButton')}
              </Button>
            </div>
          </div>
        }
      >
        {showSiteGrouping ? (
          <div className="divide-y divide-neutral-100 dark:divide-[#262626]">
            {sites.map((site) => {
              const siteAssets = assetsBySite[site.id] || [];
              return (
                <div key={site.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between px-4 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                        {site.site_name}
                      </span>
                      {site.account_no && (
                        <Badge variant="info" size="sm" className="font-mono">
                          {site.account_no}
                        </Badge>
                      )}
                      <Badge variant="default" size="sm">
                        {t('siteAssets:section.siteCount', { count: siteAssets.length })}
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      leftIcon={<Plus className="w-4 h-4" />}
                      onClick={() => handleAdd(site.id)}
                    >
                      {t('siteAssets:addButton')}
                    </Button>
                  </div>
                  {siteAssets.length > 0 ? (
                    <Table
                      columns={columns}
                      data={siteAssets}
                      loading={false}
                      compact
                    />
                  ) : (
                    <p className="px-4 py-2 text-sm text-neutral-400 italic">
                      {t('siteAssets:empty.description')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <Table
            columns={columns}
            data={activeAssets}
            loading={isLoading}
            emptyMessage={t('siteAssets:empty.title')}
          />
        )}
      </Card>

      <AssetFormModal
        open={showFormModal}
        onClose={() => setShowFormModal(false)}
        siteId={selectedSiteId}
        customerId={customerId}
        asset={selectedAsset}
      />

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t('common:actions.delete')}
        size="sm"
        footer={
          <div className="flex gap-3 w-full">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} className="flex-1">
              {t('common:actions.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              loading={deleteAsset.isPending}
              className="flex-1"
            >
              {t('common:actions.delete')}
            </Button>
          </div>
        }
      >
        <p>{t('common:confirm.deleteMessage')}</p>
      </Modal>
    </>
  );
}
