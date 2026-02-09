import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Calendar, User, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/layout';
import { 
  Button, 
  Select, 
  Input, 
  Spinner, 
  EmptyState, 
  Card,
  Badge,
  ErrorState
} from '../../components/ui';
import { useDailyWorkList } from './hooks';
import { useProfiles } from '../tasks/hooks';
import { DailyWorkCard } from './DailyWorkCard';
import { formatDate } from '../../lib/utils';

export function DailyWorkListPage() {
  const { t } = useTranslation(['dailyWork', 'common', 'workOrders']);
  const navigate = useNavigate();
  
  // State
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');

  // Hooks
  const { data: workOrders = [], isLoading, error, refetch } = useDailyWorkList(selectedDate, selectedWorkerId);
  const { data: profiles = [], isLoading: isLoadingProfiles } = useProfiles();

  const handleDateChange = (newDate) => {
    setSelectedDate(newDate);
  };

  const shiftDate = (days) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const workerOptions = [
    { value: '', label: t('dailyWork:filters.allWorkers') },
    ...profiles.map(p => ({
      value: p.id,
      label: p.full_name
    }))
  ];

  return (
    <PageContainer maxWidth="lg" padding="default" className="space-y-6">
      <PageHeader
        title={t('dailyWork:title')}
        description={t('dailyWork:subtitle', { date: formatDate(selectedDate) })}
        breadcrumbs={[
          { label: t('common:nav.dashboard'), to: '/' },
          { label: t('dailyWork:title') }
        ]}
      />

      {/* Filters */}
      <Card className="p-4 shadow-sm border-neutral-200/60 dark:border-neutral-800/60">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full space-y-1.5">
            <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest ml-1">
              {t('dailyWork:filters.date')}
            </label>
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => shiftDate(-1)}
                className="h-11 px-2"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="flex-1"
                leftIcon={Calendar}
              />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => shiftDate(1)}
                className="h-11 px-2"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          </div>

          <div className="flex-1 w-full space-y-1.5">
            <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest ml-1">
              {t('dailyWork:filters.worker')}
            </label>
            <Select
              options={workerOptions}
              value={selectedWorkerId}
              onChange={(e) => setSelectedWorkerId(e.target.value)}
              leftIcon={User}
              disabled={isLoadingProfiles}
            />
          </div>

          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => {
              setSelectedDate(new Date().toISOString().split('T')[0]);
              setSelectedWorkerId('');
            }}
            className="text-primary-600 font-bold uppercase tracking-wider text-[10px] h-11"
          >
            {t('common:actions.reset')}
          </Button>
        </div>
      </Card>

      {/* Quick Date Shortcuts */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <Button 
          variant={selectedDate === new Date().toISOString().split('T')[0] ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
          className="whitespace-nowrap rounded-full px-4"
        >
          {t('dailyWork:today')}
        </Button>
        <Button 
          variant="outline"
          size="sm"
          onClick={() => shiftDate(1)}
          className="whitespace-nowrap rounded-full px-4"
        >
          {t('dailyWork:tomorrow')}
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center space-y-4">
          <Spinner size="lg" />
          <p className="text-sm text-neutral-500 animate-pulse">{t('common:loading')}</p>
        </div>
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : workOrders.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title={t('dailyWork:empty.title')}
          description={t('dailyWork:empty.description')}
          actionLabel={t('workOrders:list.addButton')}
          onAction={() => navigate('/work-orders/new')}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-widest">
              {t('dailyWork:table.workType')}
            </h3>
            <Badge variant="secondary">{workOrders.length} {t('common:labels.records')}</Badge>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {workOrders.map((wo) => (
              <DailyWorkCard 
                key={wo.id} 
                workOrder={wo} 
                onClick={(order) => navigate(`/work-orders/${order.id}`)}
              />
            ))}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
