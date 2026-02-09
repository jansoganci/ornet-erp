import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import {
  Phone,
  Mail,
  MapPin,
  FileText,
  Edit,
  Trash2,
  Plus,
  Info,
  Building2,
  Cpu as SimIcon,
} from 'lucide-react';
import { useCustomer, useDeleteCustomer } from './hooks';
import { useWorkOrdersByCustomer } from '../workOrders/hooks';
import { useSitesByCustomer } from '../customerSites/hooks';
import { useSimCardsByCustomer } from '../simCards/hooks';
import { PageContainer, PageHeader } from '../../components/layout';
import {
  Button,
  IconButton,
  Card,
  Badge,
  Modal,
  Table,
  Skeleton,
  ErrorState,
} from '../../components/ui';
import {
  formatPhone,
  formatDate,
  workOrderStatusVariant,
} from '../../lib/utils';
import { SiteCard } from '../customerSites/SiteCard';
import { SiteFormModal } from '../customerSites/SiteFormModal';

function CustomerDetailSkeleton() {
  return (
    <PageContainer maxWidth="lg" padding="default">
      <div className="flex items-center gap-4 mb-6">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-6 space-y-6">
          <Skeleton className="h-6 w-1/4 mb-4" />
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-5 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-6 space-y-4">
          <Skeleton className="h-6 w-1/3 mb-4" />
          <div className="flex items-start gap-3">
            <Skeleton className="w-5 h-5 mt-1" />
            <Skeleton className="h-20 w-full" />
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}

export function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation(['customers', 'common', 'workOrders']);
  const { t: tCommon } = useTranslation('common');
  const { t: tWorkOrders } = useTranslation('workOrders');

  const { data: customer, isLoading, error, refetch } = useCustomer(id);
  const { data: sites = [], isLoading: sitesLoading } = useSitesByCustomer(id);
  const { data: workOrders = [], isLoading: workOrdersLoading } = useWorkOrdersByCustomer(id);
  const { data: simCards = [], isLoading: simCardsLoading } = useSimCardsByCustomer(id);
  const deleteCustomer = useDeleteCustomer();

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSiteModal, setShowSiteModal] = useState(false);
  const [selectedSite, setSelectedSite] = useState(null);

  const handleEdit = () => {
    navigate(`/customers/${id}/edit`);
  };

  const handleDelete = async () => {
    try {
      await deleteCustomer.mutateAsync(id);
      navigate('/customers', { replace: true });
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleAddSite = () => {
    setSelectedSite(null);
    setShowSiteModal(true);
  };

  const handleEditSite = (site) => {
    setSelectedSite(site);
    setShowSiteModal(true);
  };

  const handleNewWorkOrder = (siteId) => {
    navigate(`/work-orders/new?customerId=${id}${siteId ? `&siteId=${siteId}` : ''}`);
  };

  const handleAddSimCard = () => {
    navigate(`/sim-cards/new?customerId=${id}`);
  };

  const handleCall = (phone) => {
    if (!phone) return;
    window.location.href = `tel:${phone.replace(/\s/g, '')}`;
  };

  const workOrderColumns = [
    {
      key: 'work_type',
      header: tWorkOrders('form.fields.workType'),
      render: (_, wo) => (
        <div>
          <Badge variant="outline" size="sm" className="mb-1">
            {tCommon(`workType.${wo.work_type}`)}
          </Badge>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
            {wo.form_no || '---'}
          </p>
        </div>
      ),
    },
    {
      key: 'site',
      header: t('customers:sites.title'),
      render: (_, wo) => (
        <div>
          <p className="font-medium text-neutral-900 dark:text-neutral-50 truncate max-w-[150px]">
            {wo.site_name || wo.site_address}
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {wo.account_no || '---'}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: tWorkOrders('list.columns.status'),
      render: (_, wo) => (
        <Badge variant={workOrderStatusVariant[wo.status]} size="sm" dot>
          {tCommon(`status.${wo.status}`)}
        </Badge>
      ),
    },
    {
      key: 'scheduled_date',
      header: tWorkOrders('list.columns.scheduledDate'),
      render: (_, wo) => (
        <div className="text-sm">
          <p>{wo.scheduled_date ? formatDate(wo.scheduled_date) : '-'}</p>
          <p className="text-xs text-neutral-400">{wo.scheduled_time || ''}</p>
        </div>
      ),
    },
  ];

  const simCardColumns = [
    {
      key: 'phone_number',
      header: t('simCards:list.columns.phoneNumber'),
      render: (_, sim) => (
        <div className="font-medium text-neutral-900 dark:text-neutral-50">
          {sim.phone_number}
        </div>
      ),
    },
    {
      key: 'status',
      header: t('simCards:list.columns.status'),
      render: (_, sim) => (
        <Badge 
          variant={sim.status === 'active' ? 'success' : sim.status === 'available' ? 'info' : 'warning'} 
          size="sm"
        >
          {t(`simCards:status.${sim.status}`)}
        </Badge>
      ),
    },
    {
      key: 'site',
      header: t('simCards:list.columns.site'),
      render: (_, sim) => (
        <span className="text-sm text-neutral-600 dark:text-neutral-400">
          {sim.customer_sites?.site_name || '-'}
        </span>
      ),
    },
    {
      key: 'sale_price',
      header: t('simCards:list.columns.salePrice'),
      render: (_, sim) => (
        <span className="font-medium">
          {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: sim.currency || 'TRY' }).format(sim.sale_price)}
        </span>
      ),
    },
  ];

  if (isLoading) {
    return <CustomerDetailSkeleton />;
  }

  if (error || !customer) {
    return (
      <PageContainer maxWidth="lg" padding="default">
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
    <PageContainer maxWidth="lg" padding="default" className="space-y-6">
      <PageHeader
        title={customer.company_name}
        description={
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="primary" size="sm">
              {t('customers:sites.siteCount', { count: sites.length })}
            </Badge>
            {customer.tax_number && (
              <Badge variant="default" size="sm">
                {customer.tax_number}
              </Badge>
            )}
          </div>
        }
        breadcrumbs={[
          { label: tCommon('nav.customers') || 'Müşteriler', to: '/customers' },
          { label: customer.company_name }
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" leftIcon={<Edit className="w-4 h-4" />} onClick={handleEdit}>
              {t('detail.actions.edit')}
            </Button>
            <IconButton
              icon={Trash2}
              variant="ghost"
              aria-label={t('detail.actions.delete')}
              onClick={() => setShowDeleteModal(true)}
              className="text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-950/30"
            />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Sites Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 flex items-center">
                <MapPin className="w-5 h-5 mr-2 text-primary-600" />
                {t('customers:sites.title')}
              </h2>
              <Button 
                size="sm" 
                variant="outline" 
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={handleAddSite}
              >
                {t('customers:sites.addButton')}
              </Button>
            </div>

            {sitesLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
              </div>
            ) : sites.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sites.map(site => (
                  <SiteCard 
                    key={site.id} 
                    site={site} 
                    onEdit={handleEditSite}
                    onCreateWorkOrder={handleNewWorkOrder}
                    onViewHistory={(siteId) => navigate(`/work-history?siteId=${siteId}&type=account_no`)}
                  />
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center border-dashed">
                <MapPin className="w-12 h-12 text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
                <p className="text-neutral-500 dark:text-neutral-400">{t('customers:sites.noSites')}</p>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="mt-4 text-primary-600"
                  onClick={handleAddSite}
                >
                  {t('customers:sites.addButton')}
                </Button>
              </Card>
            )}
          </div>

          {/* Work History */}
          <Card padding="compact" header={
            <div className="flex items-center justify-between w-full">
              <h2 className="font-semibold text-neutral-900 dark:text-neutral-50 flex items-center">
                <Building2 className="w-5 h-5 mr-2 text-primary-600" />
                {t('detail.workHistory.title')}
              </h2>
              <Badge variant="secondary">{workOrders.length}</Badge>
            </div>
          }>
            <Table
              columns={workOrderColumns}
              data={workOrders}
              loading={workOrdersLoading}
              emptyMessage={t('detail.workHistory.empty')}
              onRowClick={(wo) => navigate(`/work-orders/${wo.id}`)}
            />
          </Card>

          {/* SIM Cards Section */}
          <Card padding="compact" header={
            <div className="flex items-center justify-between w-full">
              <h2 className="font-semibold text-neutral-900 dark:text-neutral-50 flex items-center">
                <SimIcon className="w-5 h-5 mr-2 text-primary-600" />
                {t('simCards:title')}
              </h2>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{simCards.length}</Badge>
                <Button 
                  size="xs" 
                  variant="outline" 
                  leftIcon={<Plus className="w-3 h-3" />}
                  onClick={handleAddSimCard}
                >
                  {t('simCards:actions.add')}
                </Button>
              </div>
            </div>
          }>
            <Table
              columns={simCardColumns}
              data={simCards}
              loading={simCardsLoading}
              emptyMessage={t('simCards:list.empty.title')}
              onRowClick={(sim) => navigate(`/sim-cards/${sim.id}/edit`)}
            />
          </Card>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <Card header={
            <h2 className="font-semibold text-neutral-900 dark:text-neutral-50 flex items-center">
              <Info className="w-5 h-5 mr-2 text-primary-600" />
              {t('detail.contactInfo')}
            </h2>
          } padding="compact">
            <div className="space-y-4">
              {customer.phone && (
                <div className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg group-hover:bg-primary-100 transition-colors">
                      <Phone className="w-4 h-4 text-primary-600" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">{t('form.fields.phone')}</p>
                      <p className="font-bold text-neutral-900 dark:text-neutral-50">{formatPhone(customer.phone)}</p>
                    </div>
                  </div>
                  <IconButton icon={Phone} size="sm" onClick={() => handleCall(customer.phone)} aria-label="Call" />
                </div>
              )}
              {customer.phone_secondary && (
                <div className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-neutral-50 dark:bg-neutral-800 rounded-lg group-hover:bg-neutral-100 transition-colors">
                      <Phone className="w-4 h-4 text-neutral-500" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">{t('form.fields.phoneSecondary')}</p>
                      <p className="font-bold text-neutral-900 dark:text-neutral-50">{formatPhone(customer.phone_secondary)}</p>
                    </div>
                  </div>
                  <IconButton icon={Phone} size="sm" onClick={() => handleCall(customer.phone_secondary)} aria-label="Call" />
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-3 group">
                  <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg group-hover:bg-primary-100 transition-colors">
                    <Mail className="w-4 h-4 text-primary-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">{t('form.fields.email')}</p>
                    <p className="font-bold text-neutral-900 dark:text-neutral-50 truncate">{customer.email}</p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card header={
            <h2 className="font-semibold text-neutral-900 dark:text-neutral-50 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-primary-600" />
              {t('detail.notes')}
            </h2>
          } padding="compact">
            {customer.notes ? (
              <p className="text-sm text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap italic">
                {customer.notes}
              </p>
            ) : (
              <p className="text-sm text-neutral-400 italic">{t('detail.noNotes')}</p>
            )}
          </Card>
        </div>
      </div>

      <SiteFormModal 
        open={showSiteModal} 
        onClose={() => setShowSiteModal(false)} 
        customerId={id} 
        site={selectedSite} 
      />

      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title={t('delete.title')}
        size="sm"
        footer={
          <div className="flex gap-3 w-full">
            <Button variant="ghost" onClick={() => setShowDeleteModal(false)} className="flex-1">
              {tCommon('actions.cancel')}
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deleteCustomer.isPending} className="flex-1">
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
