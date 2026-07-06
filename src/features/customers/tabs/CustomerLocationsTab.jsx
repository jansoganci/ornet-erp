import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Plus } from 'lucide-react';
import { Button, Card, Modal, Skeleton } from '../../../components/ui';
import { useCustomerDetail } from '../customerDetailContextBase';
import { SiteCard } from '../../customerSites/SiteCard';
import { SiteFormModal } from '../../customerSites/SiteFormModal';
import { useDeleteSite, useUpdateSite } from '../../customerSites/hooks';
import { useRole } from '../../../lib/roles';
import { toast } from 'sonner';

export function CustomerLocationsTab() {
  const { t } = useTranslation('customers');
  const { t: tCommon } = useTranslation('common');
  const { canWrite } = useRole();
  const {
    customerId,
    sites = [],
    sitesLoading = false,
    subscriptionsBySite = {},
    onNewWorkOrder,
    navigate,
  } = useCustomerDetail();

  const [showSiteModal, setShowSiteModal] = useState(false);
  const [selectedSite, setSelectedSite] = useState(null);
  const [siteToDelete, setSiteToDelete] = useState(null);

  const deleteSiteMutation = useDeleteSite();
  const updateSiteMutation = useUpdateSite();

  const handleAddSite = () => {
    setSelectedSite(null);
    setShowSiteModal(true);
  };

  const handleEditSite = (site) => {
    setSelectedSite(site);
    setShowSiteModal(true);
  };

  const handleToggleActive = async (site) => {
    try {
      await updateSiteMutation.mutateAsync({
        id: site.id,
        data: { is_active: site.is_active === false },
      });
    } catch {
      // error handled by mutation
    }
  };

  const handleDeleteClick = (site) => {
    const subs = subscriptionsBySite[site.id] || [];
    if (subs.length > 0) {
      toast.error(t('customers:sites.deleteBlocked'));
      return;
    }
    setSiteToDelete(site);
  };

  const handleDeleteConfirm = async () => {
    if (!siteToDelete) return;
    try {
      await deleteSiteMutation.mutateAsync({ id: siteToDelete.id, customerId });
      setSiteToDelete(null);
    } catch {
      // error handled by mutation
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">
            {t('sites.title')}
          </h2>
          {canWrite && (
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={handleAddSite}
            >
              {t('sites.addButton')}
            </Button>
          )}
        </div>

        {sitesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(2)].map((_, i) => (
              <Skeleton key={i} className="h-48 w-full rounded-xl" />
            ))}
          </div>
        ) : sites.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sites.map(site => (
              <SiteCard
                key={site.id}
                site={site}
                subscriptions={subscriptionsBySite[site.id] || []}
                onEdit={canWrite ? handleEditSite : undefined}
                onCreateWorkOrder={onNewWorkOrder}
                onViewHistory={(siteId) =>
                  navigate(`/work-history?siteId=${siteId}&type=account_no`)
                }
                onAddSubscription={canWrite ? (s) =>
                  navigate(`/subscriptions/new?siteId=${s.id}&customerId=${customerId}`) : undefined
                }
                onToggleActive={canWrite ? handleToggleActive : undefined}
                onDelete={canWrite ? handleDeleteClick : undefined}
              />
            ))}
          </div>
        ) : (
          <Card className="p-4 sm:p-6 lg:p-8 text-center border-dashed">
            <MapPin className="w-12 h-12 text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
            <p className="text-neutral-500 dark:text-neutral-400">{t('sites.noSites')}</p>
            {canWrite && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-4 text-primary-600"
                onClick={handleAddSite}
              >
                {t('sites.addButton')}
              </Button>
            )}
          </Card>
        )}
      </div>

      <SiteFormModal
        open={showSiteModal}
        onClose={() => setShowSiteModal(false)}
        customerId={customerId}
        site={selectedSite}
      />

      <Modal
        open={!!siteToDelete}
        onClose={() => setSiteToDelete(null)}
        title={t('customers:sites.deleteTitle')}
        footer={
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setSiteToDelete(null)}>
              {tCommon('actions.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteConfirm}
              loading={deleteSiteMutation.isPending}
            >
              {tCommon('actions.delete')}
            </Button>
          </div>
        }
      >
        <p className="text-neutral-600 dark:text-neutral-400">
          {siteToDelete
            ? t('customers:sites.deleteMessage', {
                name: siteToDelete.site_name || siteToDelete.account_no || t('customers:sites.fields.siteName'),
              })
            : ''}
        </p>
      </Modal>
    </>
  );
}
