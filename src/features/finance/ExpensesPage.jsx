import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Edit2,
  Trash2,
  Repeat,
  TrendingDown,
  ListOrdered,
  Receipt,
  ArrowDownCircle,
  Filter,
  X,
  CreditCard,
  Building2,
  Banknote,
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
  Badge,
  TableSkeleton,
  KpiCard,
} from '../../components/ui';
import { useTransactions, useDeleteTransaction, useCategories } from './hooks';
import { getLastNMonths } from './api';
import { useCustomers } from '../customers/hooks';
import { QuickEntryModal } from './components/QuickEntryModal';
import { CategoryManagementModal } from './components/CategoryManagementModal';
import { ViewModeToggle } from './components/ViewModeToggle';
import { GroupToggle } from './components/GroupToggle';
import { ExpenseGroupedView } from './components/ExpenseGroupedView';
import { formatDate, formatCurrency } from '../../lib/utils';
import { getErrorMessage } from '../../lib/errorHandler';
import { PAYMENT_METHODS } from './schema';

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
];

const PAYMENT_METHOD_ICONS = {
  card: CreditCard,
  cash: Banknote,
  bank_transfer: Building2,
};

// ── Component ────────────────────────────────────────────────────────────────

export function ExpensesPage() {
  const { t } = useTranslation(['finance', 'common']);
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [transactionToDelete, setTransactionToDelete] = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const defaultPeriod = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  const period = searchParams.get('period') || defaultPeriod;
  const paymentMethod = searchParams.get('paymentMethod') || 'all';
  const viewMode = searchParams.get('viewMode') || 'total';
  const categoryId = searchParams.get('category') || 'all';
  const customerId = searchParams.get('customer') || 'all';
  const recurringFilter = searchParams.get('recurring') || 'all';
  const groupBy = searchParams.get('groupBy') || 'list';

  const handleFilterChange = (key, value) => {
    setSearchParams((prev) => {
      const isDefault = (k, v) =>
        (k === 'period' && v === defaultPeriod) ||
        (k === 'paymentMethod' && v === 'all') ||
        (k === 'viewMode' && v === 'total') ||
        (k === 'category' && v === 'all') ||
        (k === 'customer' && v === 'all') ||
        (k === 'recurring' && v === 'all') ||
        (k === 'groupBy' && v === 'list');
      if (value && !isDefault(key, value)) prev.set(key, value);
      else prev.delete(key);
      return prev;
    });
  };

  const { data: transactions = [], isLoading, error, refetch } = useTransactions({
    direction: 'expense',
    period: period || undefined,
    payment_method: paymentMethod === 'all' ? undefined : paymentMethod,
    viewMode: viewMode === 'total' ? undefined : viewMode,
    expense_category_id: categoryId === 'all' ? undefined : categoryId,
    customer_id: customerId === 'all' ? undefined : customerId,
    recurring_only: recurringFilter === 'recurring_only' ? true : undefined,
  });

  const kpis = useMemo(() => {
    if (!transactions?.length) return { total: 0, count: 0, average: 0, largest: 0 };
    const total = transactions.reduce((sum, t) => sum + (Number(t.amount_try) || 0), 0);
    const count = transactions.length;
    const average = total / count;
    const largest = Math.max(...transactions.map((t) => Number(t.amount_try) || 0));
    return { total, count, average, largest };
  }, [transactions]);

  const groupedData = useMemo(() => {
    if (!transactions?.length) return [];
    const map = new Map();
    transactions.forEach((tx) => {
      const key = tx.expense_category_id || '__none__';
      const categoryName =
        tx.expense_categories?.name_tr ||
        tx.expense_categories?.name_en ||
        tx.expense_categories?.code ||
        t('finance:grouped.noCategory');
      if (!map.has(key)) {
        map.set(key, { key, categoryName, total: 0, count: 0, items: [] });
      }
      const g = map.get(key);
      g.total += Number(tx.amount_try) || 0;
      g.count += 1;
      g.items.push(tx);
    });
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [transactions, t]);

  const { data: categories = [] } = useCategories({ is_active: true });
  const { data: customers = [] } = useCustomers();
  const deleteMutation = useDeleteTransaction();

  // ── Mobile: category color map ──
  const categoryColorMap = useMemo(() => {
    const map = new Map();
    categories.forEach((c, i) => {
      map.set(c.id, CATEGORY_COLORS[i % CATEGORY_COLORS.length]);
    });
    return map;
  }, [categories]);

  // ── Mobile: active filter count ──
  const activeFilterCount = useMemo(() => {
    return [
      period !== defaultPeriod,
      paymentMethod !== 'all',
      categoryId !== 'all',
      customerId !== 'all',
      recurringFilter !== 'all',
      viewMode !== 'total',
    ].filter(Boolean).length;
  }, [period, defaultPeriod, paymentMethod, categoryId, customerId, recurringFilter, viewMode]);

  const categoryOptions = [
    { value: 'all', label: t('finance:filters.all') },
    ...categories.map((c) => ({
      value: c.id,
      label: c.name_tr || c.name_en || c.code,
    })),
  ];

  const customerOptions = [
    { value: 'all', label: t('finance:filters.all') },
    ...customers.map((c) => ({
      value: c.id,
      label: c.company_name || c.name || '-',
    })),
  ];

  const paymentMethodOptions = [
    { value: 'all', label: t('finance:filters.all') },
    ...PAYMENT_METHODS.map((m) => ({
      value: m,
      label: t(`finance:expense.paymentMethods.${m}`),
    })),
  ];

  const recurringFilterOptions = [
    { value: 'all', label: t('finance:filters.recurringAll') },
    { value: 'recurring_only', label: t('finance:filters.recurringOnly') },
  ];

  const monthOptions = useMemo(() => getLastNMonths(12).map((v) => ({ value: v, label: v })), []);

  const handleGoToRecurringTemplate = (templateId) => {
    navigate('/finance/recurring', { state: { highlightTemplateId: templateId } });
  };

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

  // ── Desktop table columns (unchanged) ──
  const columns = [
    {
      header: t('finance:expense.fields.date'),
      accessor: 'transaction_date',
      render: (val) => formatDate(val),
    },
    {
      header: t('finance:expense.fields.amount'),
      accessor: 'amount_try',
      render: (val) => formatCurrency(val),
    },
    {
      header: t('finance:expense.fields.category'),
      accessor: 'expense_categories',
      render: (val) => val?.name_tr || val?.code || '-',
    },
    {
      header: t('finance:expense.fields.customer'),
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
      header: t('finance:expense.fields.source'),
      accessor: 'proposal_id',
      render: (val) => (val ? t('finance:income.fields.proposal') : '-'),
    },
    {
      header: t('finance:expense.fields.paymentMethod'),
      accessor: 'payment_method',
      render: (val) => (val ? t(`finance:expense.paymentMethods.${val}`) : '-'),
    },
    {
      header: t('finance:expense.fields.description'),
      accessor: 'description',
      render: (val) => (val ? val : '-'),
    },
    {
      header: t('finance:filters.recurringFilterLabel'),
      accessor: 'recurring_template_id',
      render: (_, row) =>
        row.recurring_template_id ? (
          <div className="flex items-center gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => handleGoToRecurringTemplate(row.recurring_template_id)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium bg-info-50 dark:bg-info-900/30 text-info-700 dark:text-info-300 hover:bg-info-100 dark:hover:bg-info-900/50 transition-colors"
            >
              <Repeat className="w-3 h-3 shrink-0" />
              {t('finance:expenseRecurring.badge')}
            </button>
            {row.recurring_expense_templates?.is_variable && (
              <Badge variant="warning" size="sm">
                {t('finance:expenseRecurring.variableBadge')}
              </Badge>
            )}
          </div>
        ) : (
          <span className="text-neutral-400 dark:text-neutral-500">—</span>
        ),
    },
    {
      header: t('common:actions.actionsColumn'),
      id: 'actions',
      align: 'right',
      stickyRight: true,
      render: (_, row) => (
        <div className="flex justify-end items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
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

  // ── Helper: get category info for a transaction ──
  const getCategoryInfo = (tx) => {
    const name =
      tx.expense_categories?.name_tr ||
      tx.expense_categories?.name_en ||
      tx.expense_categories?.code ||
      t('finance:grouped.noCategory');
    const color = categoryColorMap.get(tx.expense_category_id) || '#737373';
    return { name, color };
  };

  // ── Helper: get payment method icon ──
  const getPaymentMethodIcon = (method) => {
    return PAYMENT_METHOD_ICONS[method] || Banknote;
  };

  // ══════════════════════════════════════════════════════════════════════════
  // LOADING STATE
  // ══════════════════════════════════════════════════════════════════════════

  if (isLoading) {
    return (
      <PageContainer maxWidth="full" padding="default" className="space-y-6">
        <PageHeader title={t('finance:list.title')} />

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
              <div className="flex justify-between items-start mb-3">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-neutral-300 dark:bg-neutral-700 animate-pulse" />
                    <div className="h-3 w-14 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
                  </div>
                  <div className="h-4 w-40 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
                </div>
                <div className="h-5 w-16 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
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
            <KpiCard title={t('finance:expense.kpi.total')} value="0" icon={TrendingDown} loading />
            <KpiCard title={t('finance:expense.kpi.count')} value="0" icon={ListOrdered} loading />
            <KpiCard title={t('finance:expense.kpi.average')} value="0" icon={Receipt} loading />
            <KpiCard title={t('finance:expense.kpi.largest')} value="0" icon={ArrowDownCircle} loading />
          </div>
          <TableSkeleton cols={8} />
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
          title={t('finance:list.title')}
          breadcrumbs={[
            { label: t('common:nav.dashboard'), to: '/' },
            { label: t('finance:dashboard.title'), to: '/finance' },
            { label: t('finance:list.title') },
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
        title={t('finance:list.title')}
        breadcrumbs={[
          { label: t('common:nav.dashboard'), to: '/' },
          { label: t('finance:dashboard.title'), to: '/finance' },
          { label: t('finance:list.title') },
        ]}
        actions={
          <div className="flex gap-2">
            <Button
              variant="primary"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={handleAdd}
              className="hidden md:inline-flex"
            >
              {t('finance:expense.addButton')}
            </Button>
            <button
              type="button"
              onClick={handleAdd}
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-primary-600 text-white active:scale-95 transition-transform shadow-lg shadow-primary-600/20"
              aria-label={t('finance:expense.addButton')}
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
            {t('finance:expense.kpi.total')}
          </p>
          <p className="text-red-400 font-bold text-xl tracking-tight tabular-nums">
            {formatCurrency(kpis.total)}
          </p>
        </div>
        <div className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/10">
          <p className="text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-neutral-500 dark:text-neutral-400 mb-1">
            {t('finance:expense.kpi.count')}
          </p>
          <p className="text-neutral-900 dark:text-neutral-50 font-bold text-xl tracking-tight">
            {kpis.count}
          </p>
        </div>
        <div className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/10">
          <p className="text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-neutral-500 dark:text-neutral-400 mb-1">
            {t('finance:expense.kpi.average')}
          </p>
          <p className="text-neutral-500 dark:text-neutral-400 font-bold text-xl tracking-tight tabular-nums">
            {formatCurrency(kpis.average)}
          </p>
        </div>
        <div className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/10">
          <p className="text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-neutral-500 dark:text-neutral-400 mb-1">
            {t('finance:expense.kpi.largest')}
          </p>
          <p className="text-amber-400 font-bold text-xl tracking-tight tabular-nums">
            {formatCurrency(kpis.largest)}
          </p>
        </div>
      </section>

      {/* ── Desktop KPI Grid — hidden md:grid ── */}
      <div className="hidden md:grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiCard title={t('finance:expense.kpi.total')} value={formatCurrency(kpis.total)} icon={TrendingDown} />
        <KpiCard title={t('finance:expense.kpi.count')} value={String(kpis.count)} icon={ListOrdered} />
        <KpiCard title={t('finance:expense.kpi.average')} value={formatCurrency(kpis.average)} icon={Receipt} />
        <KpiCard title={t('finance:expense.kpi.largest')} value={formatCurrency(kpis.largest)} icon={ArrowDownCircle} />
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
          <div className="space-y-1">
            <Select label={t('finance:filters.category')} options={categoryOptions} value={categoryId} onChange={(e) => handleFilterChange('category', e.target.value)} />
            <Button variant="ghost" size="sm" className="text-xs text-primary-600 dark:text-primary-400 -mt-1" onClick={() => setShowCategoryModal(true)}>
              {t('finance:categories.manageButton')}
            </Button>
          </div>
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
          <div className="w-full md:w-56 flex flex-col gap-1">
            <Select label={t('finance:filters.category')} options={categoryOptions} value={categoryId} onChange={(e) => handleFilterChange('category', e.target.value)} />
            <Button variant="ghost" size="sm" className="text-xs text-primary-600 dark:text-primary-400 self-start -mt-1" onClick={() => setShowCategoryModal(true)}>
              {t('finance:categories.manageButton')}
            </Button>
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
          <div className="flex items-end">
            <GroupToggle value={groupBy} onChange={(v) => handleFilterChange('groupBy', v)} />
          </div>
        </div>
      </Card>

      {/* ── Mobile Transaction Card List — md:hidden ── */}
      {transactions.length === 0 ? (
        <EmptyState
          icon={TrendingDown}
          title={t('finance:list.empty')}
          description={t('finance:list.addFirst')}
          actionLabel={t('finance:expense.addButton')}
          onAction={handleAdd}
        />
      ) : (
        <>
          <section className="space-y-3 md:hidden">
            {transactions.map((tx) => {
              const { name: categoryName, color: categoryColor } = getCategoryInfo(tx);
              const PaymentIcon = getPaymentMethodIcon(tx.payment_method);
              const paymentLabel = tx.payment_method
                ? t(`finance:expense.paymentMethods.${tx.payment_method}`)
                : '-';

              return (
                <div
                  key={tx.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleEdit(tx)}
                  onKeyDown={(e) => e.key === 'Enter' && handleEdit(tx)}
                  className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/5 active:bg-neutral-50 dark:active:bg-[#262626] transition-colors cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="space-y-1 min-w-0 flex-1 mr-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: categoryColor }} />
                        <span className="text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-neutral-500 dark:text-neutral-400">
                          {categoryName}
                        </span>
                        {tx.recurring_template_id && (
                          <span className="bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-[0.625rem] px-2 py-0.5 rounded-full border border-primary-200 dark:border-primary-600/20">
                            {t('finance:expenseRecurring.badge')}
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-50 tracking-tight truncate">
                        {tx.description || categoryName}
                      </h3>
                    </div>
                    <span className="text-red-400 font-bold text-lg shrink-0 tabular-nums">
                      {formatCurrency(tx.amount_try)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
                      <PaymentIcon className="w-4 h-4" />
                      <span className="text-xs">{paymentLabel}</span>
                    </div>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                      {formatDate(tx.transaction_date)}
                    </span>
                  </div>
                </div>
              );
            })}
          </section>

          {/* ── Desktop Data View — hidden md:block ── */}
          <div className="hidden md:block">
            {groupBy === 'grouped' ? (
              <ExpenseGroupedView groups={groupedData} onEditTransaction={handleEdit} />
            ) : (
              <div className="bg-white dark:bg-[#171717] rounded-2xl border border-neutral-200 dark:border-[#262626] overflow-hidden shadow-sm">
                <Table columns={columns} data={transactions} onRowClick={(row) => handleEdit(row)} />
              </div>
            )}
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
        direction="expense"
        transaction={editingTransaction}
      />

      <CategoryManagementModal
        open={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
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
