import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Edit,
  Phone,
  MapPin,
  Calendar,
  Building2,
  ChevronRight,
  CreditCard,
  Users,
  StickyNote,
  Pause,
  XCircle,
  Play,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/layout';
import {
  Button,
  Badge,
  Card,
  Skeleton,
  ErrorState,
} from '../../components/ui';
import { formatDate } from '../../lib/utils';
import {
  useSubscription,
  useSubscriptionPayments,
  useCurrentProfile,
  useReactivateSubscription,
  useRevisionNotes,
} from './hooks';
import { SubscriptionStatusBadge } from './components/SubscriptionStatusBadge';
import { SubscriptionPricingCard } from './components/SubscriptionPricingCard';
import { MonthlyPaymentGrid } from './components/MonthlyPaymentGrid';
import { PauseSubscriptionModal } from './components/PauseSubscriptionModal';
import { CancelSubscriptionModal } from './components/CancelSubscriptionModal';

function DetailSkeleton() {
  return (
    <PageContainer maxWidth="lg" padding="default" className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Skeleton className="w-12 h-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="h-48 w-full" />
          <Card className="h-64 w-full" />
        </div>
        <div className="space-y-6">
          <Card className="h-96 w-full" />
        </div>
      </div>
    </PageContainer>
  );
}

export function SubscriptionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation(['subscriptions', 'common', 'customers']);
  const { t: tCommon } = useTranslation('common');

  const [showPauseModal, setShowPauseModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const { data: subscription, isLoading, error, refetch } = useSubscription(id);
  const { data: payments = [] } = useSubscriptionPayments(id);
  const { data: revisionNotes = [], isLoading: revisionNotesLoading } = useRevisionNotes(id);
  const { data: currentProfile } = useCurrentProfile();
  const reactivateMutation = useReactivateSubscription();

  const isAdmin = currentProfile?.role === 'admin';
  const pendingPaymentsCount = payments.filter((p) => p.status === 'pending').length;

  if (isLoading) return <DetailSkeleton />;

  if (error || !subscription) {
    return (
      <PageContainer maxWidth="lg" padding="default">
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

  return (
    <PageContainer maxWidth="lg" padding="default" className="space-y-6 pb-24">
      {/* Header */}
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <span>{t(`subscriptions:types.${subscription.subscription_type}`)}</span>
          </div>
        }
        description={
          <div className="flex items-center gap-2 mt-1">
            <SubscriptionStatusBadge status={subscription.status} />
            {subscription.account_no && (
              <>
                <span className="text-neutral-300 dark:text-neutral-700">|</span>
                <Badge variant="info" size="sm" className="font-mono">
                  {subscription.account_no}
                </Badge>
              </>
            )}
          </div>
        }
        breadcrumbs={[
          { label: t('subscriptions:list.title'), to: '/subscriptions' },
          { label: subscription.company_name, to: `/customers/${subscription.customer_id}` },
          { label: subscription.site_name || '' },
        ]}
        actions={
          <Button
            variant="outline"
            leftIcon={<Edit className="w-4 h-4" />}
            onClick={() => navigate(`/subscriptions/${id}/edit`)}
          >
            {tCommon('actions.edit')}
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Customer & Site Info */}
          <Card className="overflow-hidden border-primary-100 dark:border-primary-900/20">
            <div className="bg-primary-50/50 dark:bg-primary-950/10 px-6 py-4 border-b border-primary-100 dark:border-primary-900/20 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-primary-600" />
                <h3 className="font-bold text-primary-900 dark:text-primary-100 uppercase tracking-wider text-xs">
                  {t('subscriptions:detail.sections.customerSite')}
                </h3>
              </div>
              <Badge variant="info" className="font-mono">{subscription.account_no || '---'}</Badge>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-widest mb-1">
                    {t('customers:sites.fields.siteName', 'Firma')}
                  </p>
                  <Link to={`/customers/${subscription.customer_id}`} className="group flex items-center">
                    <span className="font-bold text-neutral-900 dark:text-neutral-100 group-hover:text-primary-600 transition-colors">
                      {subscription.company_name}
                    </span>
                    <ChevronRight className="w-4 h-4 ml-1 text-neutral-300 group-hover:text-primary-600 transition-colors" />
                  </Link>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-widest mb-1">
                    {t('subscriptions:list.columns.site')}
                  </p>
                  <p className="font-medium text-neutral-700 dark:text-neutral-300">
                    {subscription.site_name || '---'}
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                {subscription.site_address && (
                  <div>
                    <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-widest mb-1">
                      {t('customers:sites.fields.address', 'Adres')}
                    </p>
                    <div className="flex items-start">
                      <MapPin className="w-4 h-4 mr-2 mt-0.5 text-neutral-400 shrink-0" />
                      <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                        {subscription.site_address}
                      </p>
                    </div>
                  </div>
                )}
                {subscription.site_phone && (
                  <div>
                    <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-widest mb-1">
                      {t('customers:sites.fields.contactPhone', 'Telefon')}
                    </p>
                    <a href={`tel:${subscription.site_phone}`} className="flex items-center text-sm font-bold text-primary-600">
                      <Phone className="w-4 h-4 mr-2 shrink-0" />
                      {subscription.site_phone}
                    </a>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-widest mb-1">
                      {t('subscriptions:detail.fields.startDate')}
                    </p>
                    <div className="flex items-center text-sm text-neutral-700 dark:text-neutral-300">
                      <Calendar className="w-3.5 h-3.5 mr-1.5 text-neutral-400" />
                      {formatDate(subscription.start_date)}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-widest mb-1">
                      {t('subscriptions:detail.fields.billingDay')}
                    </p>
                    <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      {subscription.billing_day}. gün
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Payment Grid */}
          <MonthlyPaymentGrid
            payments={payments}
            subscriptionStatus={subscription.status}
          />
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          {/* Pricing Card */}
          <SubscriptionPricingCard subscription={subscription} isAdmin={isAdmin} />

          {/* Payment Method & subscription details */}
          <Card className="p-5">
            <div className="flex items-center space-x-2 mb-4">
              <CreditCard className="w-4 h-4 text-primary-600" />
              <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-xs">
                {t('subscriptions:detail.sections.paymentMethod')}
              </h3>
            </div>
            <div className="space-y-3 text-sm">
              {subscription.service_type && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-500">{t('subscriptions:detail.fields.serviceType')}</span>
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">
                    {t(`subscriptions:serviceTypes.${subscription.service_type}`)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-500">{t('subscriptions:detail.fields.billingFrequency')}</span>
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {subscription.billing_frequency === 'yearly'
                    ? t('subscriptions:form.fields.yearly')
                    : t('subscriptions:form.fields.monthly')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-500">{t('subscriptions:detail.fields.officialInvoice')}</span>
                <Badge variant={subscription.official_invoice !== false ? 'info' : 'outline'} size="sm">
                  {subscription.official_invoice !== false
                    ? t('subscriptions:detail.officialInvoiceResmi')
                    : t('subscriptions:detail.officialInvoiceGayri')}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-500">{t('subscriptions:form.fields.subscriptionType')}</span>
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {t(`subscriptions:types.${subscription.subscription_type}`)}
                </span>
              </div>
              {subscription.subscription_type === 'recurring_card' && (subscription.card_bank_name || subscription.card_last4 || subscription.pm_bank_name || subscription.pm_card_last4) && (
                <div className="pt-1">
                  <p className="font-bold text-neutral-900 dark:text-neutral-100">
                    {(subscription.card_bank_name || subscription.pm_bank_name) && (
                      <span>{subscription.card_bank_name || subscription.pm_bank_name}</span>
                    )}
                    {(subscription.card_last4 || subscription.pm_card_last4) && (
                      <span> *{subscription.card_last4 || subscription.pm_card_last4}</span>
                    )}
                  </p>
                  {subscription.pm_card_holder && (
                    <p className="text-neutral-500 text-xs">{subscription.pm_card_holder}</p>
                  )}
                  {subscription.pm_iban && (
                    <p className="text-xs font-mono text-neutral-500">{subscription.pm_iban}</p>
                  )}
                </div>
              )}
              {subscription.subscription_type === 'manual_cash' && subscription.cash_collector_name && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-neutral-500">{t('subscriptions:detail.fields.cashCollector')}</span>
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">
                    {subscription.cash_collector_name}
                  </span>
                </div>
              )}
            </div>
          </Card>

          {/* Status History */}
          <Card className="p-5">
            <div className="flex items-center space-x-2 mb-4">
              <Clock className="w-4 h-4 text-primary-600" />
              <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-xs">
                {t('subscriptions:detail.sections.statusHistory')}
              </h3>
            </div>
            <div className="space-y-3 text-sm">
              {/* Start Date */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-success-600" />
                  <span className="text-xs text-neutral-500">{t('subscriptions:detail.fields.startDate')}</span>
                </div>
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {formatDate(subscription.start_date)}
                </span>
              </div>

              {/* Paused Date */}
              {subscription.paused_at && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Pause className="w-3.5 h-3.5 text-warning-600" />
                    <span className="text-xs text-neutral-500">{t('subscriptions:detail.fields.pausedDate')}</span>
                  </div>
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">
                    {formatDate(subscription.paused_at)}
                  </span>
                </div>
              )}

              {/* Cancelled Date */}
              {subscription.cancelled_at && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-3.5 h-3.5 text-error-600" />
                    <span className="text-xs text-neutral-500">{t('subscriptions:detail.fields.cancelledDate')}</span>
                  </div>
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">
                    {formatDate(subscription.cancelled_at)}
                  </span>
                </div>
              )}

              {/* Reactivated Date */}
              {subscription.reactivated_at && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-success-600" />
                    <span className="text-xs text-neutral-500">{t('subscriptions:detail.fields.reactivatedDate')}</span>
                  </div>
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">
                    {formatDate(subscription.reactivated_at)}
                  </span>
                </div>
              )}
            </div>
          </Card>

          {/* Assignment */}
          <Card className="p-5">
            <div className="flex items-center space-x-2 mb-4">
              <Users className="w-4 h-4 text-primary-600" />
              <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-xs">
                {t('subscriptions:detail.sections.assignment')}
              </h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-500">{t('subscriptions:detail.fields.managedBy')}</span>
                <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  {subscription.managed_by_name || '---'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-500">{t('subscriptions:detail.fields.soldBy')}</span>
                <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  {subscription.sold_by_name || '---'}
                </span>
              </div>
            </div>
          </Card>

          {/* Notes */}
          {(subscription.setup_notes || subscription.notes) && (
            <Card className="p-5">
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

          {/* Fiyat revizyon notları */}
          <Card className="p-5">
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
            ) : revisionNotes.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {t('subscriptions:priceRevision.notes.empty')}
              </p>
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

          {/* Action Buttons */}
          {subscription.status !== 'cancelled' && (
            <div className="space-y-3">
              {subscription.status === 'active' && (
                <>
                  <Button
                    variant="warning"
                    className="w-full"
                    leftIcon={<Pause className="w-4 h-4" />}
                    onClick={() => setShowPauseModal(true)}
                  >
                    {t('subscriptions:actions.pause')}
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full"
                    leftIcon={<XCircle className="w-4 h-4" />}
                    onClick={() => setShowCancelModal(true)}
                  >
                    {t('subscriptions:actions.cancel')}
                  </Button>
                </>
              )}
              {subscription.status === 'paused' && (
                <>
                  <Button
                    className="w-full"
                    leftIcon={<Play className="w-4 h-4" />}
                    onClick={handleReactivate}
                    loading={reactivateMutation.isPending}
                  >
                    {t('subscriptions:actions.reactivate')}
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full"
                    leftIcon={<XCircle className="w-4 h-4" />}
                    onClick={() => setShowCancelModal(true)}
                  >
                    {t('subscriptions:actions.cancel')}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Floating Action Bar for Mobile */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-[#171717]/80 backdrop-blur-md border-t border-neutral-200 dark:border-[#262626] z-50 flex gap-3 lg:hidden">
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
