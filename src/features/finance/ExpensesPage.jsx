import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Edit2, Trash2, Repeat, TrendingDown } from 'lucide-react';
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
  Badge,
  TableSkeleton,
} from '../../components/ui';
import { useTransactions, useDeleteTransaction, useCategories } from './hooks';
import { useCustomers } from '../customers/hooks';
import { QuickEntryModal } from './components/QuickEntryModal';
import { ViewModeToggle } from './components/ViewModeToggle';
import { formatDate, formatCurrency } from '../../lib/utils';
import { PAYMENT_METHODS } from './schema';

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

export function ExpensesPage() {
  const { t } = useTranslation(['finance', 'common']);
  const navigate = useNavigate();
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
  const categoryId = searchParams.get('category') || 'all';
  const customerId = searchParams.get('customer') || 'all';
  const recurringFilter = searchParams.get('recurring') || 'all';

  const handleFilterChange = (key, value) => {
    setSearchParams((prev) => {
      const isDefault = (k, v) =>
        (k === 'period' && v === defaultPeriod) ||
        (k === 'paymentMethod' && v === 'all') ||
        (k === 'viewMode' && v === 'total') ||
        (k === 'category' && v === 'all') ||
        (k === 'customer' && v === 'all') ||
        (k === 'recurring' && v === 'all');
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

  const { data: categories = [] } = useCategories({ is_active: true });
  const { data: customers = [] } = useCustomers();
  const deleteMutation = useDeleteTransaction();

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

  const monthOptions = useMemo(() => getLast12Months(), []);

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
      render: (val) => val?.company_name || '-',
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

  if (isLoading) {
    return (
      <PageContainer maxWidth="xl" padding="default">
        <PageHeader title={t('finance:list.title')} />
        <div className="mt-6">
          <TableSkeleton cols={8} />
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer maxWidth="xl" padding="default">
        <PageHeader
          title={t('finance:list.title')}
          breadcrumbs={[
            { label: t('common:nav.dashboard'), to: '/' },
            { label: t('finance:dashboard.title'), to: '/finance' },
            { label: t('finance:list.title') },
          ]}
        />
        <ErrorState message={error.message} onRetry={refetch} />
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="xl" padding="default" className="space-y-6">
      <PageHeader
        title={t('finance:list.title')}
        breadcrumbs={[
          { label: t('common:nav.dashboard'), to: '/' },
          { label: t('finance:dashboard.title'), to: '/finance' },
          { label: t('finance:list.title') },
        ]}
        actions={
          <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />} onClick={handleAdd}>
            {t('finance:expense.addButton')}
          </Button>
        }
      />

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
          <div className="w-full md:w-56">
            <Select
              label={t('finance:filters.category')}
              options={categoryOptions}
              value={categoryId}
              onChange={(e) => handleFilterChange('category', e.target.value)}
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
          icon={TrendingDown}
          title={t('finance:list.empty')}
          description={t('finance:list.addFirst')}
          actionLabel={t('finance:expense.addButton')}
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
        direction="expense"
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
