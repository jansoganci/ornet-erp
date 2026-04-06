import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  Edit2,
  Trash2,
  TrendingUp,
  ListOrdered,
  Receipt,
  ArrowUpCircle,
  Filter,
  X,
  CreditCard,
  Building2,
  Banknote,
  Smartphone,
  Rocket,
  Settings2,
  Wrench,
  DollarSign,
} from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/layout';
import {
  Button,
  Table,
  Card,
  Select,
  EmptyState,
  ErrorState,
  IconButton,
  Modal,
  TableSkeleton,
  KpiCard,
} from '../../components/ui';
import { useTransactions, useDeleteTransaction } from './hooks';
import { getLastNMonths } from './api';
import { useCustomers } from '../customers/hooks';
import { QuickEntryModal } from './components/QuickEntryModal';
import { ViewModeToggle } from './components/ViewModeToggle';
import { formatDate, formatCurrency } from '../../lib/utils';
import { getErrorMessage } from '../../lib/errorHandler';
import { PAYMENT_METHODS, INCOME_TYPES } from './schema';

// ── Constants ────────────────────────────────────────────────────────────────

const INCOME_TYPE_ICONS = {
  subscription: CreditCard,
  sim_rental: Smartphone,
  sale: Rocket,
  service: Settings2,
  installation: Wrench,
  maintenance: Settings2,
  other: DollarSign,
};

const PAYMENT_METHOD_ICONS = {
  card: CreditCard,
  cash: Banknote,
  bank_transfer: Building2,
};

// ── Component ────────────────────────────────────────────────────────────────

export function IncomePage() {
  const { t } = useTranslation(['finance', 'common']);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [transactionToDelete, setTransactionToDelete] = useState(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const defaultPeriod = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  const period = searchParams.get('period') || defaultPeriod;
  const paymentMethod = searchParams.get('paymentMethod') || 'all';
  const viewMode = searchParams.get('viewMode') || 'total';
  const incomeType = searchParams.get('incomeType') || 'all';
  const customerId = searchParams.get('customer') || 'all';
  const recurringFilter = searchParams.get('recurring') || 'all';

  const handleFilterChange = (key, value) => {
    setSearchParams((prev) => {
      const isDefault = (k, v) =>
        (k === 'period' && v === defaultPeriod) ||
        (k === 'paymentMethod' && v === 'all') ||
        (k === 'viewMode' && v === 'total') ||
        (k === 'incomeType' && v === 'all') ||
        (k === 'customer' && v === 'all') ||
        (k === 'recurring' && v === 'all');
      if (value && !isDefault(key, value)) prev.set(key, value);
      else prev.delete(key);
      return prev;
    });
  };

  const { data: transactions = [], isLoading, error, refetch } = useTransactions({
    direction: 'income',
    period: period || undefined,
    payment_method: paymentMethod === 'all' ? undefined : paymentMethod,
    viewMode: viewMode === 'total' ? undefined : viewMode,
    income_type: incomeType === 'all' ? undefined : incomeType,
    customer_id: customerId === 'all' ? undefined : customerId,
    recurring_only: recurringFilter === 'recurring_only' ? true : undefined,
  });

  const kpis = useMemo(() => {
    if (!transactions?.length) return { total: 0, count: 0, average: 0, largest: 0, largestType: null };
    const total = transactions.reduce((sum, t) => sum + (Number(t.amount_try) || 0), 0);
    const count = transactions.length;
    const average = total / count;
    let largestAmount = 0;
    let largestType = null;
    transactions.forEach((t) => {
      const amt = Number(t.amount_try) || 0;
      if (amt > largestAmount) {
        largestAmount = amt;
        largestType = t.income_type;
      }
    });
    return { total, count, average, largest: largestAmount, largestType };
  }, [transactions]);

  // ── Mobile: active filter count ──
  const activeFilterCount = useMemo(() => {
    return [
      period !== defaultPeriod,
      paymentMethod !== 'all',
      incomeType !== 'all',
      customerId !== 'all',
      recurringFilter !== 'all',
      viewMode !== 'total',
    ].filter(Boolean).length;
  }, [period, defaultPeriod, paymentMethod, incomeType, customerId, recurringFilter, viewMode]);

  const { data: customers = [] } = useCustomers();
  const deleteMutation = useDeleteTransaction();

  const customerOptions = useMemo(
    () => [
      { value: 'all', label: t('finance:filters.all') },
      ...customers.map((c) => ({
        value: c.id,
        label: c.company_name || c.name || '-',
      })),
    ],
    [customers, t]
  );

  const recurringFilterOptions = [
    { value: 'all', label: t('finance:filters.recurringAll') },
    { value: 'recurring_only', label: t('finance:filters.recurringOnly') },
  ];

  const incomeTypeOptions = [
    { value: 'all', label: t('finance:filters.all') },
    ...INCOME_TYPES.map((type) => ({
      value: type,
      label: t(`finance:income.incomeTypes.${type}`),
    })),
  ];

  const paymentMethodOptions = [
    { value: 'all', label: t('finance:filters.all') },
    ...PAYMENT_METHODS.map((m) => ({
      value: m,
      label: t(`finance:expense.paymentMethods.${m}`),
    })),
  ];

  const monthOptions = useMemo(() => getLastNMonths(12).map((v) => ({ value: v, label: v })), []);

  const handleAdd = () => {
    setEditingTransaction(null);
    setIsModalOpen(true);
  };

  const handleEdit = (tx) => {
    setEditingTransaction(tx);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (transactionToDelete) {
      await deleteMutation.mutateAsync(transactionToDelete.id);
      setTransactionToDelete(null);
    }
  };

  // ── Helper: get income type icon ──
  const getIncomeTypeIcon = (type) => {
    return INCOME_TYPE_ICONS[type] || DollarSign;
  };

  // ── Helper: get payment method icon ──
  const getPaymentMethodIcon = (method) => {
    return PAYMENT_METHOD_ICONS[method] || Banknote;
  };

  // ── Helper: get reference chip for mobile card ──
  const getReferenceChip = (tx) => {
    if (tx.customer_sites?.account_no) {
      return tx.customer_sites.account_no;
    }
    if (tx.proposal_id) {
      return t('finance:income.fields.proposal');
    }
    if (tx.work_order_id) {
      return t('finance:income.fields.workOrder');
    }
    return null;
  };

  // ── Desktop table columns ──
  const columns = [
    {
      header: t('finance:income.fields.date'),
      accessor: 'transaction_date',
      render: (val) => formatDate(val),
    },
    {
      header: t('finance:income.fields.amount'),
      accessor: 'amount_try',
      render: (val) => formatCurrency(val),
    },
    {
      header: t('finance:income.fields.incomeType'),
      accessor: 'income_type',
      render: (val) => (val ? t(`finance:income.incomeTypes.${val}`) : '-'),
    },
    {
      header: t('finance:income.fields.customer'),
      accessor: 'customers',
      minWidth: '14rem',
      maxWidth: '14rem',
      cellClassName: 'whitespace-normal align-top min-w-0',
      render: (val) => {
        const name = val?.company_name;
        return (
          <span className="line-clamp-2 break-words" title={name || undefined}>
            {name || '-'}
          </span>
        );
      },
    },
    {
      header: t('finance:income.fields.paymentMethod'),
      accessor: 'payment_method',
      render: (val) => (val ? t(`finance:expense.paymentMethods.${val}`) : '-'),
    },
    {
      header: t('finance:income.fields.description'),
      accessor: 'description',
      render: (val) => (val ? val : '-'),
    },
    {
      header: t('common:actions.actionsColumn'),
      id: 'actions',
      align: 'right',
      stickyRight: true,
      render: (_, row) => (
        <div className="flex justify-end space-x-1" onClick={(e) => e.stopPropagation()}>
          <IconButton
            icon={Edit2}
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(row);
            }}
            aria-label={t('finance:actions.edit')}
          />
          <IconButton
            icon={Trash2}
            size="sm"
            variant="ghost"
            className="text-error-600 hover:bg-error-50"
            onClick={(e) => {
              e.stopPropagation();
              setTransactionToDelete(row);
            }}
            aria-label={t('finance:actions.delete')}
          />
        </div>
      ),
    },
  ];

  // ══════════════════════════════════════════════════════════════════════════
  // LOADING STATE
  // ══════════════════════════════════════════════════════════════════════════

  if (isLoading) {
    return (
      <PageContainer maxWidth="full" padding="default" className="space-y-6">
        <PageHeader title={t('finance:list.titleIncome')} />

        {/* Mobile loading — md:hidden */}
        <div className="md:hidden space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/10">
                <div className="h-3 w-16 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse mb-2" />
                <div className="h-6 w-20 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
              </div>
            ))}
          </div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-neutral-800 animate-pulse shrink-0" />
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="h-3 w-14 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
                  <div className="h-4 w-32 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
                </div>
                <div className="h-5 w-16 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse shrink-0" />
              </div>
              <div className="flex justify-between items-center mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
                  <div className="h-3 w-16 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
                </div>
                <div className="h-3 w-20 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
              </div>
            </div>
          ))}
        </div>

        {/* Desktop loading — hidden md:block */}
        <div className="hidden md:block space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <KpiCard title={t('finance:income.kpi.total')} value="0" icon={TrendingUp} loading />
            <KpiCard title={t('finance:income.kpi.count')} value="0" icon={ListOrdered} loading />
            <KpiCard title={t('finance:income.kpi.average')} value="0" icon={Receipt} loading />
            <KpiCard title={t('finance:income.kpi.largest')} value="0" icon={ArrowUpCircle} loading />
          </div>
          <TableSkeleton cols={6} />
        </div>
      </PageContainer>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ERROR STATE
  // ══════════════════════════════════════════════════════════════════════════

  if (error) {
    return (
      <PageContainer maxWidth="full" padding="default">
        <PageHeader
          title={t('finance:list.titleIncome')}
          breadcrumbs={[
            { label: t('common:nav.dashboard'), to: '/' },
            { label: t('finance:dashboard.title'), to: '/finance' },
            { label: t('finance:list.titleIncome') },
          ]}
        />
        <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
      </PageContainer>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <PageContainer maxWidth="full" padding="default" className="space-y-6">
      <PageHeader
        title={t('finance:list.titleIncome')}
        breadcrumbs={[
          { label: t('common:nav.dashboard'), to: '/' },
          { label: t('finance:dashboard.title'), to: '/finance' },
          { label: t('finance:list.titleIncome') },
        ]}
        actions={
          <div className="flex gap-2">
            <Button
              variant="primary"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={handleAdd}
              className="hidden md:inline-flex"
            >
              {t('finance:income.addButton')}
            </Button>
            <button
              type="button"
              onClick={handleAdd}
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-primary-600 text-white active:scale-95 transition-transform shadow-lg shadow-primary-600/20"
              aria-label={t('finance:income.addButton')}
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        }
      />

      {/* ── Mobile KPI Strip — md:hidden ── */}
      <section className="grid grid-cols-2 gap-3 md:hidden">
        <div className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/10">
          <p className="text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-neutral-500 dark:text-neutral-400 mb-1">
            {t('finance:income.kpi.total')}
          </p>
          <p className="text-green-400 font-bold text-xl tracking-tight tabular-nums">
            {formatCurrency(kpis.total)}
          </p>
        </div>
        <div className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/10">
          <p className="text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-neutral-500 dark:text-neutral-400 mb-1">
            {t('finance:income.kpi.count')}
          </p>
          <p className="text-neutral-900 dark:text-neutral-50 font-bold text-xl tracking-tight">
            {kpis.count}
          </p>
        </div>
        <div className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/10">
          <p className="text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-neutral-500 dark:text-neutral-400 mb-1">
            {t('finance:income.kpi.average')}
          </p>
          <p className="text-neutral-500 dark:text-neutral-400 font-bold text-xl tracking-tight tabular-nums">
            {formatCurrency(kpis.average)}
          </p>
          <p className="text-[0.625rem] text-neutral-400 dark:text-neutral-500 mt-0.5">
            {t('finance:mobile.perTransaction')}
          </p>
        </div>
        <div className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/10">
          <p className="text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-neutral-500 dark:text-neutral-400 mb-1">
            {t('finance:income.kpi.largest')}
          </p>
          <p className="text-primary-400 font-bold text-xl tracking-tight tabular-nums">
            {formatCurrency(kpis.largest)}
          </p>
          {kpis.largestType && (
            <p className="text-[0.625rem] text-neutral-400 dark:text-neutral-500 mt-0.5">
              {t(`finance:income.incomeTypes.${kpis.largestType}`)}
            </p>
          )}
        </div>
      </section>

      {/* ── Desktop KPI Grid — hidden md:grid ── */}
      <div className="hidden md:grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiCard title={t('finance:income.kpi.total')} value={formatCurrency(kpis.total)} icon={TrendingUp} />
        <KpiCard title={t('finance:income.kpi.count')} value={String(kpis.count)} icon={ListOrdered} />
        <KpiCard title={t('finance:income.kpi.average')} value={formatCurrency(kpis.average)} icon={Receipt} />
        <KpiCard title={t('finance:income.kpi.largest')} value={formatCurrency(kpis.largest)} icon={ArrowUpCircle} />
      </div>

      {/* ── Mobile Filter Row — md:hidden ── */}
      <section className="flex items-center gap-3 overflow-x-auto pb-1 md:hidden">
        <button
          type="button"
          onClick={() => setShowMobileFilters((v) => !v)}
          className="flex items-center gap-2 bg-neutral-100 dark:bg-[#201f1f] px-4 py-2 rounded-full border border-neutral-200 dark:border-[#494847]/20 active:scale-95 transition-transform shrink-0"
        >
          <Filter className="w-4 h-4 text-primary-600 dark:text-primary-400" />
          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-50">
            {t('finance:mobile.filterButton')}
          </span>
          {activeFilterCount > 0 && (
            <span className="bg-primary-600 text-white text-[0.625rem] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
        <div className="flex items-center gap-2 bg-primary-50 dark:bg-primary-600/10 text-primary-700 dark:text-primary-400 px-4 py-2 rounded-full border border-primary-200 dark:border-primary-600/20 shrink-0">
          <span className="text-sm font-medium">
            {period === defaultPeriod ? t('finance:mobile.thisMonth') : period}
          </span>
          {period !== defaultPeriod && (
            <button
              type="button"
              onClick={() => handleFilterChange('period', defaultPeriod)}
              className="hover:text-primary-500 dark:hover:text-primary-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </section>

      {/* ── Mobile Collapsible Filter Panel — md:hidden ── */}
      {showMobileFilters && (
        <section className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/20 space-y-4 md:hidden">
          <Select label={t('finance:filters.period')} options={monthOptions} value={period} onChange={(e) => handleFilterChange('period', e.target.value)} />
          <Select label={t('finance:filters.paymentMethod')} options={paymentMethodOptions} value={paymentMethod} onChange={(e) => handleFilterChange('paymentMethod', e.target.value)} />
          <Select label={t('finance:filters.incomeType')} options={incomeTypeOptions} value={incomeType} onChange={(e) => handleFilterChange('incomeType', e.target.value)} />
          <Select label={t('finance:filters.customer')} options={customerOptions} value={customerId} onChange={(e) => handleFilterChange('customer', e.target.value)} />
          <Select label={t('finance:filters.recurringFilterLabel')} options={recurringFilterOptions} value={recurringFilter} onChange={(e) => handleFilterChange('recurring', e.target.value)} />
          <ViewModeToggle value={viewMode} onChange={(v) => handleFilterChange('viewMode', v)} size="md" />
        </section>
      )}

      {/* ── Desktop Filter Card — hidden md:block ── */}
      <Card className="hidden md:block p-4 border-neutral-200/60 dark:border-neutral-800/60">
        <div className="flex flex-col md:flex-row gap-4 flex-wrap">
          <div className="w-full md:w-40">
            <Select label={t('finance:filters.period')} options={monthOptions} value={period} onChange={(e) => handleFilterChange('period', e.target.value)} />
          </div>
          <div className="w-full md:w-48">
            <Select label={t('finance:filters.paymentMethod')} options={paymentMethodOptions} value={paymentMethod} onChange={(e) => handleFilterChange('paymentMethod', e.target.value)} />
          </div>
          <div className="w-full md:w-48">
            <Select label={t('finance:filters.incomeType')} options={incomeTypeOptions} value={incomeType} onChange={(e) => handleFilterChange('incomeType', e.target.value)} />
          </div>
          <div className="w-full md:w-56">
            <Select label={t('finance:filters.customer')} options={customerOptions} value={customerId} onChange={(e) => handleFilterChange('customer', e.target.value)} />
          </div>
          <div className="w-full md:w-44">
            <Select label={t('finance:filters.recurringFilterLabel')} options={recurringFilterOptions} value={recurringFilter} onChange={(e) => handleFilterChange('recurring', e.target.value)} />
          </div>
          <div className="flex items-end">
            <ViewModeToggle value={viewMode} onChange={(v) => handleFilterChange('viewMode', v)} size="md" />
          </div>
        </div>
      </Card>

      {/* ── Transaction List ── */}
      {transactions.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title={t('finance:list.emptyIncome')}
          description={t('finance:list.addFirstIncome')}
          actionLabel={t('finance:income.addButton')}
          onAction={handleAdd}
        />
      ) : (
        <>
          {/* ── Mobile Transaction Card List — md:hidden ── */}
          <section className="space-y-3 md:hidden">
            {transactions.map((tx) => {
              const TypeIcon = getIncomeTypeIcon(tx.income_type);
              const PaymentIcon = getPaymentMethodIcon(tx.payment_method);
              const paymentLabel = tx.payment_method
                ? t(`finance:expense.paymentMethods.${tx.payment_method}`)
                : '-';
              const incomeTypeLabel = tx.income_type
                ? t(`finance:income.incomeTypes.${tx.income_type}`)
                : '-';
              const referenceChip = getReferenceChip(tx);

              return (
                <div
                  key={tx.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleEdit(tx)}
                  onKeyDown={(e) => e.key === 'Enter' && handleEdit(tx)}
                  className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/5 active:bg-neutral-50 dark:active:bg-[#262626] transition-colors cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    {/* Circular icon */}
                    <div className="w-10 h-10 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center shrink-0">
                      <TypeIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-neutral-500 dark:text-neutral-400">
                        {incomeTypeLabel}
                      </p>
                      <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-50 tracking-tight truncate">
                        {tx.customers?.company_name || tx.description || t('finance:mobile.noDescription')}
                      </h3>
                    </div>

                    {/* Amount */}
                    <span className="text-green-400 font-bold text-lg shrink-0 tabular-nums">
                      {formatCurrency(tx.amount_try)}
                    </span>
                  </div>

                  {/* Bottom row */}
                  <div className="flex items-center justify-between mt-4 ml-[52px]">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
                        <PaymentIcon className="w-3.5 h-3.5" />
                        <span className="text-xs">{paymentLabel}</span>
                      </div>
                      {referenceChip && (
                        <span className="text-[0.625rem] px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                          {referenceChip}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                      {formatDate(tx.transaction_date)}
                    </span>
                  </div>
                </div>
              );
            })}
          </section>

          {/* ── Desktop Table — hidden md:block ── */}
          <div className="hidden md:block">
            <div className="bg-white dark:bg-[#171717] rounded-2xl border border-neutral-200 dark:border-[#262626] overflow-hidden shadow-sm">
              <Table columns={columns} data={transactions} onRowClick={(row) => handleEdit(row)} />
            </div>
          </div>
        </>
      )}

      {/* ── Shared Modals ── */}
      <QuickEntryModal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTransaction(null);
        }}
        direction="income"
        transaction={editingTransaction}
      />

      <Modal
        open={!!transactionToDelete}
        onClose={() => setTransactionToDelete(null)}
        title={t('finance:deleteConfirm.title')}
        size="sm"
        footer={
          <div className="flex gap-3 w-full">
            <Button variant="ghost" onClick={() => setTransactionToDelete(null)} className="flex-1">
              {t('common:actions.cancel')}
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deleteMutation.isPending} className="flex-1">
              {t('finance:actions.delete')}
            </Button>
          </div>
        }
      >
        <p className="text-center py-4">{t('finance:deleteConfirm.message')}</p>
      </Modal>
    </PageContainer>
  );
}
