import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as XLSX from 'xlsx';
import { Plus, Download, Filter, Edit2, Trash2, FileSpreadsheet, Pencil, Cpu as SimIcon, Calendar } from 'lucide-react';
import { useSimCards, useDeleteSimCard, useUpdateSimCard, useSimFinancialStats } from './hooks';
import { PageContainer, PageHeader } from '../../components/layout';
import { 
  Button, 
  SearchInput, 
  Select,
  Card, 
  Badge, 
  EmptyState, 
  Skeleton, 
  ErrorState,
  Table,
  IconButton
} from '../../components/ui';
import { formatCurrency, formatDate } from '../../lib/utils';
import { SimCardStats } from './components/SimCardStats';
import { QuickStatusSelect } from './components/QuickStatusSelect';

export function SimCardsListPage() {
  const { t } = useTranslation('simCards');
  const { t: tCommon } = useTranslation('common');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('search') || '';
  const statusFilter = searchParams.get('status') || 'all';
  const [quickEditMode, setQuickEditMode] = useState(false);

  const handleSearch = (value) => {
    setSearchParams((prev) => {
      if (value) prev.set('search', value);
      else prev.delete('search');
      return prev;
    });
  };

  const handleStatusFilter = (value) => {
    setSearchParams((prev) => {
      if (value && value !== 'all') prev.set('status', value);
      else prev.delete('status');
      return prev;
    });
  };

  const { data: simCards, isLoading, error, refetch } = useSimCards();
  const { data: simStats } = useSimFinancialStats();
  const deleteSimMutation = useDeleteSimCard();
  const updateSimCardMutation = useUpdateSimCard();

  const filteredSimCards = simCards?.filter(sim => {
    const term = search.toLowerCase();
    const matchesSearch = !term ||
      sim.phone_number?.toLowerCase().includes(term) ||
      sim.buyer?.company_name?.toLowerCase().includes(term) ||
      sim.customers?.company_name?.toLowerCase().includes(term);

    const matchesStatus = statusFilter === 'all' || sim.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleAdd = () => navigate('/sim-cards/new');
  const handleImport = () => navigate('/sim-cards/import');
  const handleEdit = (id) => navigate(`/sim-cards/${id}/edit`);

  const handleExport = () => {
    if (!filteredSimCards?.length) return;

    const exportData = filteredSimCards.map(sim => ({
      [t('list.columns.phoneNumber')]: sim.phone_number,
      [t('list.columns.operator')]: t(`operators.${sim.operator}`),
      [t('list.columns.status')]: t(`status.${sim.status}`),
      [t('list.columns.buyer')]: sim.buyer?.company_name || '-',
      [t('list.columns.customer')]: sim.customers?.company_name || '-',
      [t('list.columns.site')]: sim.customer_sites?.site_name || '-',
      [t('list.columns.costPrice')]: sim.cost_price,
      [t('list.columns.salePrice')]: sim.sale_price,
      [t('form.notes')]: sim.notes
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SIM_Cards");
    XLSX.writeFile(wb, `Ornet_SIM_Listesi_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleDelete = async (id) => {
    if (window.confirm(tCommon('confirm.deleteMessage'))) {
      await deleteSimMutation.mutateAsync(id);
    }
  };

  const handleQuickStatusChange = async (simId, newStatus) => {
    await updateSimCardMutation.mutateAsync({ id: simId, status: newStatus });
  };

  const getStatusVariant = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'available': return 'info';
      case 'subscription': return 'primary';
      case 'cancelled': return 'warning';
      default: return 'default';
    }
  };

  if (isLoading) {
    return (
      <PageContainer maxWidth="xl">
        <PageHeader title={t('title')} />
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer maxWidth="xl">
        <ErrorState message={error.message} onRetry={() => refetch()} />
      </PageContainer>
    );
  }

  const columns = [
    {
      header: t('list.columns.phoneNumber'),
      accessor: 'phone_number',
      render: (value) => (
        <div className="font-medium text-neutral-900 dark:text-neutral-50">{value}</div>
      ),
    },
    {
      header: t('list.columns.status'),
      accessor: 'status',
      render: (value, row) => (
        <div onClick={quickEditMode ? (e) => e.stopPropagation() : undefined}>
          {quickEditMode && row.status !== 'subscription' ? (
            <QuickStatusSelect sim={row} onStatusChange={handleQuickStatusChange} t={t} />
          ) : (
            <Badge variant={getStatusVariant(value)}>{t(`status.${value}`)}</Badge>
          )}
        </div>
      ),
    },
    {
      header: t('list.columns.operator'),
      accessor: 'operator',
      render: (value) => t(`operators.${value}`),
    },
    {
      header: t('list.columns.buyer'),
      accessor: 'buyer',
      render: (_, row) => (
        <span className="text-neutral-600 dark:text-neutral-400">
          {row.buyer?.company_name || '-'}
        </span>
      ),
    },
    {
      header: t('list.columns.customer'),
      accessor: 'customers',
      render: (_, row) => row.customers?.company_name || '-',
    },
    {
      header: t('list.columns.activationDate'),
      accessor: 'activation_date',
      render: (value) => (
        <div className="flex items-center gap-1.5 text-sm text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
          <Calendar className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          {value ? formatDate(value) : '-'}
        </div>
      ),
    },
    {
      header: t('list.columns.costPrice'),
      accessor: 'cost_price',
      render: (value, row) => (
        <span className="text-neutral-600 dark:text-neutral-400">
          {formatCurrency(value ?? 0, row.currency ?? 'TRY')}
        </span>
      ),
    },
    {
      header: t('list.columns.salePrice'),
      accessor: 'sale_price',
      render: (value, row) => (
        <span className="font-medium text-neutral-900 dark:text-neutral-50">
          {formatCurrency(value ?? 0, row.currency ?? 'TRY')}
        </span>
      ),
    },
    {
      header: tCommon('actions.actionsColumn'),
      accessor: 'id',
      align: 'right',
      render: (_, row) => (
        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <IconButton
            icon={Edit2}
            size="sm"
            variant="ghost"
            onClick={() => handleEdit(row.id)}
            aria-label={t('actions.edit')}
          />
          <IconButton
            icon={Trash2}
            size="sm"
            variant="ghost"
            onClick={() => handleDelete(row.id)}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:text-red-900/20"
            aria-label={t('actions.delete')}
          />
        </div>
      ),
    },
  ];

  return (
    <PageContainer maxWidth="xl" className="space-y-6">
      <PageHeader
        title={t('title')}
        breadcrumbs={[
          { label: tCommon('nav.dashboard'), to: '/' },
          { label: t('title') },
        ]}
        actions={
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              leftIcon={<FileSpreadsheet className="w-4 h-4" />}
              onClick={handleExport}
              disabled={!filteredSimCards?.length}
            >
              {tCommon('actions.export')}
            </Button>
            <Button
              variant="outline"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={handleImport}
            >
              {t('actions.import')}
            </Button>
            <Button
              variant="primary"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={handleAdd}
            >
              {t('actions.add')}
            </Button>
          </div>
        }
      />

      <SimCardStats simCards={simCards} statsData={simStats} />

      <Card className="p-4 border-neutral-200/60 dark:border-neutral-800/60">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <SearchInput
              value={search}
              onChange={handleSearch}
              placeholder={t('list.searchPlaceholder')}
              className="w-full"
            />
          </div>
          
          <div className="w-full md:w-64">
            <Select
              value={statusFilter}
              onChange={(e) => handleStatusFilter(e.target.value)}
              options={[
                { value: 'all', label: t('list.filters.all') },
                { value: 'available', label: t('list.filters.available') },
                { value: 'active', label: t('list.filters.active') },
                { value: 'subscription', label: t('list.filters.subscription') },
                { value: 'cancelled', label: t('list.filters.cancelled') }
              ]}
              leftIcon={<Filter className="w-4 h-4" />}
            />
          </div>
          <Button
            variant={quickEditMode ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setQuickEditMode(!quickEditMode)}
            leftIcon={<Pencil className="w-4 h-4" />}
          >
            {t('list.quickEdit')}
          </Button>
        </div>
      </Card>

      {!filteredSimCards?.length ? (
        <EmptyState
          icon={SimIcon}
          title={t('list.empty.title')}
          description={t('list.empty.description')}
          actionLabel={t('actions.add')}
          onAction={handleAdd}
        />
      ) : (
        <div className="bg-white dark:bg-[#171717] rounded-2xl border border-neutral-200 dark:border-[#262626] overflow-hidden shadow-sm">
          <Table
            columns={columns}
            data={filteredSimCards}
            onRowClick={(row) => handleEdit(row.id)}
            className="border-none"
          />
        </div>
      )}
    </PageContainer>
  );
}
