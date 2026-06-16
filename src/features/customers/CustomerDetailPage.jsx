import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  SearchX,
  ChevronLeft,
  Edit,
  Plus,
  MapPin,
  ChevronRight,
  ChevronDown,
  Download,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';
import { useCustomer, useDeleteCustomer, useCustomerAuditLogs } from './hooks';
import { useWorkOrdersByCustomer } from '../workOrders/hooks';
import { useSitesByCustomer } from '../customerSites/hooks';
import { useSimCardsByCustomer } from '../simCards/hooks';
import {
  useCustomerSubscriptions,
  usePaymentMethods,
  usePendingPaymentInsights,
} from '../subscriptions/hooks';
import { useAssetsByCustomer } from '../siteAssets/hooks';
import { PageContainer } from '../../components/layout';
import {
  Button,
  Modal,
  Skeleton,
  ErrorState,
  EmptyState,
  Badge,
  Table,
  Select,
  IconButton,
  SearchInput,
} from '../../components/ui';
import { CustomerDetailProvider } from './CustomerDetailContext';
import { CustomerOverviewTab } from './tabs/CustomerOverviewTab';
import { CustomerLocationsTab } from './tabs/CustomerLocationsTab';
import { CustomerSimCardsTab } from './tabs/CustomerSimCardsTab';
import { CustomerEquipmentTab } from './tabs/CustomerEquipmentTab';
import { ParasutHistoryTab } from './components/ParasutHistoryTab';
import { CustomerDetailSummary } from './components/CustomerDetailSummary';
import { useRole } from '../../lib/roles';
import { cn, formatDate, workOrderStatusVariant } from '../../lib/utils';
import { normalizeForSearch } from '../../lib/normalizeForSearch';
import { toCSV, downloadCSV } from '../../lib/csvExport';

const LOG_TABS = ['workOrders', 'assets', 'logs'];
const LEGACY_TABS = ['overview', 'locations', 'simCards'];
const FIELD_LEGACY = ['overview', 'locations'];

const PAGE_SIZE = 8;

/** Ornet design system: surfaces + labels (see src/index.css) */
const PAGE_BG = 'bg-neutral-50 dark:bg-[#0a0a0a]';
const SURFACE =
  'rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-[#262626] dark:bg-[#171717]';
const TEXT_MUTED = 'text-neutral-500 dark:text-neutral-400';
const INPUT_SURFACE =
  'border-neutral-200 bg-white text-neutral-900 dark:border-[#262626] dark:bg-[#171717] dark:text-neutral-100';

/** Top secondary nav — same control for Özet + tab buttons (font: Inter via theme, text-xs = 12px) */
function topNavItemClass(active) {
  return cn(
    'inline-flex cursor-pointer items-center justify-center border-0 bg-transparent p-0 font-sans',
    'text-xs font-semibold uppercase tracking-wide transition-colors rounded-lg px-2 py-1.5',
    active
      ? 'text-primary-600 dark:text-primary-400'
      : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
  );
}

function CustomerDetailSkeleton() {
  return (
    <PageContainer maxWidth="full" padding="default" className={cn(PAGE_BG, 'space-y-4')}>
      <Skeleton className="h-28 w-full rounded-xl bg-neutral-200 dark:bg-neutral-800" />
      <Skeleton className="h-16 w-full rounded-xl bg-neutral-200 dark:bg-neutral-800" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-56 w-full rounded-xl bg-neutral-200 dark:bg-neutral-800 lg:col-span-2" />
        <Skeleton className="h-56 w-full rounded-xl bg-neutral-200 dark:bg-neutral-800" />
      </div>
      <Skeleton className="h-80 w-full rounded-xl bg-neutral-200 dark:bg-neutral-800" />
    </PageContainer>
  );
}

export function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation('customers');
  const { t: tCommon } = useTranslation('common');
  const { t: tWO } = useTranslation('workOrders');
  const { isFieldWorker, canWrite, isAdmin } = useRole();

  const allowedLegacy = isFieldWorker ? FIELD_LEGACY : LEGACY_TABS;
  const allowedBottomTabs = useMemo(() => {
    const base = isAdmin ? LOG_TABS : LOG_TABS.filter((k) => k !== 'logs');
    if (canWrite && import.meta.env.VITE_PARASUT_ENABLED === 'true') {
      return [...base, 'parasut'];
    }
    return base;
  }, [canWrite, isAdmin]);

  const tabParam = searchParams.get('tab');
  const hasExplicitTab = tabParam != null && tabParam !== '';
  const normalizedTab = !hasExplicitTab
    ? null
    : tabParam === 'equipment'
      ? 'assets'
      : tabParam;
  const isLegacyTab =
    hasExplicitTab && normalizedTab != null && allowedLegacy.includes(normalizedTab);
  const bottomTab = !hasExplicitTab
    ? 'workOrders'
    : !isLegacyTab && normalizedTab != null && allowedBottomTabs.includes(normalizedTab)
      ? normalizedTab
      : 'workOrders';

  const [selectedSiteId, setSelectedSiteId] = useState(null);
  const [woSearch, setWoSearch] = useState('');
  const [woStatus, setWoStatus] = useState('all');
  const [woPage, setWoPage] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [headerActionsOpen, setHeaderActionsOpen] = useState(false);
  const headerActionsRef = useRef(null);

  useEffect(() => {
    if (!headerActionsOpen) return;
    const close = (e) => {
      if (headerActionsRef.current && !headerActionsRef.current.contains(e.target)) {
        setHeaderActionsOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [headerActionsOpen]);

  const goToSummary = useCallback(() => {
    navigate(`/customers/${id}`);
  }, [id, navigate]);

  const setTab = useCallback(
    (tab) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', tab);
        return next;
      });
    },
    [setSearchParams]
  );

  const { data: customer, isLoading, error, refetch } = useCustomer(id);
  const { data: sites = [], isLoading: sitesLoading } = useSitesByCustomer(id);
  const { data: workOrders = [], isLoading: workOrdersLoading } = useWorkOrdersByCustomer(id);
  const { data: simCards = [], isLoading: simCardsLoading } = useSimCardsByCustomer(canWrite ? id : null);
  const { data: customerSubscriptions = [] } = useCustomerSubscriptions(canWrite ? id : null);
  const { data: assets = [] } = useAssetsByCustomer(id);
  const { data: paymentMethods = [] } = usePaymentMethods(canWrite ? id : null);

  const subscriptionIdsAll = useMemo(
    () => (customerSubscriptions || []).map((s) => s.id).filter(Boolean),
    [customerSubscriptions]
  );

  const { data: paymentInsights } = usePendingPaymentInsights(subscriptionIdsAll, canWrite);

  const { data: auditLogs = [], isLoading: auditLoading } = useCustomerAuditLogs(
    id,
    subscriptionIdsAll,
    isAdmin
  );

  const deleteCustomer = useDeleteCustomer();

  const subscriptionsBySite = useMemo(() => {
    return (customerSubscriptions || []).reduce((acc, sub) => {
      if (!acc[sub.site_id]) acc[sub.site_id] = [];
      acc[sub.site_id].push(sub);
      return acc;
    }, {});
  }, [customerSubscriptions]);

  const counts = useMemo(
    () => ({
      activeSubscriptions: (customerSubscriptions || []).filter((s) => s.status === 'active').length,
      openWorkOrders: (workOrders || []).filter((wo) => !['completed', 'cancelled'].includes(wo.status))
        .length,
      activeSimCards: (simCards || []).filter((s) => s.status === 'active').length,
      faultyEquipment: 0,
    }),
    [customerSubscriptions, workOrders, simCards]
  );

  const visibleSubscriptions = useMemo(() => {
    const list = customerSubscriptions || [];
    if (!selectedSiteId) return list;
    return list.filter((s) => s.site_id === selectedSiteId);
  }, [customerSubscriptions, selectedSiteId]);

  const activeSubscriptionsFiltered = useMemo(
    () => visibleSubscriptions.filter((s) => s.status === 'active'),
    [visibleSubscriptions]
  );

  const monthlyRevenue = useMemo(
    () =>
      activeSubscriptionsFiltered.reduce((sum, s) => sum + (Number(s.subtotal) || 0), 0),
    [activeSubscriptionsFiltered]
  );

  const primarySite = useMemo(() => {
    if (selectedSiteId) return sites.find((s) => s.id === selectedSiteId) || null;
    return sites[0] || null;
  }, [sites, selectedSiteId]);

  const headerAddress = useMemo(() => {
    if (!sites.length) return '';
    if (selectedSiteId && primarySite) {
      return [primarySite.address, primarySite.district, primarySite.city].filter(Boolean).join(', ');
    }
    if (sites.length === 1) {
      const s = sites[0];
      return [s.address, s.district, s.city].filter(Boolean).join(', ');
    }
    return t('sites.siteCount', { count: sites.length });
  }, [sites, selectedSiteId, primarySite, t]);

  const billingAddressLines = useMemo(() => {
    const parts = [customer?.address, customer?.district, customer?.city].filter(Boolean);
    return parts.join(', ') || '—';
  }, [customer]);

  const accountManagerName = useMemo(() => {
    const active = (customerSubscriptions || []).filter((s) => s.status === 'active');
    const withMgr = active.find((s) => s.managed_by_name)?.managed_by_name;
    return withMgr || (customerSubscriptions || []).find((s) => s.managed_by_name)?.managed_by_name || null;
  }, [customerSubscriptions]);

  const defaultPaymentMethod = useMemo(
    () => paymentMethods.find((p) => p.is_default) || paymentMethods[0] || null,
    [paymentMethods]
  );

  const filteredWorkOrders = useMemo(() => {
    let list = workOrders || [];
    if (selectedSiteId) {
      list = list.filter((wo) => wo.site_id === selectedSiteId);
    }
    if (woStatus !== 'all') {
      list = list.filter((wo) => wo.status === woStatus);
    }
    if (woSearch.trim()) {
      const n = normalizeForSearch(woSearch);
      list = list.filter((wo) => {
        const hay = normalizeForSearch(
          [wo.description, wo.form_no, wo.work_type, wo.site_name, wo.account_no].filter(Boolean).join(' ')
        );
        return hay.includes(n);
      });
    }
    return list;
  }, [workOrders, selectedSiteId, woStatus, woSearch]);

  const workOrderPageCount = Math.max(1, Math.ceil(filteredWorkOrders.length / PAGE_SIZE));
  const workOrderSlice = useMemo(() => {
    const start = woPage * PAGE_SIZE;
    return filteredWorkOrders.slice(start, start + PAGE_SIZE);
  }, [filteredWorkOrders, woPage]);

  const siteFilterOptions = useMemo(() => {
    const opts = [{ value: '', label: t('detail.profileLayout.siteAll') }];
    for (const s of sites) {
      opts.push({
        value: s.id,
        label: s.site_name || s.account_no || s.id,
      });
    }
    return opts;
  }, [sites, t]);

  const statusFilterOptions = useMemo(
    () => [
      { value: 'all', label: t('detail.profileLayout.workOrdersPanel.allStatuses') },
      { value: 'pending', label: tCommon('status.pending') },
      { value: 'scheduled', label: tCommon('status.scheduled') },
      { value: 'in_progress', label: tCommon('status.in_progress') },
      { value: 'completed', label: tCommon('status.completed') },
      { value: 'cancelled', label: tCommon('status.cancelled') },
    ],
    [t, tCommon]
  );

  const handleEdit = () => navigate(`/customers/${id}/edit`);

  const handleDelete = async () => {
    try {
      await deleteCustomer.mutateAsync(id);
      navigate('/customers', { replace: true });
    } catch {
      // mutation onError
    }
  };

  const handleNewWorkOrder = useCallback(
    (siteId) => {
      navigate(`/work-orders/new?customerId=${id}${siteId ? `&siteId=${siteId}` : ''}`);
    },
    [id, navigate]
  );

  const handleAddSubscription = () => {
    const siteId = selectedSiteId || (sites.length === 1 ? sites[0].id : null);
    const q = new URLSearchParams({ customerId: id });
    if (siteId) q.set('siteId', siteId);
    navigate(`/subscriptions/new?${q.toString()}`);
  };

  const handleWorkOrderExport = () => {
    const cols = [
      { key: 'form_no', header: t('detail.profileLayout.workOrdersPanel.columnId') },
      { key: 'work_type', header: t('detail.profileLayout.workOrdersPanel.columnService') },
      { key: 'technicians', header: t('detail.profileLayout.workOrdersPanel.columnTechnician') },
      { key: 'scheduled_date', header: t('detail.profileLayout.workOrdersPanel.columnScheduled') },
      { key: 'status', header: t('detail.profileLayout.workOrdersPanel.columnStatus') },
    ];
    const rows = filteredWorkOrders.map((wo) => ({
      form_no: wo.form_no || '',
      work_type: tCommon(`workType.${wo.work_type}`),
      technicians: (wo.assigned_workers || []).map((w) => w.name).join(', '),
      scheduled_date: wo.scheduled_date ? formatDate(wo.scheduled_date) : '',
      status: tCommon(`status.${wo.status}`),
    }));
    downloadCSV(toCSV(rows, cols), `work-orders-${id}.csv`);
  };

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
      onTabChange: setTab,
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
      setTab,
      sitesLoading,
      workOrdersLoading,
      simCardsLoading,
      handleNewWorkOrder,
    ]
  );

  if (isLoading) return <CustomerDetailSkeleton />;

  if (error) {
    return (
      <PageContainer maxWidth="full" padding="default" className={PAGE_BG}>
        <ErrorState message={error.message} onRetry={() => refetch()} className="mb-4" />
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => navigate('/customers')}>
            {tCommon('actions.back')}
          </Button>
        </div>
      </PageContainer>
    );
  }

  if (!customer) {
    return (
      <PageContainer maxWidth="full" padding="default" className={PAGE_BG}>
        <div className="space-y-4">
          <EmptyState icon={SearchX} title={t('detail.notFound')} description={tCommon('noData')} />
          <div className="flex justify-center">
            <Button variant="outline" onClick={() => navigate('/customers')}>
              {tCommon('actions.back')}
            </Button>
          </div>
        </div>
      </PageContainer>
    );
  }

  const currency = activeSubscriptionsFiltered[0]?.currency || 'TRY';
  const fmtMoney = (n) =>
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency, minimumFractionDigits: 0 }).format(
      Number(n) || 0
    );

  const nextInvoiceLabel = paymentInsights?.earliestPendingMonth
    ? t('detail.profileLayout.financial.nextInvoiceHint', {
        date: formatDate(paymentInsights.earliestPendingMonth),
      })
    : t('detail.profileLayout.financial.nextInvoiceUnknown');

  const fromIdx = filteredWorkOrders.length ? woPage * PAGE_SIZE + 1 : 0;
  const toIdx = Math.min((woPage + 1) * PAGE_SIZE, filteredWorkOrders.length);

  const workOrderColumns = [
    {
      key: 'form_no',
      header: t('detail.profileLayout.workOrdersPanel.columnId'),
      render: (_, wo) => <span className="font-medium text-sm">{wo.form_no || '—'}</span>,
    },
    {
      key: 'work_type',
      header: t('detail.profileLayout.workOrdersPanel.columnService'),
      render: (_, wo) => (
        <div>
          <p className="text-sm font-bold text-neutral-900 dark:text-neutral-50">
            {tCommon(`workType.${wo.work_type}`)}
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate max-w-[220px]">
            {wo.description || '—'}
          </p>
        </div>
      ),
    },
    {
      key: 'technicians',
      header: t('detail.profileLayout.workOrdersPanel.columnTechnician'),
      render: (_, wo) => {
        const workers = wo.assigned_workers || [];
        if (!workers.length) {
          return <span className="text-sm text-neutral-500 dark:text-neutral-400">—</span>;
        }
        return (
          <span className="text-sm text-neutral-700 dark:text-neutral-200">
            {workers.map((w) => w.name).join(', ')}
          </span>
        );
      },
    },
    {
      key: 'scheduled_date',
      header: t('detail.profileLayout.workOrdersPanel.columnScheduled'),
      render: (_, wo) => (
        <span className="text-sm tabular-nums">{wo.scheduled_date ? formatDate(wo.scheduled_date) : '—'}</span>
      ),
    },
    {
      key: 'status',
      header: t('detail.profileLayout.workOrdersPanel.columnStatus'),
      render: (_, wo) => (
        <Badge variant={workOrderStatusVariant[wo.status]} size="sm" dot>
          {tCommon(`status.${wo.status}`)}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: t('detail.profileLayout.workOrdersPanel.columnActions'),
      align: 'right',
      render: (_, wo) => (
        <IconButton
          icon={MoreHorizontal}
          variant="ghost"
          size="sm"
          className="text-primary-600 opacity-80 hover:opacity-100 dark:text-primary-400"
          aria-label={tWO('list.title')}
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/work-orders/${wo.id}`);
          }}
        />
      ),
    },
  ];

  const logColumns = [
    {
      key: 'created_at',
      header: t('detail.profileLayout.logs.columnWhen'),
      render: (v) => (
        <span className="text-sm tabular-nums text-neutral-700 dark:text-neutral-200">
          {v ? formatDate(v.slice(0, 10)) : '—'}
        </span>
      ),
    },
    {
      key: 'action',
      header: t('detail.profileLayout.logs.columnAction'),
      render: (_, row) => <Badge variant="outline" size="sm">{row.action}</Badge>,
    },
    {
      key: 'table_name',
      header: t('detail.profileLayout.logs.columnTable'),
      render: (_, row) => (
        <span className="text-sm text-neutral-600 dark:text-neutral-300">{row.table_name}</span>
      ),
    },
    {
      key: 'description',
      header: t('detail.profileLayout.logs.columnDetail'),
      render: (_, row) => (
        <span className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md truncate block">
          {row.description || '—'}
        </span>
      ),
    },
  ];

  return (
    <PageContainer
      maxWidth="full"
      padding="default"
      background="transparent"
      className={cn(PAGE_BG, 'font-sans text-neutral-900 dark:text-neutral-50 pb-10')}
    >
      {/* Single column: header + grids share PageContainer width (no negative margins) */}
      <div className="flex w-full max-w-full flex-col gap-4 lg:gap-5">
        {/* Sticky compact header */}
        <header
          className={cn(
            'sticky top-16 z-30 w-full min-w-0 overflow-hidden space-y-3 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm backdrop-blur-sm sm:p-4',
            'dark:border-[#262626] dark:bg-[#171717]'
          )}
        >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            to="/customers"
            className={cn(
              'inline-flex items-center gap-1.5 text-sm font-medium transition-colors',
              TEXT_MUTED,
              'hover:text-primary-600 dark:hover:text-primary-400'
            )}
          >
            <ChevronLeft className="w-4 h-4" />
            {tCommon('nav.customers')}
          </Link>
          <nav className="flex flex-wrap items-center gap-1 sm:gap-2" aria-label={t('detail.title')}>
            <button type="button" onClick={goToSummary} className={topNavItemClass(!hasExplicitTab)}>
              {t('detail.profileLayout.linkSummary')}
            </button>
            <button
              type="button"
              onClick={() => setTab('locations')}
              className={topNavItemClass(hasExplicitTab && normalizedTab === 'locations')}
            >
              {t('detail.profileLayout.linkLocations')}
            </button>
            {!isFieldWorker && (
              <button
                type="button"
                onClick={() => setTab('simCards')}
                className={topNavItemClass(hasExplicitTab && normalizedTab === 'simCards')}
              >
                {t('detail.profileLayout.linkSimCards')}
              </button>
            )}
          </nav>
        </div>

        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="min-w-0 text-xl font-bold tracking-tight text-neutral-900 break-words sm:text-2xl dark:text-neutral-50">
                {customer.company_name}
              </h1>
              <span
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                  'border-success-200 bg-success-50 text-success-800',
                  'dark:border-success-800 dark:bg-success-950/40 dark:text-success-300'
                )}
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success-500" />
                {t('detail.profileLayout.statusActive')}
              </span>
              {customer.account_number && (
                <span className={cn('text-xs font-medium tabular-nums', TEXT_MUTED)}>
                  #{customer.account_number}
                </span>
              )}
            </div>
            {headerAddress && (
              <p className={cn('flex items-center gap-1.5 text-sm', TEXT_MUTED)}>
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{headerAddress}</span>
              </p>
            )}
            {canWrite && (
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-semibold tabular-nums text-neutral-800 dark:border-[#333] dark:bg-neutral-800/60 dark:text-neutral-100">
                  {t('detail.profileLayout.financial.monthlyBilling')}: {fmtMoney(monthlyRevenue)}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-semibold tabular-nums',
                    (paymentInsights?.overdueTotal || 0) > 0
                      ? 'border-error-200 bg-error-50 text-error-700 dark:border-error-900 dark:bg-error-950/40 dark:text-error-300'
                      : 'border-neutral-200 bg-neutral-50 text-neutral-800 dark:border-[#333] dark:bg-neutral-800/60 dark:text-neutral-100'
                  )}
                >
                  {t('detail.profileLayout.financial.pendingBalance')}:{' '}
                  {fmtMoney(paymentInsights?.overdueTotal || 0)}
                </span>
                <span className="inline-flex items-center rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-neutral-800 dark:border-[#333] dark:bg-neutral-800/60 dark:text-neutral-100">
                  {t('detail.profileLayout.servicesCount', { count: activeSubscriptionsFiltered.length })}
                </span>
              </div>
            )}
          </div>

          <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end lg:w-auto lg:max-w-full lg:shrink lg:justify-end">
            {sites.length > 0 && (
              <div className="min-w-0 w-full sm:w-auto sm:min-w-[10rem] sm:max-w-[14rem] sm:flex-1 lg:flex-none">
                <Select
                  label={t('detail.profileLayout.siteScopeLabel')}
                  size="sm"
                  options={siteFilterOptions}
                  value={selectedSiteId ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSelectedSiteId(v || null);
                    setWoPage(0);
                  }}
                  className={cn(INPUT_SURFACE, '[&_select]:bg-inherit [&_select]:text-inherit')}
                />
              </div>
            )}
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => handleNewWorkOrder(selectedSiteId || undefined)}
                className="rounded-lg"
              >
                {t('detail.actions.newWorkOrder')}
              </Button>
              {canWrite && (
                <div className="relative" ref={headerActionsRef}>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    rightIcon={<ChevronDown className="w-4 h-4" />}
                    onClick={() => setHeaderActionsOpen((o) => !o)}
                    className="rounded-lg dark:border-[#262626] dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
                  >
                    {t('detail.profileLayout.moreActions')}
                  </Button>
                  {headerActionsOpen && (
                    <div
                      className="absolute right-0 z-50 mt-1 min-w-[12.5rem] rounded-xl border border-neutral-200 bg-white py-1 shadow-lg dark:border-[#262626] dark:bg-[#171717]"
                      role="menu"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-neutral-800 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
                        onClick={() => {
                          setHeaderActionsOpen(false);
                          handleEdit();
                        }}
                      >
                        <Edit className="h-4 w-4 shrink-0 text-neutral-400" />
                        {t('detail.actions.edit')}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-neutral-800 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
                        onClick={() => {
                          setHeaderActionsOpen(false);
                          handleAddSubscription();
                        }}
                      >
                        <Plus className="h-4 w-4 shrink-0 text-neutral-400" />
                        {t('detail.profileLayout.addSubscription')}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-error-600 hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-950/30"
                        onClick={() => {
                          setHeaderActionsOpen(false);
                          setShowDeleteModal(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 shrink-0" />
                        {t('detail.actions.delete')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {!isLegacyTab && (
        <CustomerDetailSummary
          customer={customer}
          primarySite={primarySite}
          billingAddressLines={billingAddressLines}
          accountManagerName={accountManagerName}
          activeSubscriptions={activeSubscriptionsFiltered}
          monthlyRevenue={monthlyRevenue}
          paymentInsights={paymentInsights}
          defaultPaymentMethod={defaultPaymentMethod}
          fmtMoney={fmtMoney}
          nextInvoiceLabel={nextInvoiceLabel}
          canWrite={canWrite}
        />
      )}

      {/* Legacy full-width panels */}
      {isLegacyTab && (
        <CustomerDetailProvider value={detailContextValue}>
          <div className="w-full min-w-0">
            <div className="flex justify-end mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={goToSummary}
                className="text-primary-600 dark:text-primary-400"
              >
                {t('detail.profileLayout.linkSummary')}
              </Button>
            </div>
            {normalizedTab === 'overview' && <CustomerOverviewTab />}
            {normalizedTab === 'locations' && <CustomerLocationsTab />}
            {normalizedTab === 'simCards' && !isFieldWorker && <CustomerSimCardsTab />}
          </div>
        </CustomerDetailProvider>
      )}

      {/* Bottom tabbed section */}
      {!isLegacyTab && (
        <section className={cn(SURFACE, 'w-full min-w-0 overflow-hidden')}>
          <div className="flex flex-wrap border-b border-neutral-200 bg-neutral-50 dark:border-[#262626] dark:bg-neutral-900/60">
            {allowedBottomTabs.map((tabKey) => {
              const active = bottomTab === tabKey;
              return (
                <button
                  key={tabKey}
                  type="button"
                  onClick={() => setTab(tabKey)}
                  className={cn(
                    '-mb-px border-b-2 px-4 py-3 text-xs font-semibold uppercase tracking-wide transition-colors sm:px-6',
                    active
                      ? 'border-primary-600 bg-primary-50 text-primary-700 dark:border-primary-500 dark:bg-primary-950/30 dark:text-primary-400'
                      : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100'
                  )}
                >
                  {t(`detail.profileLayout.bottomTabs.${tabKey === 'workOrders' ? 'workOrders' : tabKey === 'assets' ? 'assets' : tabKey === 'parasut' ? 'parasut' : 'logs'}`)}
                </button>
              );
            })}
          </div>

          <div className="p-4 sm:p-5">
            <CustomerDetailProvider value={detailContextValue}>
              {bottomTab === 'workOrders' && (
                <div className="space-y-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="w-full sm:w-64">
                        <SearchInput
                          value={woSearch}
                          onChange={(v) => {
                            setWoSearch(v);
                            setWoPage(0);
                          }}
                          placeholder={t('detail.profileLayout.workOrdersPanel.searchPlaceholder')}
                          className={cn(INPUT_SURFACE, 'placeholder:text-neutral-400 dark:placeholder:text-neutral-500')}
                        />
                      </div>
                      <div className="w-full sm:w-44">
                        <Select
                          size="sm"
                          options={statusFilterOptions}
                          value={woStatus}
                          onChange={(e) => {
                            setWoStatus(e.target.value);
                            setWoPage(0);
                          }}
                          className={cn(INPUT_SURFACE, '[&_select]:bg-inherit [&_select]:text-inherit')}
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleWorkOrderExport}
                      className="text-xs font-bold uppercase tracking-wide text-primary-600 dark:text-primary-400"
                      leftIcon={<Download className="w-4 h-4" />}
                    >
                      {t('detail.profileLayout.workOrdersPanel.exportCsv')}
                    </Button>
                  </div>

                  <Table
                    columns={workOrderColumns}
                    data={workOrderSlice}
                    loading={workOrdersLoading}
                    emptyMessage={t('detail.workHistory.empty')}
                    onRowClick={(wo) => navigate(`/work-orders/${wo.id}`)}
                  />

                  {filteredWorkOrders.length > PAGE_SIZE && (
                    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                      <p className={cn('text-xs', TEXT_MUTED)}>
                        {t('detail.profileLayout.workOrdersPanel.showing', {
                          from: fromIdx,
                          to: toIdx,
                          total: filteredWorkOrders.length,
                        })}
                      </p>
                      <div className="flex gap-2">
                        <IconButton
                          icon={ChevronLeft}
                          variant="outline"
                          size="sm"
                          disabled={woPage <= 0}
                          onClick={() => setWoPage((p) => Math.max(0, p - 1))}
                          className="border-neutral-200 bg-white text-neutral-600 dark:border-[#262626] dark:bg-neutral-800 dark:text-neutral-400"
                          aria-label={tCommon('pagination.previous')}
                        />
                        {Array.from({ length: workOrderPageCount }, (_, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setWoPage(i)}
                            className={cn(
                              'w-8 h-8 rounded-lg text-[10px] font-bold flex items-center justify-center transition-colors',
                              woPage === i
                                ? 'bg-primary-600 text-white dark:bg-primary-600'
                                : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-[#262626] dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700'
                            )}
                          >
                            {i + 1}
                          </button>
                        ))}
                        <IconButton
                          icon={ChevronRight}
                          variant="outline"
                          size="sm"
                          disabled={woPage >= workOrderPageCount - 1}
                          onClick={() => setWoPage((p) => Math.min(workOrderPageCount - 1, p + 1))}
                          className="border-neutral-200 bg-white text-neutral-600 dark:border-[#262626] dark:bg-neutral-800 dark:text-neutral-400"
                          aria-label={tCommon('pagination.next')}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {bottomTab === 'assets' && <CustomerEquipmentTab />}

              {bottomTab === 'logs' && isAdmin && (
                <Table
                  columns={logColumns}
                  data={auditLogs}
                  loading={auditLoading}
                  emptyMessage={t('detail.profileLayout.logs.emptyAdmin')}
                />
              )}

              {bottomTab === 'logs' && !isAdmin && (
                <EmptyState title={t('detail.profileLayout.logs.emptyNoAccess')} />
              )}
              {bottomTab === 'parasut' && canWrite && (
                <ParasutHistoryTab customerId={id} />
              )}
            </CustomerDetailProvider>
          </div>
        </section>
      )}
      </div>

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
