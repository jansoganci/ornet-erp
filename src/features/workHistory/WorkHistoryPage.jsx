import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, Filter, Calendar, Building2, User, Hash, ChevronRight } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/layout';
import { 
  Button, 
  Select, 
  Input, 
  Spinner, 
  EmptyState, 
  Card,
  Badge,
  Table,
  ErrorState
} from '../../components/ui';
import { useSearchWorkHistory } from './hooks';
import { useProfiles } from '../tasks/hooks';
import { formatDate, workOrderStatusVariant } from '../../lib/utils';
import { WORK_TYPES } from '../workOrders/schema';

export function WorkHistoryPage() {
  const { t } = useTranslation(['workHistory', 'common', 'workOrders']);
  const { t: tCommon } = useTranslation('common');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Filters State
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    type: searchParams.get('type') || 'account_no',
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
    workType: searchParams.get('workType') || 'all',
    workerId: searchParams.get('workerId') || 'all',
    siteId: searchParams.get('siteId') || ''
  });

  // Update filters if URL params change
  useEffect(() => {
    const siteId = searchParams.get('siteId');
    if (siteId) {
      setFilters(prev => ({ ...prev, siteId }));
    }
  }, [searchParams]);

  // Hooks
  const { data: results = [], isLoading, error, refetch } = useSearchWorkHistory(filters);
  const { data: profiles = [] } = useProfiles();

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const columns = [
    {
      header: t('workHistory:results.columns.customer'),
      accessor: 'company_name',
      render: (val, row) => (
        <div className="min-w-[150px]">
          <p className="font-bold text-neutral-900 dark:text-neutral-100 truncate">{val}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
            {row.site_name || row.site_address}
          </p>
        </div>
      )
    },
    {
      header: t('workHistory:results.columns.accountNo'),
      accessor: 'account_no',
      render: (val) => <Badge variant="info" className="font-mono">{val || '---'}</Badge>
    },
    {
      header: t('workHistory:results.columns.workType'),
      accessor: 'work_type',
      render: (val, row) => (
        <div className="space-y-1">
          <Badge variant="outline" size="sm">{tCommon(`workType.${val}`)}</Badge>
          {row.form_no && <p className="text-[10px] font-mono text-neutral-400">#{row.form_no}</p>}
        </div>
      )
    },
    {
      header: t('workHistory:results.columns.date'),
      accessor: 'scheduled_date',
      render: (val) => val ? formatDate(val) : '---'
    },
    {
      header: t('workHistory:results.columns.workers'),
      accessor: 'assigned_workers',
      render: (workers) => (
        <div className="flex -space-x-2 overflow-hidden">
          {workers?.map(w => (
            <div key={w.id} className="h-7 w-7 rounded-full ring-2 ring-white dark:ring-[#171717] bg-primary-100 flex items-center justify-center" title={w.name}>
              <span className="text-[10px] font-bold text-primary-700 uppercase">{w.name.charAt(0)}</span>
            </div>
          ))}
        </div>
      )
    }
  ];

  return (
    <PageContainer maxWidth="xl" padding="default" className="space-y-6">
      <PageHeader
        title={t('workHistory:title')}
        description={t('workHistory:subtitle')}
        breadcrumbs={[
          { label: t('common:nav.dashboard'), to: '/' },
          { label: t('workHistory:title') }
        ]}
      />

      {/* Advanced Search Card */}
      <Card className="p-6 shadow-sm">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-4">
              <label className="block text-xs font-black text-neutral-400 uppercase tracking-widest mb-2">
                {t('workHistory:search.label')}
              </label>
              <div className="flex bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl">
                <button
                  onClick={() => handleFilterChange('type', 'account_no')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${filters.type === 'account_no' ? 'bg-white dark:bg-[#262626] text-primary-600 shadow-sm' : 'text-neutral-500'}`}
                >
                  {t('workHistory:search.byAccountNo')}
                </button>
                <button
                  onClick={() => handleFilterChange('type', 'company')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${filters.type === 'company' ? 'bg-white dark:bg-[#262626] text-primary-600 shadow-sm' : 'text-neutral-500'}`}
                >
                  {t('workHistory:search.byCompanyName')}
                </button>
              </div>
            </div>
            
            <div className="md:col-span-8 flex items-end">
              <Input
                placeholder={filters.type === 'account_no' ? t('workHistory:search.placeholder.accountNo') : t('workHistory:search.placeholder.companyName')}
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                leftIcon={filters.type === 'account_no' ? Hash : Building2}
                className="h-12"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
            <Input
              label={t('workHistory:search.filters.from')}
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              leftIcon={Calendar}
            />
            <Input
              label={t('workHistory:search.filters.to')}
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              leftIcon={Calendar}
            />
            <Select
              label={t('workHistory:search.filters.workType')}
              options={[
                { value: 'all', label: t('workOrders:list.filters.allTypes') },
                ...WORK_TYPES.map(type => ({ value: type, label: tCommon(`workType.${type}`) }))
              ]}
              value={filters.workType}
              onChange={(e) => handleFilterChange('workType', e.target.value)}
              leftIcon={Filter}
            />
            <Select
              label={t('workHistory:search.filters.worker')}
              options={[
                { value: 'all', label: t('dailyWork:filters.allWorkers') },
                ...profiles.map(p => ({ value: p.id, label: p.full_name }))
              ]}
              value={filters.workerId}
              onChange={(e) => handleFilterChange('workerId', e.target.value)}
              leftIcon={User}
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setFilters({
                search: '',
                type: 'account_no',
                dateFrom: '',
                dateTo: '',
                workType: 'all',
                workerId: 'all',
                siteId: ''
              })}
              className="text-neutral-400 hover:text-primary-600"
            >
              {t('common:actions.reset')}
            </Button>
          </div>
        </div>
      </Card>

      {/* Results */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-black text-neutral-500 uppercase tracking-widest">
            {t('workHistory:results.title')}
          </h3>
          {results.length > 0 && (
            <Badge variant="secondary">{t('workHistory:results.count', { count: results.length })}</Badge>
          )}
        </div>

        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-4">
            <Spinner size="lg" />
            <p className="text-sm text-neutral-500 animate-pulse">{t('common:loading')}</p>
          </div>
        ) : error ? (
          <ErrorState message={error.message} onRetry={() => refetch()} />
        ) : results.length === 0 ? (
          <EmptyState
            icon={Search}
            title={t('workHistory:results.noResults')}
            description={filters.search ? t('common:noResults') : t('workHistory:subtitle')}
          />
        ) : (
          <div className="bg-white dark:bg-[#171717] rounded-2xl border border-neutral-200 dark:border-[#262626] overflow-hidden shadow-sm">
            <Table
              columns={columns}
              data={results}
              onRowClick={(row) => navigate(`/work-orders/${row.id}`)}
              className="border-none"
            />
          </div>
        )}
      </div>
    </PageContainer>
  );
}
