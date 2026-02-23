import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Plus, Edit2, Trash2, TrendingUp, ListOrdered, Receipt, ArrowUpCircle } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/layout';
import {
  Button,
  Table,
  Card,
  Select,
  EmptyState,
  Spinner,
  ErrorState,
  IconButton,
  Modal,
  TableSkeleton,
} from '../../components/ui';
import { useTransactions, useDeleteTransaction } from './hooks';
import { useCustomers } from '../customers/hooks';
import { QuickEntryModal } from './components/QuickEntryModal';
import { ViewModeToggle } from './components/ViewModeToggle';
import { KpiCard } from './components/KpiCard';
import { formatDate, formatCurrency } from '../../lib/utils';
import { PAYMENT_METHODS, INCOME_TYPES } from './schema';

function getLast12Months() {
  const months = [];
  const d = new Date();
  for (let i = 0; i < 12; i++) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    months.push({ value: `${y}-${m}`, label: `${y}-${m}` });
    d.setMonth(d.getMonth() - 1);
  }
  return months;
}

export function IncomePage() {
  const { t } = useTranslation(['finance', 'common']);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [transactionToDelete, setTransactionToDelete] = useState(null);

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
    if (!transactions?.length) return { total: 0, count: 0, average: 0, largest: 0 };
    const total = transactions.reduce((sum, t) => sum + (Number(t.amount_try) || 0), 0);
    const count = transactions.length;
    const average = total / count;
    const largest = Math.max(...transactions.map((t) => Number(t.amount_try) || 0));
    return { total, count, average, largest };
  }, [transactions]);

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

  const monthOptions = useMemo(() => getLast12Months(), []);

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
      render: (val) => val?.company_name || '-',
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

  if (isLoading) {
    return (
      <PageContainer maxWidth="xl" padding="default" className="space-y-6">
        <PageHeader title={t('finance:list.titleIncome')} />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <KpiCard title={t('finance:income.kpi.total')} value="0" icon={TrendingUp} loading />
          <KpiCard title={t('finance:income.kpi.count')} value="0" icon={ListOrdered} loading />
          <KpiCard title={t('finance:income.kpi.average')} value="0" icon={Receipt} loading />
          <KpiCard title={t('finance:income.kpi.largest')} value="0" icon={ArrowUpCircle} loading />
        </div>
        <div className="mt-6">
          <TableSkeleton cols={6} />
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer maxWidth="xl" padding="default">
        <PageHeader
          title={t('finance:list.titleIncome')}
          breadcrumbs={[
            { label: t('common:nav.dashboard'), to: '/' },
            { label: t('finance:dashboard.title'), to: '/finance' },
            { label: t('finance:list.titleIncome') },
          ]}
        />
        <ErrorState message={error.message} onRetry={refetch} />
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="xl" padding="default" className="space-y-6">
      <PageHeader
        title={t('finance:list.titleIncome')}
        breadcrumbs={[
          { label: t('common:nav.dashboard'), to: '/' },
          { label: t('finance:dashboard.title'), to: '/finance' },
          { label: t('finance:list.titleIncome') },
        ]}
        actions={
          <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />} onClick={handleAdd}>
            {t('finance:income.addButton')}
          </Button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiCard
          title={t('finance:income.kpi.total')}
          value={formatCurrency(kpis.total)}
          icon={TrendingUp}
          loading={isLoading}
        />
        <KpiCard
          title={t('finance:income.kpi.count')}
          value={String(kpis.count)}
          icon={ListOrdered}
          loading={isLoading}
        />
        <KpiCard
          title={t('finance:income.kpi.average')}
          value={formatCurrency(kpis.average)}
          icon={Receipt}
          loading={isLoading}
        />
        <KpiCard
          title={t('finance:income.kpi.largest')}
          value={formatCurrency(kpis.largest)}
          icon={ArrowUpCircle}
          loading={isLoading}
        />
      </div>

      <Card className="p-4 border-neutral-200/60 dark:border-neutral-800/60">
        <div className="flex flex-col md:flex-row gap-4 flex-wrap">
          <div className="w-full md:w-40">
            <Select
              label={t('finance:filters.period')}
              options={monthOptions}
              value={period}
              onChange={(e) => handleFilterChange('period', e.target.value)}
            />
          </div>
          <div className="w-full md:w-48">
            <Select
              label={t('finance:filters.paymentMethod')}
              options={paymentMethodOptions}
              value={paymentMethod}
              onChange={(e) => handleFilterChange('paymentMethod', e.target.value)}
            />
          </div>
          <div className="w-full md:w-48">
            <Select
              label={t('finance:filters.incomeType')}
              options={incomeTypeOptions}
              value={incomeType}
              onChange={(e) => handleFilterChange('incomeType', e.target.value)}
            />
          </div>
          <div className="w-full md:w-56">
            <Select
              label={t('finance:filters.customer')}
              options={customerOptions}
              value={customerId}
              onChange={(e) => handleFilterChange('customer', e.target.value)}
            />
          </div>
          <div className="w-full md:w-44">
            <Select
              label={t('finance:filters.recurringFilterLabel')}
              options={recurringFilterOptions}
              value={recurringFilter}
              onChange={(e) => handleFilterChange('recurring', e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <ViewModeToggle value={viewMode} onChange={(v) => handleFilterChange('viewMode', v)} size="md" />
          </div>
        </div>
      </Card>

      {transactions.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title={t('finance:list.emptyIncome')}
          description={t('finance:list.addFirstIncome')}
          actionLabel={t('finance:income.addButton')}
          onAction={handleAdd}
        />
      ) : (
        <div className="bg-white dark:bg-[#171717] rounded-2xl border border-neutral-200 dark:border-[#262626] overflow-hidden shadow-sm">
          <Table columns={columns} data={transactions} onRowClick={(row) => handleEdit(row)} />
        </div>
      )}

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
