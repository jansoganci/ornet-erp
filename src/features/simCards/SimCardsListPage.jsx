import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as XLSX from 'xlsx';
import { Plus, Download, Filter, Edit2, Trash2, FileSpreadsheet, Pencil, Cpu as SimIcon, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSimCardsPaginated, useDeleteSimCard, useUpdateSimCard, useSimFinancialStats } from './hooks';
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
} from '../../components/ui';
import { formatCurrency, formatDate } from '../../lib/utils';
import { getErrorMessage } from '../../lib/errorHandler';
import { SimCardStats } from './components/SimCardStats';
import { QuickStatusSelect } from './components/QuickStatusSelect';

export function SimCardsListPage() {
  const { t } = useTranslation('simCards');
  const { t: tCommon } = useTranslation('common');
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
      if (value && value !== 'all') prev.set(key, value);
      else prev.delete(key);
      prev.delete('page');
      return prev;
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
        <ErrorState message={getErrorMessage(error, 'simCards.loadFailed')} onRetry={() => refetch()} />
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
            onClick={() => handleDelete(row)}
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
              loading={isExporting}
              disabled={totalCount === 0}
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
              {tCommon('actions.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={confirmDelete}
              loading={deleteSimMutation.isPending}
              className="flex-1"
            >
              {tCommon('actions.delete')}
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
