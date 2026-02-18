import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Plus } from 'lucide-react';
import { Button, Card, Skeleton } from '../../../components/ui';
import { SiteCard } from '../../customerSites/SiteCard';
import { SiteFormModal } from '../../customerSites/SiteFormModal';

export function CustomerLocationsTab({
  customerId,
  sites = [],
  sitesLoading = false,
  subscriptionsBySite = {},
  onNewWorkOrder,
  navigate,
}) {
  const { t } = useTranslation('customers');

  const [showSiteModal, setShowSiteModal] = useState(false);
  const [selectedSite, setSelectedSite] = useState(null);

  const handleAddSite = () => {
    setSelectedSite(null);
    setShowSiteModal(true);
  };

  const handleEditSite = (site) => {
    setSelectedSite(site);
    setShowSiteModal(true);
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">
            {t('sites.title')}
          </h2>
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={handleAddSite}
          >
            {t('sites.addButton')}
          </Button>
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
                onEdit={handleEditSite}
                onCreateWorkOrder={onNewWorkOrder}
                onViewHistory={(siteId) =>
                  navigate(`/work-history?siteId=${siteId}&type=account_no`)
                }
                onAddSubscription={(s) =>
                  navigate(`/subscriptions/new?siteId=${s.id}&customerId=${customerId}`)
                }
              />
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center border-dashed">
            <MapPin className="w-12 h-12 text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
            <p className="text-neutral-500 dark:text-neutral-400">{t('sites.noSites')}</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-4 text-primary-600"
              onClick={handleAddSite}
            >
              {t('sites.addButton')}
            </Button>
          </Card>
        )}
      </div>

      <SiteFormModal
        open={showSiteModal}
        onClose={() => setShowSiteModal(false)}
        customerId={customerId}
        site={selectedSite}
      />
    </>
  );
}
