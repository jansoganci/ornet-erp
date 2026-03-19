import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as XLSX from 'xlsx';
import { Plus, Download, Filter, Edit2, Trash2, FileSpreadsheet, Pencil, Cpu as SimIcon, Calendar, ChevronLeft, ChevronRight, Package, CheckCircle2, TrendingUp, CreditCard } from 'lucide-react';
import { useSimCardsPaginated, useDeleteSimCard, useUpdateSimCard, useSimFinancialStats, useProviderCompanies } from './hooks';
import { fetchSimCards } from './api';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
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
  IconButton,
  Modal,
  DateRangeFilter,
  KpiCard,
} from '../../components/ui';
import { formatCurrency, formatDate } from '../../lib/utils';
import { getErrorMessage } from '../../lib/errorHandler';
import { QuickStatusSelect } from './components/QuickStatusSelect';

export function SimCardsListPage() {
  const { t } = useTranslation(['simCards', 'common']);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [quickEditMode, setQuickEditMode] = useState(false);
  const [simToDelete, setSimToDelete] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  const searchFromUrl = searchParams.get('search') || '';
  const [localSearch, setLocalSearch] = useState(searchFromUrl);
  const debouncedSearch = useDebouncedValue(localSearch, 300);
  const statusFilter = searchParams.get('status') || 'all';
  const operatorFilter = searchParams.get('operator') || 'all';
  const providerFilter = searchParams.get('provider') || 'all';
  const yearParam = searchParams.get('year') || '';
  const monthParam = searchParams.get('month') || '';
  const page = Number(searchParams.get('page') || '0');

  // Sync local search from URL
  useEffect(() => {
    setLocalSearch(searchFromUrl);
  }, [searchFromUrl]);
  // Sync debounced search to URL — reset page on new search
  useEffect(() => {
    if (searchFromUrl === debouncedSearch) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (debouncedSearch) next.set('search', debouncedSearch);
      else next.delete('search');
      next.delete('page');
      return next;
    });
  }, [debouncedSearch, searchFromUrl, setSearchParams]);

  const handleFilterChange = (key, value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value && value !== 'all') next.set(key === 'provider_company_id' ? 'provider' : key, value);
      else next.delete(key === 'provider_company_id' ? 'provider' : key);
      next.delete('page');
      return next;
    });
  };

  const handlePageChange = (newPage) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newPage > 0) next.set('page', String(newPage));
      else next.delete('page');
      return next;
    });
  };

  const filters = {
    search: debouncedSearch || undefined,
    status: statusFilter,
    operator: operatorFilter,
    provider_company_id: providerFilter,
    year: yearParam || undefined,
    month: monthParam || undefined,
  };

  const {
    data: simCards,
    isLoading,
    error,
    refetch,
    isFetching,
    totalCount,
    pageCount,
    pageSize,
  } = useSimCardsPaginated(filters, page);
  const { data: simStats } = useSimFinancialStats();
  const { data: providerCompanies } = useProviderCompanies();
  const deleteSimMutation = useDeleteSimCard();
  const updateSimCardMutation = useUpdateSimCard();

  const handleAdd = () => navigate('/sim-cards/new');
  const handleImport = () => navigate('/sim-cards/import');
  const handleEdit = (id) => navigate(`/sim-cards/${id}/edit`);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Fetch all matching rows (not just current page) for complete export
      const all = await fetchSimCards(filters);
      if (!all?.length) return;

      const exportData = all.map(sim => ({
        [t('list.columns.provider')]: sim.provider_company?.name || '-',
        [t('list.columns.phoneNumber')]: sim.phone_number,
        [t('list.columns.imsi')]: sim.imsi || '-',
        [t('list.columns.capacity')]: sim.capacity || '-',
        [t('list.columns.operator')]: t(`operators.${sim.operator}`),
        [t('list.columns.gprsSerialNo')]: sim.gprs_serial_no || '-',
        [t('list.columns.accountNo')]: sim.account_no || '-',
        [t('list.columns.customerLabel')]: sim.customers?.company_name || sim.customer_label || '-',
        [t('list.columns.activationDate')]: sim.activation_date ? formatDate(sim.activation_date) : '-',
        [t('list.columns.costPrice')]: sim.cost_price,
        [t('list.columns.salePrice')]: sim.sale_price,
        [t('list.columns.status')]: t(`status.${sim.status}`),
        [t('form.notes')]: sim.notes || '-'
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "SIM_Cards");
      XLSX.writeFile(wb, `Ornet_SIM_Listesi_${new Date().toISOString().split('T')[0]}.xlsx`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = (row) => {
    setSimToDelete(row);
  };

  const confirmDelete = async () => {
    if (!simToDelete) return;
    try {
      await deleteSimMutation.mutateAsync(simToDelete.id);
    } catch {
      // error handled by mutation onError
    } finally {
      setSimToDelete(null);
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
      <PageContainer maxWidth="full">
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
      <PageContainer maxWidth="full">
        <ErrorState message={getErrorMessage(error, 'simCards.loadFailed')} onRetry={() => refetch()} />
      </PageContainer>
    );
  }

  const columns = [
    {
      header: t('list.columns.provider'),
      accessor: 'provider_company',
      render: (_, row) => (
        <span className="text-neutral-600 dark:text-neutral-400">
          {row.provider_company?.name || '-'}
        </span>
      ),
    },
    {
      header: t('list.columns.phoneNumber'),
      accessor: 'phone_number',
      render: (value) => (
        <div className="font-medium text-neutral-900 dark:text-neutral-50">{value}</div>
      ),
    },
    {
      header: t('list.columns.imsi'),
      accessor: 'imsi',
      render: (value) => (
        <span className="text-neutral-600 dark:text-neutral-400 font-mono text-sm">
          {value || '-'}
        </span>
      ),
    },
    {
      header: t('list.columns.capacity'),
      accessor: 'capacity',
      render: (value) => (
        <span className="text-neutral-600 dark:text-neutral-400">{value || '-'}</span>
      ),
    },
    {
      header: t('list.columns.operator'),
      accessor: 'operator',
      render: (value) => t(`operators.${value}`),
    },
    {
      header: t('list.columns.gprsSerialNo'),
      accessor: 'gprs_serial_no',
      render: (value) => (
        <span className="text-neutral-600 dark:text-neutral-400 font-mono text-sm">
          {value || '-'}
        </span>
      ),
    },
    {
      header: t('list.columns.accountNo'),
      accessor: 'account_no',
      render: (value) => (
        <span className="text-neutral-600 dark:text-neutral-400">{value || '-'}</span>
      ),
    },
    {
      header: t('list.columns.customerLabel'),
      accessor: 'customers',
      maxWidth: 250,
      cellClassName: 'whitespace-normal break-words align-top',
      render: (_, row) => (
        <span className="break-words">
          {row.customers?.company_name || row.customer_label || '-'}
        </span>
      ),
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
      header: t('common:actions.actionsColumn'),
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
            onClick={() => handleDelete(row)}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:text-red-900/20"
            aria-label={t('actions.delete')}
          />
        </div>
      ),
    },
  ];

  return (
    <PageContainer maxWidth="full" className="space-y-6">
      <PageHeader
        title={t('title')}
        breadcrumbs={[
          { label: t('common:nav.dashboard'), to: '/' },
          { label: t('title') },
        ]}
        actions={
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              leftIcon={<FileSpreadsheet className="w-4 h-4" />}
              onClick={handleExport}
              loading={isExporting}
              disabled={totalCount === 0}
            >
              {t('common:actions.export')}
            </Button>
            <Button
              variant="outline"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={handleImport}
            >
              {t('common:import.bulkImportButton')}
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

      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5 mb-6">
        <KpiCard
          title={t('stats.total')}
          value={simStats?.total_count ?? simCards?.length ?? 0}
          icon={Package}
          variant="default"
        />
        <KpiCard
          title={t('stats.available')}
          value={simStats?.available_count ?? simCards?.filter((s) => s.status === 'available').length ?? 0}
          icon={SimIcon}
          variant="success"
        />
        <KpiCard
          title={t('stats.active')}
          value={simStats?.active_sim_count ?? simCards?.filter((s) => s.status === 'active').length ?? 0}
          icon={TrendingUp}
          variant="info"
        />
        <KpiCard
          title={t('stats.subscription')}
          value={simStats?.subscription_count ?? simCards?.filter((s) => s.status === 'subscription').length ?? 0}
          icon={CreditCard}
          variant="info"
        />
        <KpiCard
          title={t('stats.monthlyProfit')}
          value={new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(
            simStats?.total_monthly_profit ?? (simCards || []).reduce((acc, curr) => acc + ((curr.sale_price || 0) - (curr.cost_price || 0)), 0)
          )}
          icon={CheckCircle2}
          variant="success"
        />
      </div>

      <Card className="p-3 border-neutral-200/60 dark:border-neutral-800/60">
        <div className="flex flex-col lg:flex-row items-end gap-3">
          <div className="flex-1 min-w-[200px] w-full">
            <SearchInput
              value={localSearch}
              onChange={(v) => setLocalSearch(v)}
              placeholder={t('list.searchPlaceholder')}
              className="w-full"
              size="sm"
            />
          </div>

          <div className="flex flex-wrap items-end gap-3 w-full lg:w-auto">
            <div className="w-full sm:flex-1 md:w-40">
              <Select
                label={t('list.filters.status')}
                value={statusFilter}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                options={[
                  { value: 'all', label: t('list.filters.all') },
                  { value: 'available', label: t('list.filters.available') },
                  { value: 'active', label: t('list.filters.active') },
                  { value: 'subscription', label: t('list.filters.subscription') },
                  { value: 'cancelled', label: t('list.filters.cancelled') }
                ]}
                leftIcon={<Filter className="w-4 h-4" />}
                size="sm"
              />
            </div>
            <div className="w-full sm:flex-1 md:w-40">
              <Select
                label={t('list.filters.operator')}
                value={operatorFilter}
                onChange={(e) => handleFilterChange('operator', e.target.value)}
                options={[
                  { value: 'all', label: t('list.filters.allOperators') },
                  { value: 'TURKCELL', label: t('operators.TURKCELL') },
                  { value: 'VODAFONE', label: t('operators.VODAFONE') },
                  { value: 'TURK_TELEKOM', label: t('operators.TURK_TELEKOM') },
                ]}
                size="sm"
              />
            </div>
            <div className="w-full sm:flex-1 md:w-40">
              <Select
                label={t('list.filters.provider')}
                value={providerFilter}
                onChange={(e) => handleFilterChange('provider_company_id', e.target.value)}
                options={[
                  { value: 'all', label: t('list.filters.all') },
                  ...(providerCompanies || []).map((p) => ({ value: p.id, label: p.name })),
                ]}
                size="sm"
              />
            </div>
            <div className="w-full sm:flex-1 md:w-32">
              <Select
                label={t('list.filters.selectYear')}
                value={yearParam}
                onChange={(e) => handleFilterChange('year', e.target.value)}
                options={[
                  { value: 'all', label: t('list.filters.all') },
                  ...Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - 2 + i).toString()).map(y => ({ value: y, label: y }))
                ]}
                size="sm"
              />
            </div>
            <div className="w-full sm:flex-1 md:w-36">
              <Select
                label={t('list.filters.selectMonth')}
                value={monthParam}
                onChange={(e) => handleFilterChange('month', e.target.value)}
                options={[
                  { value: 'all', label: t('list.filters.all') },
                  ...Object.entries(t('notifications:months', { returnObjects: true })).map(([val, label]) => ({
                    value: val,
                    label,
                  })),
                ]}
                size="sm"
              />
            </div>
            <div className="flex items-center pb-0.5">
              <Button
                variant={quickEditMode ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setQuickEditMode(!quickEditMode)}
                leftIcon={<Pencil className="w-4 h-4" />}
              >
                {t('list.quickEdit')}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {totalCount === 0 && !isFetching ? (
        <EmptyState
          icon={SimIcon}
          title={t('list.empty.title')}
          description={t('list.empty.description')}
          actionLabel={t('actions.add')}
          onAction={handleAdd}
        />
      ) : (
        <div className={`bg-white dark:bg-[#171717] rounded-2xl border border-neutral-200 dark:border-[#262626] overflow-hidden shadow-sm transition-opacity ${isFetching && !isLoading ? 'opacity-70' : ''}`}>
          <Table
            columns={columns}
            data={simCards}
            onRowClick={(row) => handleEdit(row.id)}
            className="border-none"
          />
          {pageCount > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200 dark:border-neutral-800">
              <span className="text-sm text-neutral-500 dark:text-neutral-400">
                {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalCount)} / {totalCount} SIM
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 0}
                  className="p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-neutral-600 dark:text-neutral-400 px-2">
                  {page + 1} / {pageCount}
                </span>
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= pageCount - 1}
                  className="p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      <Modal
        open={!!simToDelete}
        onClose={() => setSimToDelete(null)}
        title={t('delete.title')}
        size="sm"
        footer={
          <div className="flex gap-3 w-full">
            <Button
              variant="ghost"
              onClick={() => setSimToDelete(null)}
              className="flex-1"
            >
              {t('common:actions.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={confirmDelete}
              loading={deleteSimMutation.isPending}
              className="flex-1"
            >
              {t('common:actions.delete')}
            </Button>
          </div>
        }
      >
        <p>{t('delete.message', { phoneNumber: simToDelete?.phone_number })}</p>
        <p className="mt-2 text-sm text-error-600 font-bold">{t('delete.warning')}</p>
      </Modal>
    </PageContainer>
  );
}
