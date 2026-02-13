import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit2, Trash2 } from 'lucide-react';
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [transactionToDelete, setTransactionToDelete] = useState(null);

  const [period, setPeriod] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [paymentMethod, setPaymentMethod] = useState('all');
  const [viewMode, setViewMode] = useState('total');
  const [categoryId, setCategoryId] = useState('all');
  const [customerId, setCustomerId] = useState('all');

  const { data: transactions = [], isLoading, error, refetch } = useTransactions({
    direction: 'expense',
    period: period || undefined,
    payment_method: paymentMethod === 'all' ? undefined : paymentMethod,
    viewMode: viewMode === 'total' ? undefined : viewMode,
    expense_category_id: categoryId === 'all' ? undefined : categoryId,
    customer_id: customerId === 'all' ? undefined : customerId,
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

  const monthOptions = getLast12Months();

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
      header: '',
      id: 'actions',
      render: (_, row) => (
        <div className="flex justify-end space-x-1">
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
      <PageContainer>
        <PageHeader title={t('finance:list.title')} />
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <PageHeader title={t('finance:list.title')} />
        <ErrorState message={error.message} onRetry={refetch} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={t('finance:list.title')}
        actions={
          <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />} onClick={handleAdd}>
            {t('finance:expense.addButton')}
          </Button>
        }
      />

      <Card className="p-4 shadow-sm border-neutral-200/60 dark:border-neutral-800/60 mb-6">
        <div className="flex flex-col md:flex-row gap-4 flex-wrap">
          <div className="w-full md:w-40">
            <Select
              label={t('finance:filters.period')}
              options={monthOptions}
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
          </div>
          <div className="w-full md:w-48">
            <Select
              label={t('finance:filters.paymentMethod')}
              options={paymentMethodOptions}
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            />
          </div>
          <div className="w-full md:w-56">
            <Select
              label={t('finance:filters.category')}
              options={categoryOptions}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            />
          </div>
          <div className="w-full md:w-56">
            <Select
              label={t('finance:filters.customer')}
              options={customerOptions}
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <ViewModeToggle value={viewMode} onChange={setViewMode} size="md" />
          </div>
        </div>
      </Card>

      {transactions.length === 0 ? (
        <EmptyState
          title={t('finance:list.empty')}
          description={t('finance:list.addFirst')}
          action={
            <Button variant="primary" onClick={handleAdd}>
              {t('finance:expense.addButton')}
            </Button>
          }
        />
      ) : (
        <div className="bg-white dark:bg-[#171717] rounded-2xl border border-neutral-200 dark:border-[#262626] overflow-hidden shadow-sm">
          <Table columns={columns} data={transactions} />
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
