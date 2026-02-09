import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, ClipboardList, Search, Filter, Calendar } from 'lucide-react';
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
  ErrorState 
} from '../../components/ui';
import { 
  formatDate, 
  workOrderStatusVariant, 
} from '../../lib/utils';
import { useWorkOrders } from './hooks';
import { WORK_TYPES } from './schema';

function WorkOrdersSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <Card key={i} className="p-4">
          <div className="flex items-center space-x-4">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export function WorkOrdersListPage() {
  const { t } = useTranslation(['workOrders', 'common']);
  const { t: tCommon } = useTranslation('common');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || 'all';
  const work_type = searchParams.get('work_type') || 'all';

  const { data: workOrders = [], isLoading, error, refetch } = useWorkOrders({
    search,
    status,
    work_type
  });

  const handleSearch = (value) => {
    setSearchParams(prev => {
      if (value) prev.set('search', value);
      else prev.delete('search');
      return prev;
    });
  };

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
              className="inline-block h-7 w-7 rounded-full ring-2 ring-white dark:ring-[#171717] bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center"
              title={worker.name}
            >
              <span className="text-[10px] font-bold text-primary-700 dark:text-primary-300 uppercase">
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
              value={search}
              onChange={handleSearch}
              className="w-full"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 w-full md:w-auto md:min-w-[400px]">
            <Select
              options={statusOptions}
              value={status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              placeholder={t('workOrders:list.filters.workType')}
              leftIcon={<Filter className="w-4 h-4" />}
            />
            <Select
              options={typeOptions}
              value={work_type}
              onChange={(e) => handleFilterChange('work_type', e.target.value)}
              placeholder={t('workOrders:list.filters.allTypes')}
              leftIcon={<ClipboardList className="w-4 h-4" />}
            />
          </div>
        </div>
      </Card>

      {isLoading ? (
        <WorkOrdersSkeleton />
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
