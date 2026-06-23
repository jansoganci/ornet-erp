import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Edit,
  Phone,
  MapPin,
  Building2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CreditCard,
  StickyNote,
  Pause,
  XCircle,
  Play,
  ArrowLeft,
  MoreVertical,
} from 'lucide-react';
import { PageContainer } from '../../components/layout';
import {
  Button,
  Badge,
  Card,
  Skeleton,
  ErrorState,
} from '../../components/ui';
import { cn, formatDate, formatCurrency } from '../../lib/utils';
import {
  useSubscription,
  useSubscriptionsBySite,
  usePendingPaymentsCount,
  useCurrentProfile,
  useReactivateSubscription,
  useRevisionNotes,
} from './hooks';
import { SubscriptionStatusBadge } from './components/SubscriptionStatusBadge';
import { SubscriptionPricingCard } from './components/SubscriptionPricingCard';
import { SubscriptionDetailInfoStrip } from './components/SubscriptionDetailInfoStrip';
import { SubscriptionDetailSidebar } from './components/SubscriptionDetailSidebar';
import { MonthlyPaymentGrid } from './components/MonthlyPaymentGrid';
import { PauseSubscriptionModal } from './components/PauseSubscriptionModal';
import { CancelSubscriptionModal } from './components/CancelSubscriptionModal';
import { SubscriptionTabBar } from './components/SubscriptionTabBar';
import { SubscriptionWorkOrdersTab } from './tabs/SubscriptionWorkOrdersTab';
import { SubscriptionAssetsTab } from './tabs/SubscriptionAssetsTab';
import { useWorkOrdersBySite } from '../workOrders/hooks';
import { useAssetsBySite } from '../siteAssets/hooks';
import { ParasutInvoicePanel } from '../finance/components/ParasutInvoicePanel';

const SURFACE_CARD =
  'rounded-xl border border-neutral-200/80 bg-white shadow-sm dark:border-[#262626] dark:bg-[#1a1a1a]/90';

function subscriptionInvoiceTotal(sub) {
  const basePrice = Number(sub.base_price) || 0;
  const smsFee = Number(sub.sms_fee) || 0;
  const lineFee = Number(sub.line_fee) || 0;
  const staticIpFee = Number(sub.static_ip_fee) || 0;
  const simAmount = Number(sub.sim_amount) || 0;
  const vatRate = Number(sub.vat_rate) || 0;
  const subtotal = basePrice + smsFee + lineFee + staticIpFee + simAmount;
  const vatAmount =
    sub.official_invoice !== false ? Math.round((subtotal * vatRate) / 100 * 100) / 100 : 0;
  return subtotal + vatAmount;
}

function DetailSkeleton() {
  return (
    <PageContainer maxWidth="full" padding="default" className="space-y-8">
      <div className="space-y-1">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-10 w-full max-w-xl" />
      <Skeleton className="h-5 w-full max-w-md" />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className={cn(SURFACE_CARD, 'h-56 w-full')} />
          <Card className={cn(SURFACE_CARD, 'h-72 w-full')} />
        </div>
        <div className="space-y-6">
          <Card className={cn(SURFACE_CARD, 'h-80 w-full')} />
        </div>
      </div>
    </PageContainer>
  );
}

export function SubscriptionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation(['subscriptions', 'common', 'customers', 'notifications']);
  const { t: tCommon } = useTranslation('common');

  const [searchParams, setSearchParams] = useSearchParams();
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
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

  const tabParam = searchParams.get('tab');
  const activeTab = tabParam === 'assets' || tabParam === 'workOrders' ? tabParam : 'workOrders';
  const handleTabChange = (tab) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', tab);
        return next;
      },
      { replace: true },
    );
  };

  const { data: subscription, isLoading, error, refetch } = useSubscription(id);
  const { data: revisionNotes = [], isLoading: revisionNotesLoading } = useRevisionNotes(id);
  const { data: siteSubscriptions = [] } = useSubscriptionsBySite(subscription?.site_id);
  const { data: currentProfile } = useCurrentProfile();
  const reactivateMutation = useReactivateSubscription();
  const { data: siteWorkOrders = [] } = useWorkOrdersBySite(subscription?.site_id);
  const { data: siteAssets = [] } = useAssetsBySite(subscription?.site_id);

  const isAdmin = currentProfile?.role === 'admin';
  const { data: pendingPaymentsCount = 0 } = usePendingPaymentsCount(id);
  const otherServicesAtSite = (siteSubscriptions || []).filter((s) => s.id !== id);

  if (isLoading) return <DetailSkeleton />;

  if (error || !subscription) {
    return (
      <PageContainer maxWidth="full" padding="default">
        <ErrorState
          message={error?.message || t('common:errors.loadFailed')}
          onRetry={() => refetch()}
        />
        <div className="mt-6 flex justify-center">
          <Button onClick={() => navigate('/subscriptions')}>{tCommon('actions.back')}</Button>
        </div>
      </PageContainer>
    );
  }

  const handleReactivate = () => {
    reactivateMutation.mutate(id);
  };

  const breadcrumbs = [
    { label: t('subscriptions:list.title'), to: '/subscriptions' },
    { label: subscription.company_name, to: `/customers/${subscription.customer_id}` },
    { label: subscription.site_name || t('subscriptions:detail.title') },
  ];

  return (
    <PageContainer maxWidth="full" padding="default" className="space-y-4 pb-24">
      {/* Mobile Sticky Header — md:hidden */}
      <div className="md:hidden sticky top-0 z-30 -mx-4 -mt-8 px-4 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-neutral-200/60 dark:border-[#262626]">
        <div className="flex items-center justify-between h-14">
          <button
            type="button"
            onClick={() => navigate('/subscriptions')}
            className="flex items-center justify-center w-10 h-10 -ml-2 rounded-xl text-neutral-600 dark:text-neutral-400 active:scale-95 transition-transform"
            aria-label={tCommon('actions.back')}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0 px-3">
            <p className="text-sm font-bold text-neutral-900 dark:text-neutral-50 truncate">
              {subscription.company_name}
            </p>
            <div className="flex items-center gap-1.5">
              <span className={cn(
                'w-1.5 h-1.5 rounded-full animate-pulse',
                subscription.status === 'active' && 'bg-success-500',
                subscription.status === 'paused' && 'bg-amber-400',
                subscription.status === 'cancelled' && 'bg-error-500',
              )} />
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                {t(`subscriptions:statuses.${subscription.status}`)}
              </span>
            </div>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMobileMenu((v) => !v)}
              className="flex items-center justify-center w-10 h-10 -mr-2 rounded-xl text-neutral-600 dark:text-neutral-400 active:scale-95 transition-transform"
              aria-label={t('subscriptions:detail.moreOptions')}
            >
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile More Options Dropdown */}
      {showMobileMenu && (
        <div className="md:hidden fixed inset-0 z-40" onClick={() => setShowMobileMenu(false)}>
          <div className="absolute inset-0 bg-black/20 dark:bg-black/40" />
          <div
            className="absolute top-14 right-4 w-56 bg-white dark:bg-[#1f1f1f] rounded-xl border border-neutral-200 dark:border-[#262626] shadow-xl py-1 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => { setShowMobileMenu(false); navigate(`/customers/${subscription.customer_id}`); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-neutral-700 dark:text-neutral-300 active:bg-neutral-100 dark:active:bg-neutral-800 transition-colors"
            >
              <Building2 className="w-4 h-4 text-neutral-400" />
              {t('subscriptions:detail.viewCustomer')}
            </button>
            {subscription.status === 'active' && (
              <>
                <button
                  type="button"
                  onClick={() => { setShowMobileMenu(false); setShowPauseModal(true); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-amber-600 dark:text-amber-400 active:bg-neutral-100 dark:active:bg-neutral-800 transition-colors"
                >
                  <Pause className="w-4 h-4" />
                  {t('subscriptions:actions.pause')}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowMobileMenu(false); setShowCancelModal(true); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-error-600 dark:text-error-400 active:bg-neutral-100 dark:active:bg-neutral-800 transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                  {t('subscriptions:actions.cancel')}
                </button>
              </>
            )}
            {subscription.status === 'paused' && (
              <>
                <button
                  type="button"
                  onClick={() => { setShowMobileMenu(false); handleReactivate(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-primary-600 dark:text-primary-400 active:bg-neutral-100 dark:active:bg-neutral-800 transition-colors"
                >
                  <Play className="w-4 h-4" />
                  {t('subscriptions:actions.reactivate')}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowMobileMenu(false); setShowCancelModal(true); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-error-600 dark:text-error-400 active:bg-neutral-100 dark:active:bg-neutral-800 transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                  {t('subscriptions:actions.cancel')}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Desktop compact header */}
      <header
        className={cn(
          'hidden min-w-0 space-y-3 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm dark:border-[#262626] dark:bg-[#171717] md:block sm:p-4',
        )}
      >
        <nav
          className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400"
          aria-label="Breadcrumb"
        >
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return (
              <div key={`${crumb.label}-${index}`} className="flex items-center gap-2">
                {index > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70" />}
                {crumb.to && !isLast ? (
                  <Link
                    to={crumb.to}
                    className="transition-colors hover:text-neutral-800 dark:hover:text-neutral-200"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    className={cn(
                      isLast ? 'font-medium text-neutral-800 dark:text-neutral-100' : '',
                    )}
                  >
                    {crumb.label}
                  </span>
                )}
              </div>
            );
          })}
        </nav>

        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="min-w-0 text-xl font-bold tracking-tight text-neutral-900 break-words sm:text-2xl dark:text-neutral-50">
                {subscription.company_name || t('subscriptions:detail.title')}
              </h1>
              <SubscriptionStatusBadge status={subscription.status} />
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-600 dark:text-neutral-300">
              {subscription.service_type && (
                <span className="font-medium text-neutral-700 dark:text-neutral-200">
                  {t(`subscriptions:serviceTypes.${subscription.service_type}`)}
                </span>
              )}
              {subscription.site_name && (
                <>
                  <span className="text-neutral-300 dark:text-neutral-600" aria-hidden>
                    ·
                  </span>
                  <span>{subscription.site_name}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 lg:shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              leftIcon={<Edit className="h-4 w-4" />}
              onClick={() => navigate(`/subscriptions/${id}/edit`)}
            >
              {tCommon('actions.edit')}
            </Button>
            <Button
              size="sm"
              className="rounded-lg"
              onClick={() => navigate(`/customers/${subscription.customer_id}`)}
            >
              {t('subscriptions:detail.viewCustomer')}
            </Button>
            {(subscription.status === 'active' || subscription.status === 'paused') && (
              <div className="relative" ref={headerActionsRef}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  rightIcon={<ChevronDown className="h-4 w-4" />}
                  onClick={() => setHeaderActionsOpen((o) => !o)}
                  className="rounded-lg dark:border-[#262626] dark:bg-neutral-800 dark:text-neutral-100"
                >
                  {t('subscriptions:detail.moreActions')}
                </Button>
                {headerActionsOpen && (
                  <div
                    className="absolute right-0 z-50 mt-1 min-w-[11rem] rounded-xl border border-neutral-200 bg-white py-1 shadow-lg dark:border-[#262626] dark:bg-[#171717]"
                    role="menu"
                  >
                    {subscription.status === 'active' && (
                      <button
                        type="button"
                        role="menuitem"
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-amber-700 hover:bg-neutral-100 dark:text-amber-400 dark:hover:bg-neutral-800"
                        onClick={() => {
                          setHeaderActionsOpen(false);
                          setShowPauseModal(true);
                        }}
                      >
                        <Pause className="h-4 w-4 shrink-0" />
                        {t('subscriptions:actions.pause')}
                      </button>
                    )}
                    {subscription.status === 'paused' && (
                      <button
                        type="button"
                        role="menuitem"
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-primary-600 hover:bg-neutral-100 dark:text-primary-400 dark:hover:bg-neutral-800"
                        onClick={() => {
                          setHeaderActionsOpen(false);
                          handleReactivate();
                        }}
                      >
                        <Play className="h-4 w-4 shrink-0" />
                        {t('subscriptions:actions.reactivate')}
                      </button>
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-error-600 hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-950/30"
                      onClick={() => {
                        setHeaderActionsOpen(false);
                        setShowCancelModal(true);
                      }}
                    >
                      <XCircle className="h-4 w-4 shrink-0" />
                      {t('subscriptions:actions.cancel')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <SubscriptionDetailInfoStrip subscription={subscription} />

      {/* Mobile Quick Info Card — md:hidden */}
      <div className="md:hidden space-y-4">
        <div className={cn(SURFACE_CARD, 'p-5 space-y-4')}>
          <p className="text-[10px] uppercase tracking-widest text-neutral-500 dark:text-neutral-400 font-bold">
            {t('subscriptions:detail.sections.quickInfo')}
          </p>
          <div>
            <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-50 leading-tight">
              {subscription.company_name}
            </h2>
            {subscription.service_type && (
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                {t(`subscriptions:serviceTypes.${subscription.service_type}`)}
              </p>
            )}
          </div>
          {subscription.site_address && (
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-neutral-400 dark:text-neutral-500" />
              <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed line-clamp-2">
                {subscription.site_address}
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <div>
              <p className="text-[10px] uppercase font-bold tracking-widest text-neutral-400">
                {t('subscriptions:list.columns.monthly')}
              </p>
              <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {formatCurrency(subscriptionInvoiceTotal(subscription), 'TRY')}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold tracking-widest text-neutral-400">
                {t('subscriptions:form.fields.alarmCenter')}
              </p>
              <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {subscription.alarm_center || '—'}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              {subscription.sim_phone_number && (
                <code className="text-xs text-primary-600 dark:text-primary-400 font-mono font-bold tracking-widest">
                  {subscription.sim_phone_number}
                </code>
              )}
            </div>
            {(subscription.sim_phone_number || subscription.site_phone) && (
              <a
                href={`tel:${subscription.sim_phone_number || subscription.site_phone}`}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-white text-xs font-bold active:scale-95 transition-transform shadow-lg shadow-primary-600/20"
              >
                <Phone className="w-3.5 h-3.5" />
                {t('subscriptions:detail.callButton')}
              </a>
            )}
          </div>
        </div>

        <div className="h-0.5 rounded-full bg-gradient-to-r from-primary-500 to-primary-400 opacity-30" />
      </div>

      {/* Mobile Extra Info Grid — md:hidden */}
      <div className="md:hidden grid grid-cols-2 gap-3">
        {[
          { label: t('subscriptions:detail.fields.startDate'), value: formatDate(subscription.start_date) },
          { label: t('subscriptions:detail.fields.billingDay'), value: subscription.billing_day ? `${subscription.billing_day}. gün` : '—' },
          { label: t('subscriptions:detail.fields.billingFrequency'), value: subscription.billing_frequency ? t(`subscriptions:form.fields.${subscription.billing_frequency}`) : '—' },
          { label: t('subscriptions:detail.fields.officialInvoice'), value: subscription.official_invoice !== false ? t('subscriptions:detail.officialInvoiceResmi') : t('subscriptions:detail.officialInvoiceGayri') },
          { label: t('subscriptions:detail.fields.managedBy'), value: subscription.managed_by_name || '—' },
          { label: t('subscriptions:detail.fields.soldBy'), value: subscription.sold_by_name || '—' },
        ].map((item) => (
          <div key={item.label} className={cn(SURFACE_CARD, 'p-3')}>
            <p className="text-[10px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-widest mb-1">
              {item.label}
            </p>
            <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {/* Mobile Collapsible Notes — md:hidden */}
      {(subscription.setup_notes || subscription.notes || revisionNotes.length > 0) && (
        <div className="md:hidden">
          <div className={cn(SURFACE_CARD, 'overflow-hidden')}>
            <button
              type="button"
              onClick={() => setNotesExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3.5 active:bg-neutral-50 dark:active:bg-neutral-800/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                  {t('subscriptions:detail.sections.notesAndRevision')}
                </span>
              </div>
              {notesExpanded ? (
                <ChevronUp className="w-4 h-4 text-neutral-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-neutral-400" />
              )}
            </button>
            {notesExpanded && (
              <div className="px-4 pb-4 space-y-4 border-t border-neutral-100 dark:border-neutral-800 pt-3">
                {subscription.setup_notes && (
                  <div>
                    <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-widest mb-1">
                      {t('subscriptions:detail.fields.setupNotes')}
                    </p>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
                      {subscription.setup_notes}
                    </p>
                  </div>
                )}
                {subscription.notes && (
                  <div>
                    <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-widest mb-1">
                      {t('common:fields.notes', 'Not')}
                    </p>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
                      {subscription.notes}
                    </p>
                  </div>
                )}
                {revisionNotes.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-widest mb-1">
                      {t('subscriptions:priceRevision.notes.title')}
                    </p>
                    <ul className="space-y-2">
                      {revisionNotes.map((n) => (
                        <li key={n.id} className="text-sm border-l-2 border-neutral-200 dark:border-[#262626] pl-3 py-1">
                          <span className="font-medium text-neutral-700 dark:text-neutral-300">
                            {formatDate(n.revision_date)}
                          </span>
                          <p className="text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap mt-0.5">
                            {n.note}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ödeme takvimi + sağ bilgi kolonu */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.75fr)_minmax(320px,0.95fr)] lg:items-start">
        <div className="min-w-0 space-y-4">
          <MonthlyPaymentGrid
            subscriptionId={id}
            subscriptionStatus={subscription.status}
            className={SURFACE_CARD}
          />
          <ParasutInvoicePanel subscriptionId={id} />

          <div className="space-y-6">
            <SubscriptionTabBar
              activeTab={activeTab}
              onTabChange={handleTabChange}
              counts={{
                workOrders: siteWorkOrders.length,
                assets: siteAssets.length,
              }}
            />
            {activeTab === 'workOrders' && (
              <SubscriptionWorkOrdersTab siteId={subscription.site_id} />
            )}
            {activeTab === 'assets' && (
              <SubscriptionAssetsTab siteId={subscription.site_id} />
            )}
          </div>
        </div>
        <div className="hidden md:contents">
          <SubscriptionDetailSidebar
            subscription={subscription}
            isAdmin={isAdmin}
            simCardId={subscription.sim_card_id}
          />
        </div>
      </div>

      {/* Row 3 — Diğer hizmetler, notlar, revizyon */}
      <div className="space-y-8">
          {/* Other services at this site */}
          {otherServicesAtSite.length > 0 && (
            <Card className={cn(SURFACE_CARD, 'p-5')}>
              <div className="flex items-center space-x-2 mb-4">
                <CreditCard className="w-4 h-4 text-primary-600" />
                <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-xs">
                  {t('subscriptions:multiService.otherServices')}
                </h3>
              </div>
              <div className="space-y-2">
                {otherServicesAtSite.map((sub) => (
                  <Link
                    key={sub.id}
                    to={`/subscriptions/${sub.id}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-100 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800/50 transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" size="sm">
                        {sub.service_type ? t(`subscriptions:serviceTypes.${sub.service_type}`) : '—'}
                      </Badge>
                      <SubscriptionStatusBadge status={sub.status} />
                      <span className="text-sm text-neutral-600 dark:text-neutral-400">
                        {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(Number(sub.base_price) || 0)}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-neutral-600" />
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {/* Notes — hidden on mobile (collapsible version above) */}
          {((subscription.setup_notes || subscription.notes) ||
            revisionNotesLoading ||
            revisionNotes.length > 0) && (
          <div className="hidden md:grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
          {(subscription.setup_notes || subscription.notes) && (
            <Card className={cn(SURFACE_CARD, 'p-5')}>
              <div className="flex items-center space-x-2 mb-4">
                <StickyNote className="w-4 h-4 text-primary-600" />
                <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-xs">
                  {t('subscriptions:detail.sections.notes')}
                </h3>
              </div>
              <div className="space-y-4">
                {subscription.setup_notes && (
                  <div>
                    <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-widest mb-1">
                      {t('subscriptions:detail.fields.setupNotes')}
                    </p>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
                      {subscription.setup_notes}
                    </p>
                  </div>
                )}
                {subscription.notes && (
                  <div>
                    <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-widest mb-1">
                      {t('common:fields.notes', 'Not')}
                    </p>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
                      {subscription.notes}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {(revisionNotesLoading || revisionNotes.length > 0) && (
          <Card
            className={cn(
              SURFACE_CARD,
              'p-5',
              !(subscription.setup_notes || subscription.notes) && 'lg:col-span-2',
            )}
          >
            <div className="flex items-center space-x-2 mb-4">
              <StickyNote className="w-4 h-4 text-primary-600" />
              <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-xs">
                {t('subscriptions:priceRevision.notes.title')}
              </h3>
            </div>
            {revisionNotesLoading ? (
              <div className="space-y-3">
                <div className="h-12 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                <div className="h-12 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
              </div>
            ) : (
              <ul className="space-y-3">
                {revisionNotes.map((n) => (
                  <li
                    key={n.id}
                    className="text-sm border-l-2 border-neutral-200 dark:border-[#262626] pl-3 py-1"
                  >
                    <span className="font-medium text-neutral-700 dark:text-neutral-300">
                      {formatDate(n.revision_date)}
                    </span>
                    <p className="text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap mt-0.5">
                      {n.note}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          )}
          </div>
          )}

          {/* Pause/Cancel reason */}
          {subscription.status === 'paused' && subscription.pause_reason && (
            <Card className="p-4 bg-warning-50/30 dark:bg-warning-950/10 border-warning-100 dark:border-warning-900/20">
              <p className="text-[10px] uppercase font-bold text-warning-600 tracking-widest mb-1">
                {t('subscriptions:detail.fields.pauseReason')}
              </p>
              <p className="text-sm text-warning-700 dark:text-warning-400 italic">
                {subscription.pause_reason}
              </p>
            </Card>
          )}

          {subscription.status === 'cancelled' && subscription.cancel_reason && (
            <Card className="p-4 bg-error-50/30 dark:bg-error-950/10 border-error-100 dark:border-error-900/20">
              <p className="text-[10px] uppercase font-bold text-error-600 tracking-widest mb-1">
                {t('subscriptions:detail.fields.cancelReason')}
              </p>
              <p className="text-sm text-error-700 dark:text-error-400 italic">
                {subscription.cancel_reason}
              </p>
            </Card>
          )}
      </div>

      {/* Floating Action Bar for Mobile */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-white/80 dark:bg-[#171717]/80 backdrop-blur-md border-t border-neutral-200 dark:border-[#262626] z-50 flex gap-3 md:hidden">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => navigate(`/subscriptions/${id}/edit`)}
        >
          {tCommon('actions.edit')}
        </Button>
        {subscription.status === 'active' && (
          <Button
            variant="warning"
            className="flex-1"
            onClick={() => setShowPauseModal(true)}
          >
            {t('subscriptions:actions.pause')}
          </Button>
        )}
        {subscription.status === 'paused' && (
          <Button
            className="flex-1"
            onClick={handleReactivate}
            loading={reactivateMutation.isPending}
          >
            {t('subscriptions:actions.reactivate')}
          </Button>
        )}
      </div>

      {/* Modals */}
      <PauseSubscriptionModal
        open={showPauseModal}
        onClose={() => setShowPauseModal(false)}
        subscriptionId={id}
      />
      <CancelSubscriptionModal
        open={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        subscriptionId={id}
        pendingPaymentsCount={pendingPaymentsCount}
      />
    </PageContainer>
  );
}
