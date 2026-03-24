import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Banknote,
  Zap,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Search,
  ArrowLeft,
  Calendar,
} from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/layout';
import { Card, Badge, Spinner, EmptyState, ErrorState, Button, IconButton } from '../../components/ui';
import { useCollectionPayments, useCollectionStats } from './collectionHooks';
import { PaymentRecordModal } from '../subscriptions/components/PaymentRecordModal';
import { formatCurrency, cn } from '../../lib/utils';

function getMonthLabel(paymentMonth, t) {
  if (!paymentMonth) return '';
  const d = new Date(paymentMonth);
  return `${t('common:monthsShort.' + d.getMonth())} ${d.getFullYear()}`;
}

/** Full month name + year for mobile period display (e.g. Ekim 2023). */
function getMonthLabelFull(paymentMonth, t) {
  if (!paymentMonth) return '';
  const d = new Date(paymentMonth);
  return `${t('common:monthsFull.' + d.getMonth())} ${d.getFullYear()}`;
}

function formatSelectedPeriodLabel(year, month, t) {
  if (year == null || month == null) return '';
  return `${t('common:monthsFull.' + (month - 1))} ${year}`;
}

function isOverdue(paymentMonth) {
  const now = new Date();
  const current = new Date(now.getFullYear(), now.getMonth(), 1);
  return new Date(paymentMonth) < current;
}

/**
 * Whole days from first day of the month after payment_month to local today start.
 * Display-only; aligns with calendar-month overdue boundary used by isOverdue.
 */
function getDaysOverdueCount(paymentMonth) {
  if (!paymentMonth || !isOverdue(paymentMonth)) return null;
  const pm = new Date(paymentMonth);
  const nextMonthStart = new Date(pm.getFullYear(), pm.getMonth() + 1, 1);
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.floor((todayStart - nextMonthStart) / 86400000);
  return days >= 1 ? days : null;
}

export function CollectionDeskPage() {
  const { t } = useTranslation(['collection', 'common']);
  const navigate = useNavigate();
  const now = new Date();

  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [periodPickerOpen, setPeriodPickerOpen] = useState(false);

  const filters = useMemo(() => {
    const f = {};
    if (selectedYear && selectedMonth) {
      f.year = selectedYear;
      f.month = selectedMonth;
    }
    if (search.trim()) {
      f.search = search.trim();
    }
    return f;
  }, [selectedYear, selectedMonth, search]);

  const { data: payments, isLoading, error } = useCollectionPayments(filters);
  const { data: stats } = useCollectionStats(filters);

  const displayedPayments = useMemo(() => {
    if (!payments?.length) return [];
    if (!overdueOnly) return payments;
    return payments.filter((p) => isOverdue(p.payment_month));
  }, [payments, overdueOnly]);

  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear();
    return [y - 1, y, y + 1];
  }, []);

  const monthOptions = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      value: i + 1,
      label: t('common:monthsFull.' + i),
    }));
  }, [t]);

  const handlePeriodChange = (year, month) => {
    if (year === 'all') {
      setSelectedYear(null);
      setSelectedMonth(null);
    } else {
      setSelectedYear(Number(year));
      setSelectedMonth(Number(month));
    }
  };

  const cy = now.getFullYear();
  const cm = now.getMonth() + 1;
  let lastMonthY = cy;
  let lastMonthM = cm - 1;
  if (lastMonthM < 1) {
    lastMonthM = 12;
    lastMonthY -= 1;
  }

  let activeChip = 'custom';
  if (overdueOnly) activeChip = 'overdue';
  else if (selectedYear == null || selectedMonth == null) activeChip = 'all';
  else if (selectedYear === cy && selectedMonth === cm) activeChip = 'thisMonth';
  else if (selectedYear === lastMonthY && selectedMonth === lastMonthM) activeChip = 'lastMonth';

  const selectChipAll = () => {
    setOverdueOnly(false);
    handlePeriodChange('all');
  };
  const selectChipOverdue = () => {
    setOverdueOnly(true);
    handlePeriodChange('all');
  };
  const selectChipThisMonth = () => {
    setOverdueOnly(false);
    handlePeriodChange(cy, cm);
  };
  const selectChipLastMonth = () => {
    setOverdueOnly(false);
    handlePeriodChange(lastMonthY, lastMonthM);
  };

  const chipClass = (id) =>
    cn(
      'whitespace-nowrap shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors min-h-[44px] inline-flex items-center active:scale-[0.98]',
      activeChip === id
        ? 'bg-primary-600 text-white shadow-md dark:bg-primary-600 dark:text-white'
        : 'border border-neutral-200 bg-white text-neutral-800 dark:border-[#262626] dark:bg-[#1f1f1f] dark:text-neutral-100',
    );

  const periodChipLabel =
    selectedYear != null && selectedMonth != null
      ? formatSelectedPeriodLabel(selectedYear, selectedMonth, t)
      : t('collection:filters.allPeriods');

  const mobileErrorHeader = (
    <div
      className={cn(
        'md:hidden sticky top-16 z-30 -mx-4 px-4 sm:-mx-6 sm:px-6 py-3 mb-4',
        'border-b border-neutral-200 dark:border-[#262626] bg-white/95 dark:bg-[#171717]/95 backdrop-blur-md',
      )}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/finance')}
          className="p-2 -ml-2 rounded-full text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors"
          aria-label={t('common:actions.back')}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold text-primary-600 dark:text-primary-400 tracking-tight">
          {t('collection:mobileTitle')}
        </h1>
      </div>
    </div>
  );

  const mobileStickyHeader = (
    <div
      className={cn(
        'md:hidden sticky top-16 z-30 -mx-4 sm:-mx-6',
        'border-b border-neutral-200 dark:border-[#262626] bg-white/95 dark:bg-[#171717]/95 backdrop-blur-md',
      )}
    >
      <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/finance')}
            className="p-2 -ml-2 rounded-full shrink-0 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors"
            aria-label={t('common:actions.back')}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-primary-600 dark:text-primary-400 tracking-tight truncate">
            {t('collection:mobileTitle')}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setPeriodPickerOpen((o) => !o)}
          className={cn(
            'flex items-center gap-2 shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium',
            'border border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-[#1f1f1f]',
            'text-neutral-800 dark:text-neutral-100 hover:bg-primary-50 dark:hover:bg-primary-950/30 transition-colors',
          )}
        >
          <span className="max-w-[120px] truncate">{periodChipLabel}</span>
          <Calendar className="w-4 h-4 text-primary-600 dark:text-primary-400 shrink-0" />
        </button>
      </div>
      {periodPickerOpen && (
        <div className="px-4 sm:px-6 pb-3 pt-0 flex flex-wrap gap-2">
          <CollectionPeriodSelects
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            yearOptions={yearOptions}
            monthOptions={monthOptions}
            now={now}
            onPeriodChange={handlePeriodChange}
            t={t}
          />
        </div>
      )}
    </div>
  );

  if (error) {
    return (
      <PageContainer maxWidth="full">
        {mobileErrorHeader}
        <div className="hidden md:block">
          <PageHeader
            title={t('collection:title')}
            breadcrumbs={[
              { label: t('common:nav.subscriptions'), to: '/subscriptions' },
              { label: t('collection:title') },
            ]}
          />
        </div>
        <ErrorState message={t('common:errors.loadFailed')} />
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="full">
      {mobileStickyHeader}

      <div className="hidden md:block">
        <PageHeader
          title={t('collection:title')}
          breadcrumbs={[
            { label: t('common:nav.subscriptions'), to: '/subscriptions' },
            { label: t('collection:title') },
          ]}
        />
      </div>

      <div className="mt-4 md:mt-6 space-y-4 md:space-y-6">
        {stats && (
          <>
            <div className="md:hidden grid grid-cols-2 gap-3">
              <div
                className={cn(
                  'rounded-xl p-4 flex flex-col justify-between min-h-[6rem] shadow-sm',
                  'border border-neutral-200 dark:border-[#262626] dark:bg-[#171717]',
                  'border-l-2 border-l-primary-500 dark:border-l-primary-400',
                )}
              >
                <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  {t('collection:summaryBar.status')}
                </span>
                <div className="flex items-end gap-1 flex-wrap">
                  <span className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 leading-none">
                    {stats.pendingCount}
                  </span>
                  <span className="text-xs font-medium text-primary-600 dark:text-primary-400 mb-0.5">
                    {t('collection:summaryBar.pendingSub')}
                  </span>
                </div>
              </div>
              <div
                className={cn(
                  'rounded-xl p-4 flex flex-col justify-between min-h-[6rem] shadow-sm',
                  'border border-neutral-200 dark:border-[#262626] dark:bg-[#171717]',
                )}
              >
                <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  {t('collection:summaryBar.totalVolume')}
                </span>
                <div className="text-xl font-bold tabular-nums text-neutral-900 dark:text-neutral-50 leading-tight">
                  {/* Gross volume (KDV dahil where applicable) — matches table total column intent */}
                  {formatCurrency(stats.pendingGrossTotal)}
                </div>
              </div>
            </div>

            <div className="hidden md:grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label={t('collection:stats.pending')}
                value={stats.pendingCount}
                sub={formatCurrency(stats.pendingNetTotal)}
                icon={<Banknote className="w-5 h-5" />}
                color="warning"
              />
              <StatCard
                label={t('collection:stats.overdue')}
                value={stats.overdueCount}
                icon={<AlertTriangle className="w-5 h-5" />}
                color="error"
              />
              <StatCard
                label={t('collection:stats.pendingGross')}
                value={formatCurrency(stats.pendingGrossTotal)}
                icon={<Banknote className="w-5 h-5" />}
                color="primary"
              />
              <StatCard
                label={t('collection:stats.collected')}
                value={stats.collectedCount}
                sub={formatCurrency(stats.collectedNetTotal)}
                icon={<CheckCircle2 className="w-5 h-5" />}
                color="success"
              />
            </div>
          </>
        )}

        <div className="md:hidden flex overflow-x-auto scrollbar-hide gap-2 pb-1 -mx-1 px-1">
          <button type="button" className={chipClass('all')} onClick={selectChipAll}>
            {t('collection:chips.all')}
          </button>
          <button type="button" className={chipClass('overdue')} onClick={selectChipOverdue}>
            {t('collection:chips.overdue')}
          </button>
          <button type="button" className={chipClass('thisMonth')} onClick={selectChipThisMonth}>
            {t('collection:chips.thisMonth')}
          </button>
          <button type="button" className={chipClass('lastMonth')} onClick={selectChipLastMonth}>
            {t('collection:chips.lastMonth')}
          </button>
        </div>

        <Card className="p-4">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('collection:filters.search')}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="hidden md:flex gap-2 items-center shrink-0">
              <CollectionPeriodSelects
                selectedYear={selectedYear}
                selectedMonth={selectedMonth}
                yearOptions={yearOptions}
                monthOptions={monthOptions}
                now={now}
                onPeriodChange={handlePeriodChange}
                t={t}
              />
            </div>
          </div>
        </Card>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : (
          <>
            <div className="md:hidden space-y-4">
              {!displayedPayments.length ? (
                <EmptyState
                  title={
                    overdueOnly
                      ? t('collection:empty.noOverdue.title')
                      : t('collection:empty.title')
                  }
                  description={
                    overdueOnly
                      ? t('collection:empty.noOverdue.description')
                      : t('collection:empty.description')
                  }
                />
              ) : (
                displayedPayments.map((p) => {
                  const sub = p.subscriptions;
                  const site = sub?.customer_sites;
                  const customer = site?.customers;
                  const overdue = isOverdue(p.payment_month);
                  const hasInvoice = sub?.official_invoice ?? p.should_invoice;
                  const totalDue = hasInvoice ? Number(p.total_amount || 0) : Number(p.amount || 0);
                  const daysLate = getDaysOverdueCount(p.payment_month);
                  const periodFull = getMonthLabelFull(p.payment_month, t);

                  return (
                    <Card
                      key={p.id}
                      className={cn(
                        'overflow-hidden shadow-md',
                        overdue && 'border-l-4 border-l-red-400',
                      )}
                    >
                      <div className="p-4 space-y-3">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-50 leading-tight">
                              {customer?.company_name || '-'}
                            </h3>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                              <span>{site?.site_name || '-'}</span>
                              <span className="w-1 h-1 rounded-full bg-neutral-400 dark:bg-neutral-500 shrink-0" />
                              <span className="font-mono">{site?.account_no || '-'}</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            {overdue && (
                              <span
                                className={cn(
                                  'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide',
                                  'bg-red-400/10 text-red-400 border border-red-400/20',
                                )}
                              >
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                {daysLate != null
                                  ? t('collection:status.daysOverdue', { count: daysLate })
                                  : t('collection:badges.overdue')}
                              </span>
                            )}
                            {!hasInvoice && (
                              <Badge variant="neutral" size="sm">
                                {t('collection:badges.noInvoice')}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between pt-1">
                          <div className="space-y-1 min-w-0">
                            <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                              {t('collection:card.periodLine', { label: periodFull })}
                            </p>
                            <p className="text-xl font-bold tabular-nums text-neutral-900 dark:text-neutral-50">
                              {formatCurrency(totalDue)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              variant="primary"
                              size="md"
                              className="rounded-xl px-5 shadow-lg shadow-primary-500/20"
                              onClick={() => setSelectedPayment(p)}
                            >
                              {t('collection:actions.recordPayment')}
                            </Button>
                            <IconButton
                              icon={ExternalLink}
                              variant="ghost"
                              size="md"
                              aria-label={t('collection:actions.viewSubscription')}
                              onClick={() => navigate(`/subscriptions/${p.subscription_id}`)}
                              className="shrink-0 text-neutral-500 dark:text-neutral-400"
                            />
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>

            <div className="hidden md:block">
              {!payments?.length ? (
                <EmptyState
                  title={t('collection:empty.title')}
                  description={t('collection:empty.description')}
                />
              ) : (
                <Card className="overflow-hidden">
                  <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      {t('collection:summary', { count: payments.length })}
                      {stats && (
                        <span className="ml-2 font-medium text-neutral-900 dark:text-neutral-100">
                          · {formatCurrency(stats.pendingNetTotal)} net ·{' '}
                          {formatCurrency(stats.pendingGrossTotal)}{' '}
                          {t('collection:stats.pendingGross').toLowerCase()}
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800">
                        <tr>
                          <th className="px-4 py-3 font-medium">{t('collection:columns.customer')}</th>
                          <th className="px-4 py-3 font-medium hidden md:table-cell">
                            {t('collection:columns.site')}
                          </th>
                          <th className="px-4 py-3 font-medium hidden lg:table-cell">
                            {t('collection:columns.accountNo')}
                          </th>
                          <th className="px-4 py-3 font-medium">{t('collection:columns.period')}</th>
                          <th className="px-4 py-3 font-medium hidden sm:table-cell">
                            {t('collection:columns.frequency')}
                          </th>
                          <th className="px-4 py-3 font-medium text-right">{t('collection:columns.net')}</th>
                          <th className="px-4 py-3 font-medium text-right hidden sm:table-cell">
                            {t('collection:columns.vat')}
                          </th>
                          <th className="px-4 py-3 font-medium text-right">{t('collection:columns.total')}</th>
                          <th className="px-4 py-3 font-medium text-center">{t('collection:columns.actions')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                        {payments.map((p) => {
                          const sub = p.subscriptions;
                          const site = sub?.customer_sites;
                          const customer = site?.customers;
                          const overdue = isOverdue(p.payment_month);
                          const hasInvoice = sub?.official_invoice ?? p.should_invoice;
                          const vatAmount = hasInvoice ? Number(p.vat_amount || 0) : 0;
                          const totalDue = hasInvoice ? Number(p.total_amount || 0) : Number(p.amount || 0);

                          return (
                            <tr key={p.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/30">
                              <td className="px-4 py-3">
                                <div className="font-medium text-neutral-900 dark:text-neutral-100">
                                  {customer?.company_name || '-'}
                                </div>
                                <div className="text-xs text-neutral-500 md:hidden">{site?.site_name || '-'}</div>
                              </td>
                              <td className="px-4 py-3 hidden md:table-cell text-neutral-600 dark:text-neutral-400">
                                {site?.site_name || '-'}
                              </td>
                              <td className="px-4 py-3 hidden lg:table-cell text-neutral-500 font-mono text-xs">
                                {site?.account_no || '-'}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span>{getMonthLabel(p.payment_month, t)}</span>
                                  {overdue && (
                                    <Badge variant="error" size="sm">
                                      {t('collection:badges.overdue')}
                                    </Badge>
                                  )}
                                  {!hasInvoice && (
                                    <Badge variant="neutral" size="sm">
                                      {t('collection:badges.noInvoice')}
                                    </Badge>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 hidden sm:table-cell text-neutral-500 text-xs">
                                {t(`collection:frequency.${sub?.billing_frequency || 'monthly'}`)}
                              </td>
                              <td className="px-4 py-3 text-right font-medium tabular-nums">
                                {formatCurrency(p.amount)}
                              </td>
                              <td className="px-4 py-3 text-right text-neutral-500 tabular-nums hidden sm:table-cell">
                                {hasInvoice ? formatCurrency(vatAmount) : '-'}
                              </td>
                              <td className="px-4 py-3 text-right font-bold tabular-nums text-neutral-900 dark:text-neutral-100">
                                {formatCurrency(totalDue)}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => setSelectedPayment(p)}
                                    leftIcon={<Zap className="w-3.5 h-3.5" />}
                                  >
                                    {t('collection:actions.pay')}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => navigate(`/subscriptions/${p.subscription_id}`)}
                                    title={t('collection:actions.viewSubscription')}
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          </>
        )}
      </div>

      <PaymentRecordModal
        open={!!selectedPayment}
        onClose={() => setSelectedPayment(null)}
        payment={selectedPayment}
      />
    </PageContainer>
  );
}

function CollectionPeriodSelects({ selectedYear, selectedMonth, yearOptions, monthOptions, now, onPeriodChange, t }) {
  return (
    <div className="flex gap-2 items-center shrink-0 flex-wrap">
      <select
        value={selectedYear ?? 'all'}
        onChange={(e) => {
          if (e.target.value === 'all') {
            onPeriodChange('all');
          } else {
            onPeriodChange(e.target.value, selectedMonth || now.getMonth() + 1);
          }
        }}
        className="px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
      >
        <option value="all">{t('collection:filters.allPeriods')}</option>
        {yearOptions.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>

      {selectedYear && (
        <select
          value={selectedMonth ?? 1}
          onChange={(e) => onPeriodChange(selectedYear, e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
        >
          {monthOptions.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, icon, color }) {
  const colorMap = {
    warning: 'bg-warning-50 dark:bg-warning-900/20 text-warning-600 dark:text-warning-400',
    error: 'bg-error-50 dark:bg-error-900/20 text-error-600 dark:text-error-400',
    success: 'bg-success-50 dark:bg-success-900/20 text-success-600 dark:text-success-400',
    primary: 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400',
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorMap[color]}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
            {label}
          </p>
          <p className="text-lg font-bold text-neutral-900 dark:text-neutral-100 truncate">{value}</p>
          {sub && <p className="text-xs text-neutral-500 dark:text-neutral-400">{sub}</p>}
        </div>
      </div>
    </Card>
  );
}
