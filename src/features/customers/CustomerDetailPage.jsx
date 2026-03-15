import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState, useMemo } from 'react';
import { useCustomer, useDeleteCustomer } from './hooks';
import { useWorkOrdersByCustomer } from '../workOrders/hooks';
import { useSitesByCustomer } from '../customerSites/hooks';
import { useSimCardsByCustomer } from '../simCards/hooks';
import { useCustomerSubscriptions } from '../subscriptions/hooks';
import { useAssetsByCustomer } from '../siteAssets/hooks';
import { PageContainer } from '../../components/layout';
import { Button, Modal, Skeleton, ErrorState } from '../../components/ui';
import { CustomerDetailProvider } from './CustomerDetailContext';
import { CustomerHero } from './components/CustomerHero';
import { CustomerTabBar } from './components/CustomerTabBar';
import { CustomerOverviewTab } from './tabs/CustomerOverviewTab';
import { CustomerLocationsTab } from './tabs/CustomerLocationsTab';
import { CustomerWorkOrdersTab } from './tabs/CustomerWorkOrdersTab';
import { CustomerSimCardsTab } from './tabs/CustomerSimCardsTab';
import { CustomerEquipmentTab } from './tabs/CustomerEquipmentTab';
import { useRole } from '../../lib/roles';

const ALL_TABS = ['overview', 'locations', 'workOrders', 'simCards', 'equipment'];
const FIELD_WORKER_TABS = ['overview', 'locations', 'workOrders', 'equipment'];

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
  const { isFieldWorker, canWrite } = useRole();

  const validTabs = isFieldWorker ? FIELD_WORKER_TABS : ALL_TABS;

  // Data fetching
  const { data: customer, isLoading, error, refetch } = useCustomer(id);
  const { data: sites = [], isLoading: sitesLoading } = useSitesByCustomer(id);
  const { data: workOrders = [], isLoading: workOrdersLoading } = useWorkOrdersByCustomer(id);
  const { data: simCards = [], isLoading: simCardsLoading } = useSimCardsByCustomer(id);
  const { data: customerSubscriptions = [] } = useCustomerSubscriptions(id);
  const { data: assets = [] } = useAssetsByCustomer(id);
  const deleteCustomer = useDeleteCustomer();

  // Active tab — read from URL, fall back to 'overview'
  const rawTab = searchParams.get('tab');
  const activeTab = validTabs.includes(rawTab) ? rawTab : 'overview';

  const handleTabChange = (tab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  };

  // Subscriptions grouped by site (memoized)
  const subscriptionsBySite = useMemo(() => {
    return (customerSubscriptions || []).reduce((acc, sub) => {
      if (!acc[sub.site_id]) acc[sub.site_id] = [];
      acc[sub.site_id].push(sub);
      return acc;
    }, {});
  }, [customerSubscriptions]);

  // Computed counts for metrics (memoized)
  const counts = useMemo(() => ({
    activeSubscriptions: (customerSubscriptions || []).filter((s) => s.status === 'active').length,
    openWorkOrders: (workOrders || []).filter(
      (wo) => !['completed', 'cancelled'].includes(wo.status)
    ).length,
    activeSimCards: (simCards || []).filter((s) => s.status === 'active').length,
    faultyEquipment: (assets || []).filter((a) => a.status === 'faulty').length,
  }), [customerSubscriptions, workOrders, simCards, assets]);

  // Monthly revenue — sum of active subscription base prices (memoized)
  const monthlyRevenue = useMemo(
    () => (customerSubscriptions || [])
      .filter((s) => s.status === 'active')
      .reduce((sum, s) => sum + (Number(s.base_price) || 0), 0),
    [customerSubscriptions]
  );

  // Modals
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleEdit = () => navigate(`/customers/${id}/edit`);

  const handleDelete = async () => {
    try {
      await deleteCustomer.mutateAsync(id);
      navigate('/customers', { replace: true });
    } catch {
      // error handled by mutation onError
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

  const detailContextValue = useMemo(
    () => ({
      customerId: id,
      customer,
      sites,
      workOrders,
      simCards,
      assets,
      subscriptionsBySite,
      counts,
      navigate,
      onNewWorkOrder: handleNewWorkOrder,
      onTabChange: handleTabChange,
      sitesLoading,
      workOrdersLoading,
      simCardsLoading,
    }),
    [
      id,
      customer,
      sites,
      workOrders,
      simCards,
      assets,
      subscriptionsBySite,
      counts,
      navigate,
      handleNewWorkOrder,
      handleTabChange,
      sitesLoading,
      workOrdersLoading,
      simCardsLoading,
    ]
  );

  return (
    <PageContainer maxWidth="full" padding="default" className="space-y-5">
      {/* ── Hero ── */}
      <CustomerHero
        customer={customer}
        monthlyRevenue={canWrite ? monthlyRevenue : 0}
        locationCount={sites.length}
        onEdit={canWrite ? handleEdit : undefined}
        onDelete={canWrite ? () => setShowDeleteModal(true) : undefined}
        onNewWorkOrder={() => handleNewWorkOrder()}
      />

      {/* ── Tab Bar ── */}
      <CustomerTabBar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        allowedTabs={validTabs}
        counts={{
          locations: sites.length,
          workOrders: workOrders.length,
          simCards: simCards.length,
          equipment: assets.filter((a) => a.status !== 'removed').length,
        }}
      />

      {/* ── Tab Content ── */}
      <CustomerDetailProvider value={detailContextValue}>
        {activeTab === 'overview' && <CustomerOverviewTab />}
        {activeTab === 'locations' && <CustomerLocationsTab />}
        {activeTab === 'workOrders' && <CustomerWorkOrdersTab />}
        {activeTab === 'simCards' && <CustomerSimCardsTab />}
        {activeTab === 'equipment' && <CustomerEquipmentTab />}
      </CustomerDetailProvider>

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
