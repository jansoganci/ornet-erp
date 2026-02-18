import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { useCustomer, useDeleteCustomer } from './hooks';
import { useWorkOrdersByCustomer } from '../workOrders/hooks';
import { useSitesByCustomer } from '../customerSites/hooks';
import { useSimCardsByCustomer } from '../simCards/hooks';
import { useSubscriptions } from '../subscriptions/hooks';
import { useAssetsByCustomer } from '../siteAssets/hooks';
import { PageContainer } from '../../components/layout';
import { Button, Modal, Skeleton, ErrorState } from '../../components/ui';
import { CustomerHero } from './components/CustomerHero';
import { CustomerTabBar } from './components/CustomerTabBar';
import { CustomerOverviewTab } from './tabs/CustomerOverviewTab';
import { CustomerLocationsTab } from './tabs/CustomerLocationsTab';
import { CustomerWorkOrdersTab } from './tabs/CustomerWorkOrdersTab';
import { CustomerSimCardsTab } from './tabs/CustomerSimCardsTab';
import { CustomerEquipmentTab } from './tabs/CustomerEquipmentTab';

const VALID_TABS = ['overview', 'locations', 'workOrders', 'simCards', 'equipment'];

function CustomerDetailSkeleton() {
  return (
    <PageContainer maxWidth="full" padding="default">
      <div className="space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-24" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
        <Skeleton className="h-36 w-full rounded-xl" />
      </div>
      <Skeleton className="h-12 w-full rounded-xl mb-6" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    </PageContainer>
  );
}

export function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation('customers');
  const { t: tCommon } = useTranslation('common');

  // Data fetching
  const { data: customer, isLoading, error, refetch } = useCustomer(id);
  const { data: sites = [], isLoading: sitesLoading } = useSitesByCustomer(id);
  const { data: workOrders = [], isLoading: workOrdersLoading } = useWorkOrdersByCustomer(id);
  const { data: simCards = [], isLoading: simCardsLoading } = useSimCardsByCustomer(id);
  const { data: allSubscriptions = [] } = useSubscriptions({});
  const { data: assets = [] } = useAssetsByCustomer(id);
  const deleteCustomer = useDeleteCustomer();

  // Active tab — read from URL, fall back to 'overview'
  const rawTab = searchParams.get('tab');
  const activeTab = VALID_TABS.includes(rawTab) ? rawTab : 'overview';

  const handleTabChange = (tab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  };

  // Subscriptions grouped by site
  const siteIds = sites.map((s) => s.id);
  const customerSubscriptions = (allSubscriptions || []).filter((sub) =>
    siteIds.includes(sub.site_id)
  );
  const subscriptionsBySite = customerSubscriptions.reduce((acc, sub) => {
    if (!acc[sub.site_id]) acc[sub.site_id] = [];
    acc[sub.site_id].push(sub);
    return acc;
  }, {});

  // Computed counts for metrics
  const counts = {
    activeSubscriptions: customerSubscriptions.filter((s) => s.status === 'active').length,
    openWorkOrders: workOrders.filter(
      (wo) => !['completed', 'cancelled'].includes(wo.status)
    ).length,
    activeSimCards: simCards.filter((s) => s.status === 'active').length,
    faultyEquipment: assets.filter((a) => a.status === 'faulty').length,
  };

  // Monthly revenue — sum of active subscription base prices
  const monthlyRevenue = customerSubscriptions
    .filter((s) => s.status === 'active')
    .reduce((sum, s) => sum + (Number(s.base_price) || 0), 0);

  // Modals
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleEdit = () => navigate(`/customers/${id}/edit`);

  const handleDelete = async () => {
    try {
      await deleteCustomer.mutateAsync(id);
      navigate('/customers', { replace: true });
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleNewWorkOrder = (siteId) => {
    navigate(`/work-orders/new?customerId=${id}${siteId ? `&siteId=${siteId}` : ''}`);
  };

  // ── Loading ──
  if (isLoading) return <CustomerDetailSkeleton />;

  // ── Error ──
  if (error || !customer) {
    return (
      <PageContainer maxWidth="full" padding="default">
        <ErrorState
          message={error?.message || t('detail.notFound')}
          onRetry={() => refetch()}
          className="mb-4"
        />
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => navigate('/customers')}>
            {tCommon('actions.back')}
          </Button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="full" padding="default" className="space-y-5">
      {/* ── Hero ── */}
      <CustomerHero
        customer={customer}
        monthlyRevenue={monthlyRevenue}
        locationCount={sites.length}
        onEdit={handleEdit}
        onDelete={() => setShowDeleteModal(true)}
        onNewWorkOrder={() => handleNewWorkOrder()}
      />

      {/* ── Tab Bar ── */}
      <CustomerTabBar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        counts={{
          locations: sites.length,
          workOrders: workOrders.length,
          simCards: simCards.length,
          equipment: assets.filter((a) => a.status !== 'removed').length,
        }}
      />

      {/* ── Tab Content ── */}
      {activeTab === 'overview' && (
        <CustomerOverviewTab
          customer={customer}
          sites={sites}
          workOrders={workOrders}
          assets={assets}
          counts={counts}
          subscriptionsBySite={subscriptionsBySite}
          onTabSwitch={handleTabChange}
          navigate={navigate}
          customerId={id}
        />
      )}

      {activeTab === 'locations' && (
        <CustomerLocationsTab
          customerId={id}
          sites={sites}
          sitesLoading={sitesLoading}
          subscriptionsBySite={subscriptionsBySite}
          onNewWorkOrder={handleNewWorkOrder}
          navigate={navigate}
        />
      )}

      {activeTab === 'workOrders' && (
        <CustomerWorkOrdersTab
          customerId={id}
          workOrders={workOrders}
          workOrdersLoading={workOrdersLoading}
          navigate={navigate}
        />
      )}

      {activeTab === 'simCards' && (
        <CustomerSimCardsTab
          customerId={id}
          simCards={simCards}
          simCardsLoading={simCardsLoading}
          navigate={navigate}
        />
      )}

      {activeTab === 'equipment' && (
        <CustomerEquipmentTab customerId={id} sites={sites} />
      )}

      {/* ── Delete Confirm Modal ── */}
      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title={t('delete.title')}
        size="sm"
        footer={
          <div className="flex gap-3 w-full">
            <Button
              variant="ghost"
              onClick={() => setShowDeleteModal(false)}
              className="flex-1"
            >
              {tCommon('actions.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              loading={deleteCustomer.isPending}
              className="flex-1"
            >
              {tCommon('actions.delete')}
            </Button>
          </div>
        }
      >
        <p>{t('delete.message', { name: customer.company_name })}</p>
        <p className="mt-2 text-sm text-error-600 font-bold">{t('delete.warning')}</p>
      </Modal>
    </PageContainer>
  );
}
