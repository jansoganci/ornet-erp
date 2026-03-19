import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HardDrive, Plus, Edit, Trash2 } from 'lucide-react';
import { Card, Badge, Button, Table, IconButton, Modal } from '../../../components/ui';
import { AddAssetModal } from './AddAssetModal';
import { useAssetsByCustomer, useDeleteAsset, useUpdateAsset } from '../hooks';

export function SiteAssetsCard({ customerId, sites = [] }) {
  const { t } = useTranslation(['siteAssets', 'common']);
  const { data: assets = [], isLoading } = useAssetsByCustomer(customerId);
  const deleteAsset = useDeleteAsset();
  const updateAsset = useUpdateAsset();

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selectedSiteId, setSelectedSiteId] = useState(null);

  const handleAdd = (siteId) => {
    setSelectedAsset(null);
    setSelectedSiteId(siteId || (sites.length === 1 ? sites[0].id : null));
    setShowAddModal(true);
  };

  const handleEdit = (asset) => {
    setSelectedAsset(asset);
    setSelectedSiteId(asset.site_id);
    setShowAddModal(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteAsset.mutateAsync(deleteTarget.id);
    } catch {
      // error handled by mutation onError
    }
    setDeleteTarget(null);
  };

  const columns = [
    {
      key: 'equipment_name',
      header: t('siteAssets:fields.materialName'),
      render: (_, asset) => (
        <p className="font-medium text-neutral-900 dark:text-neutral-50">{asset.equipment_name || '-'}</p>
      ),
    },
    {
      key: 'quantity',
      header: t('siteAssets:fields.quantity'),
      render: (_, asset) => (
        <span className="text-sm text-neutral-600 dark:text-neutral-400">{asset.quantity ?? 1}</span>
      ),
    },
    {
      key: 'installation_date',
      header: t('siteAssets:fields.installationDate'),
      render: (_, asset) => (
        <span className="text-sm text-neutral-600 dark:text-neutral-400">
          {asset.installation_date ? new Date(asset.installation_date).toLocaleDateString('tr-TR') : '-'}
        </span>
      ),
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
            aria-label={t('common:actions.edit')}
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(asset);
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

  const assetsBySite = sites.reduce((acc, site) => {
    acc[site.id] = assets.filter((a) => a.site_id === site.id);
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
              <Badge variant="default">{assets.length}</Badge>
              <Button size="sm" variant="primary" leftIcon={<Plus className="w-4 h-4" />} onClick={() => handleAdd()}>
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
                        {siteAssets.length} {t('siteAssets:section.title').toLowerCase()}
                      </Badge>
                    </div>
                    <Button size="sm" variant="outline" leftIcon={<Plus className="w-4 h-4" />} onClick={() => handleAdd(site.id)}>
                      {t('siteAssets:addButton')}
                    </Button>
                  </div>
                  {siteAssets.length > 0 ? (
                    <Table columns={columns} data={siteAssets} loading={false} compact />
                  ) : (
                    <p className="px-4 py-2 text-sm text-neutral-400 italic">{t('siteAssets:empty.description')}</p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <Table
            columns={columns}
            data={assets}
            loading={isLoading}
            emptyMessage={t('siteAssets:empty.title')}
          />
        )}
      </Card>

      <AddAssetModal
        open={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setSelectedAsset(null);
        }}
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
            <Button variant="danger" onClick={handleDelete} loading={deleteAsset.isPending} className="flex-1">
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
