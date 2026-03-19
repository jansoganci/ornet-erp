import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Banknote, Zap, AlertTriangle, CheckCircle2, ExternalLink, Search } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/layout';
import { Card, Badge, Spinner, EmptyState, ErrorState, Button } from '../../components/ui';
import { useCollectionPayments, useCollectionStats, useCollectionRecordPayment } from './collectionHooks';
import { PaymentRecordModal } from '../subscriptions/components/PaymentRecordModal';
import { formatCurrency } from '../../lib/utils';

function getMonthLabel(paymentMonth, t) {
  if (!paymentMonth) return '';
  const d = new Date(paymentMonth);
  return `${t('common:monthsShort.' + d.getMonth())} ${d.getFullYear()}`;
}

function isOverdue(paymentMonth) {
  const now = new Date();
  const current = new Date(now.getFullYear(), now.getMonth(), 1);
  return new Date(paymentMonth) < current;
}

export function CollectionDeskPage() {
  const { t } = useTranslation(['collection', 'common', 'subscriptions']);
  const navigate = useNavigate();
  const now = new Date();

  // Filters: null year/month = show all pending
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedPayment, setSelectedPayment] = useState(null);

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

  // Generate year options (current year +/- 1)
  const yearOptions = useMemo(() => {
    const y = now.getFullYear();
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

  if (error) {
    return (
      <PageContainer maxWidth="full">
        <PageHeader
          title={t('collection:title')}
          breadcrumbs={[
            { label: t('common:nav.subscriptions'), to: '/subscriptions' },
            { label: t('collection:title') },
          ]}
        />
        <ErrorState message={t('common:errors.loadFailed')} />
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="full">
      <PageHeader
        title={t('collection:title')}
        breadcrumbs={[
          { label: t('common:nav.subscriptions'), to: '/subscriptions' },
          { label: t('collection:title') },
        ]}
      />

      <div className="mt-6 space-y-6">
        {/* KPI Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        )}

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            {/* Search */}
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

            {/* Period filter */}
            <div className="flex gap-2 items-center shrink-0">
              <select
                value={selectedYear ?? 'all'}
                onChange={(e) => {
                  if (e.target.value === 'all') {
                    handlePeriodChange('all');
                  } else {
                    handlePeriodChange(e.target.value, selectedMonth || now.getMonth() + 1);
                  }
                }}
                className="px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
              >
                <option value="all">{t('collection:filters.allPeriods')}</option>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>

              {selectedYear && (
                <select
                  value={selectedMonth ?? 1}
                  onChange={(e) => handlePeriodChange(selectedYear, e.target.value)}
                  className="px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
                >
                  {monthOptions.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </Card>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : !payments?.length ? (
          <EmptyState
            title={t('collection:empty.title')}
            description={t('collection:empty.description')}
          />
        ) : (
          <Card className="overflow-hidden">
            {/* Summary line */}
            <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {t('collection:summary', { count: payments.length })}
                {stats && (
                  <span className="ml-2 font-medium text-neutral-900 dark:text-neutral-100">
                    · {formatCurrency(stats.pendingNetTotal)} net · {formatCurrency(stats.pendingGrossTotal)} {t('collection:stats.pendingGross').toLowerCase()}
                  </span>
                )}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800">
                  <tr>
                    <th className="px-4 py-3 font-medium">{t('collection:columns.customer')}</th>
                    <th className="px-4 py-3 font-medium hidden md:table-cell">{t('collection:columns.site')}</th>
                    <th className="px-4 py-3 font-medium hidden lg:table-cell">{t('collection:columns.accountNo')}</th>
                    <th className="px-4 py-3 font-medium">{t('collection:columns.period')}</th>
                    <th className="px-4 py-3 font-medium hidden sm:table-cell">{t('collection:columns.frequency')}</th>
                    <th className="px-4 py-3 font-medium text-right">{t('collection:columns.net')}</th>
                    <th className="px-4 py-3 font-medium text-right hidden sm:table-cell">{t('collection:columns.vat')}</th>
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
                          {/* Mobile: show site below customer */}
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

      {/* Payment Modal — reuse existing PaymentRecordModal */}
      <PaymentRecordModal
        open={!!selectedPayment}
        onClose={() => setSelectedPayment(null)}
        payment={selectedPayment}
      />
    </PageContainer>
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
        <div className={`p-2 rounded-lg ${colorMap[color]}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
            {label}
          </p>
          <p className="text-lg font-bold text-neutral-900 dark:text-neutral-100 truncate">
            {value}
          </p>
          {sub && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{sub}</p>
          )}
        </div>
      </div>
    </Card>
  );
}
