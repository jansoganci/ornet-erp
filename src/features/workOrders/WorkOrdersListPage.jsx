import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, ClipboardList, Search, Filter, Calendar, Building2, AlertCircle } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/layout';
import { 
  Button, 
  SearchInput, 
  Select, 
  Table, 
  Badge, 
  Card, 
  EmptyState, 
  Skeleton, 
  ErrorState,
  TableSkeleton
} from '../../components/ui';
import { 
  formatDate, 
  formatCurrency,
  workOrderStatusVariant,
  priorityVariant,
} from '../../lib/utils';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useWorkOrders } from './hooks';
import { WORK_TYPES } from './schema';

export function WorkOrdersListPage() {
  const { t } = useTranslation(['workOrders', 'common']);
  const { t: tCommon } = useTranslation('common');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchFromUrl = searchParams.get('search') || '';
  const [localSearch, setLocalSearch] = useState(searchFromUrl);
  const debouncedSearch = useDebouncedValue(localSearch, 300);

  // Sync local search from URL
  useEffect(() => {
    setLocalSearch(searchFromUrl);
  }, [searchFromUrl]);
  // Sync debounced search to URL — setState in effect is intentional
  useEffect(() => {
    if (searchFromUrl === debouncedSearch) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (debouncedSearch) next.set('search', debouncedSearch);
      else next.delete('search');
      return next;
    });
  }, [debouncedSearch, searchFromUrl, setSearchParams]);

  const status = searchParams.get('status') || 'all';
  const work_type = searchParams.get('work_type') || 'all';
  const priority = searchParams.get('priority') || 'all';

  const { data: workOrders = [], isLoading, error, refetch } = useWorkOrders({
    search: debouncedSearch,
    status,
    work_type,
    priority
  });

  const handleSearch = (value) => setLocalSearch(value);

  const handleFilterChange = (key, value) => {
    setSearchParams(prev => {
      if (value && value !== 'all') prev.set(key, value);
      else prev.delete(key);
      return prev;
    });
  };

  const statusOptions = [
    { value: 'all', label: t('workOrders:list.filters.all') },
    { value: 'pending', label: tCommon('status.pending') },
    { value: 'scheduled', label: tCommon('status.scheduled') },
    { value: 'in_progress', label: tCommon('status.in_progress') },
    { value: 'completed', label: tCommon('status.completed') },
    { value: 'cancelled', label: tCommon('status.cancelled') },
  ];

  const typeOptions = [
    { value: 'all', label: t('workOrders:list.filters.allTypes') },
    ...WORK_TYPES.map(type => ({
      value: type,
      label: tCommon(`workType.${type}`)
    }))
  ];

  const priorityOptions = [
    { value: 'all', label: t('workOrders:list.filters.allPriorities') },
    { value: 'low', label: tCommon('priority.low') },
    { value: 'normal', label: tCommon('priority.normal') },
    { value: 'high', label: tCommon('priority.high') },
    { value: 'urgent', label: tCommon('priority.urgent') },
  ];

  const columns = [
    {
      header: t('workOrders:list.columns.customer'),
      accessor: 'company_name',
      render: (value, row) => (
        <div className="min-w-[150px]">
          <p className="font-bold text-neutral-900 dark:text-neutral-100 truncate">{value}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
            {row.site_name || row.site_address}
          </p>
          {row.account_no && (
            <p className="text-[10px] font-mono text-neutral-400 mt-0.5">{row.account_no}</p>
          )}
        </div>
      ),
    },
    {
      header: t('workOrders:list.columns.city'),
      accessor: 'city',
      render: (value) => (
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <span className="text-neutral-900 dark:text-neutral-50">
            {value || '-'}
          </span>
        </div>
      ),
    },
    {
      header: t('workOrders:form.fields.workType'),
      accessor: 'work_type',
      render: (value, row) => (
        <div className="space-y-1">
          <Badge variant="outline" size="sm">
            {tCommon(`workType.${value}`)}
          </Badge>
          {row.form_no && (
            <p className="text-[10px] font-mono text-neutral-400">#{row.form_no}</p>
          )}
        </div>
      ),
    },
    {
      header: t('workOrders:list.columns.status'),
      accessor: 'status',
      render: (value) => (
        <Badge variant={workOrderStatusVariant[value]} dot>
          {tCommon(`status.${value}`)}
        </Badge>
      ),
    },
    {
      header: t('workOrders:list.columns.priority'),
      accessor: 'priority',
      render: (value) => (
        <Badge variant={priorityVariant[value] || 'default'}>
          {tCommon(`priority.${value}`)}
        </Badge>
      ),
    },
    {
      header: t('workOrders:list.columns.amount'),
      accessor: 'amount',
      render: (value, row) => (
        <div className="text-right">
          <span className="text-neutral-900 dark:text-neutral-50 font-medium">
            {value ? formatCurrency(value, row.currency || 'TRY') : '-'}
          </span>
        </div>
      ),
    },
    {
      header: t('workOrders:form.fields.scheduledDate'),
      accessor: 'scheduled_date',
      render: (value, row) => (
        <div className="text-sm min-w-[100px]">
          <div className="flex items-center text-neutral-700 dark:text-neutral-300 font-medium">
            <Calendar className="w-3.5 h-3.5 mr-1.5 text-neutral-400" />
            {value ? formatDate(value) : '-'}
          </div>
          {row.scheduled_time && (
            <p className="text-xs text-neutral-400 ml-5">{row.scheduled_time}</p>
          )}
        </div>
      ),
    },
    {
      header: t('workOrders:form.fields.assignedTo'),
      accessor: 'assigned_workers',
      render: (workers) => (
        <div className="flex -space-x-2 overflow-hidden">
          {workers?.map((worker) => (
            <div 
              key={worker.id}
              className="inline-flex h-7 w-7 rounded-full ring-2 ring-white dark:ring-[#171717] bg-primary-100 dark:bg-primary-900/40 items-center justify-center shrink-0"
              title={worker.name}
            >
              <span className="text-[10px] font-bold text-primary-700 dark:text-primary-300 uppercase leading-none tracking-normal">
                {worker.name.charAt(0)}
              </span>
            </div>
          ))}
        </div>
      ),
    },
  ];

  return (
    <PageContainer maxWidth="xl" padding="default" className="space-y-6">
      <PageHeader
        title={t('workOrders:list.title')}
        actions={
          <Button 
            onClick={() => navigate('/work-orders/new')}
            leftIcon={<Plus className="w-4 h-4" />}
            className="shadow-lg shadow-primary-600/20"
          >
            {t('workOrders:list.addButton')}
          </Button>
        }
      />

      {/* Filters */}
      <Card className="p-4 border-neutral-200/60 dark:border-neutral-800/60">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <SearchInput
              placeholder={t('workOrders:list.searchPlaceholder')}
              value={localSearch}
              onChange={handleSearch}
              className="w-full"
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 w-full md:w-auto md:min-w-[600px]">
            <Select
              options={statusOptions}
              value={status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              placeholder={t('workOrders:list.filters.statusPlaceholder')}
              leftIcon={<Filter className="w-4 h-4" />}
            />
            <Select
              options={typeOptions}
              value={work_type}
              onChange={(e) => handleFilterChange('work_type', e.target.value)}
              placeholder={t('workOrders:list.filters.allTypes')}
              leftIcon={<ClipboardList className="w-4 h-4" />}
            />
            <Select
              options={priorityOptions}
              value={priority}
              onChange={(e) => handleFilterChange('priority', e.target.value)}
              placeholder={t('workOrders:list.filters.priority')}
              leftIcon={<AlertCircle className="w-4 h-4" />}
            />
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="mt-6">
          <TableSkeleton cols={8} />
        </div>
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : workOrders.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={t('workOrders:list.empty.title')}
          description={t('workOrders:list.empty.description')}
          actionLabel={t('workOrders:list.addButton')}
          onAction={() => navigate('/work-orders/new')}
        />
      ) : (
        <div className="bg-white dark:bg-[#171717] rounded-2xl border border-neutral-200 dark:border-[#262626] overflow-hidden shadow-sm">
          <Table
            columns={columns}
            data={workOrders}
            onRowClick={(row) => navigate(`/work-orders/${row.id}`)}
            className="border-none"
          />
        </div>
      )}
    </PageContainer>
  );
}
