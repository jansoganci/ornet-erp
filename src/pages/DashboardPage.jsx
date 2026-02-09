import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { 
  ClipboardList, 
  CheckSquare, 
  Users, 
  Clock, 
  Plus, 
  ChevronRight,
  Phone,
  MapPin,
  Calendar,
  UserPlus,
  FilePlus,
  CheckCircle2,
  Circle,
  CalendarCheck,
  Search,
  Cpu as SimIcon
} from 'lucide-react';
import { PageContainer, PageHeader } from '../components/layout';
import { Button, Card, Badge, Spinner, IconButton, Skeleton, ErrorState } from '../components/ui';
import { 
  formatDate, 
  cn,
  workOrderStatusVariant,
  priorityVariant
} from '../lib/utils';
import { 
  useDashboardStats, 
  useTodaySchedule, 
  usePendingTasks 
} from '../features/dashboard/hooks';
import { useSimFinancialStats } from '../features/simCards/hooks';
import { StatCard } from '../features/dashboard/StatCard';
import { TaskModal } from '../features/tasks/TaskModal';
import { useUpdateTask } from '../features/tasks/hooks';
import { useAuth } from '../hooks/useAuth';

function ScheduleSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <Card key={i} className="p-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex-shrink-0 w-20 space-y-2 text-center lg:border-r lg:border-neutral-200 dark:lg:border-[#262626] lg:pr-4">
              <Skeleton className="h-6 w-12 mx-auto" />
              <Skeleton className="h-3 w-8 mx-auto" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-1/2" />
              <div className="flex gap-4">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function TasksSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <Card key={i} className="p-3">
          <div className="flex items-start gap-3">
            <Skeleton className="w-5 h-5 rounded-full mt-0.5" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <div className="flex gap-2">
                <Skeleton className="h-3 w-12 rounded-full" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function DashboardPage() {
  const { t } = useTranslation('dashboard');
  const { t: tCommon } = useTranslation('common');
  const { t: tWorkOrders } = useTranslation('workOrders');
  const { t: tTasks } = useTranslation('tasks');
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  const { data: stats, isLoading: isStatsLoading, error: statsError, refetch: refetchStats } = useDashboardStats();
  const { data: simStats, isLoading: isSimStatsLoading } = useSimFinancialStats();
  const { data: schedule, isLoading: isScheduleLoading, error: scheduleError, refetch: refetchSchedule } = useTodaySchedule();
  const { data: tasks, isLoading: isTasksLoading, error: tasksError, refetch: refetchTasks } = usePendingTasks();
  const updateTaskMutation = useUpdateTask();

  const handleToggleTask = (task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    updateTaskMutation.mutate({ id: task.id, status: newStatus });
  };

  const today = new Date();
  const formattedToday = new Intl.DateTimeFormat('tr-TR', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }).format(today);

  const userName = user?.email?.split('@')[0] || tCommon('labels.admin');

  return (
    <PageContainer maxWidth="full" padding="default" className="space-y-8">
      {/* Header */}
      <PageHeader
        title={`${t('welcome')}, ${userName}`}
        description={
          <span className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {formattedToday}
          </span>
        }
      />

      {/* Stats Grid */}
      {statsError ? (
        <ErrorState message={statsError.message} onRetry={() => refetchStats()} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title={t('stats.todayWorkOrders')}
            value={stats?.today_work_orders || 0}
            icon={Clock}
            variant="primary"
            loading={isStatsLoading}
          />
          <StatCard
            title={t('stats.pendingWorkOrders')}
            value={stats?.pending_work_orders || 0}
            icon={ClipboardList}
            variant="warning"
            loading={isStatsLoading}
          />
          <StatCard
            title={t('stats.openTasks')}
            value={stats?.open_tasks || 0}
            icon={CheckSquare}
            variant="info"
            loading={isStatsLoading}
          />
          <StatCard
            title={t('stats.totalCustomers')}
            value={stats?.total_customers || 0}
            icon={Users}
            variant="success"
            loading={isStatsLoading}
          />
          <StatCard
            title={tCommon('simCards:stats.active')}
            value={simStats?.active_sim_count || 0}
            icon={SimIcon}
            variant="primary"
            loading={isSimStatsLoading}
            onClick={() => navigate('/sim-cards')}
          />
          <StatCard
            title={tCommon('simCards:stats.monthlyProfit')}
            value={new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(simStats?.total_monthly_profit || 0)}
            icon={CheckCircle2}
            variant="success"
            loading={isSimStatsLoading}
            onClick={() => navigate('/sim-cards')}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Today's Schedule */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              {t('todaySchedule.title')}
            </h2>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/work-orders')}
              rightIcon={<ChevronRight className="w-4 h-4" />}
            >
              {t('todaySchedule.viewAll')}
            </Button>
          </div>

          {isScheduleLoading ? (
            <ScheduleSkeleton />
          ) : scheduleError ? (
            <ErrorState message={scheduleError.message} onRetry={() => refetchSchedule()} />
          ) : schedule?.length === 0 ? (
            <Card className="p-8 text-center border-dashed dark:border-[#262626]">
              <p className="text-neutral-500 dark:text-neutral-400">{t('todaySchedule.empty')}</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {schedule?.map((item) => (
                <Card 
                  key={item.id} 
                  className="p-4 hover:border-primary-300 dark:hover:border-primary-700 transition-all cursor-pointer group"
                  onClick={() => navigate(`/work-orders/${item.id}`)}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="flex-shrink-0 w-20 text-center lg:border-r lg:border-neutral-200 dark:lg:border-[#262626] lg:pr-4">
                      <span className="text-lg font-bold text-neutral-900 dark:text-neutral-50">{item.scheduled_time?.slice(0, 5)}</span>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase font-medium">{tCommon('time.at')}</p>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-neutral-900 dark:text-neutral-50 truncate">{item.customer_name}</h3>
                        <Badge variant={workOrderStatusVariant[item.status]}>
                          {tWorkOrders(`statuses.${item.status}`)}
                        </Badge>
                      </div>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400 truncate mb-2">{item.title}</p>
                      <div className="flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400">
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {item.customer_phone}</span>
                        <span className="flex items-center gap-1 truncate"><MapPin className="w-3 h-3" /> {item.customer_address}</span>
                      </div>
                    </div>

                    <div className="flex-shrink-0 flex items-center gap-2">
                      <Badge variant={priorityVariant[item.priority]}>
                        {tWorkOrders(`priorities.${item.priority}`)}
                      </Badge>
                      <IconButton 
                        icon={<ChevronRight className="w-4 h-4" />} 
                        aria-label={tCommon('actions.viewDetails')}
                        variant="ghost"
                        size="sm"
                        className="group-hover:translate-x-1 transition-transform"
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Pending Tasks & Quick Actions */}
        <div className="space-y-8">
          {/* Quick Actions */}
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">{t('quickActions.title')}</h2>
            <div className="grid grid-cols-1 gap-3">
              <Button 
                variant="outline" 
                className="justify-start h-12" 
                leftIcon={<UserPlus className="w-5 h-5 text-success-600 dark:text-success-400" />}
                onClick={() => navigate('/customers/new')}
              >
                {t('quickActions.addCustomer')}
              </Button>
              <Button 
                variant="outline" 
                className="justify-start h-12" 
                leftIcon={<FilePlus className="w-5 h-5 text-primary-600 dark:text-primary-400" />}
                onClick={() => navigate('/work-orders/new')}
              >
                {t('quickActions.addWorkOrder')}
              </Button>
              <Button 
                variant="outline" 
                className="justify-start h-12" 
                leftIcon={<Plus className="w-5 h-5 text-info-600 dark:text-info-400" />}
                onClick={() => setIsTaskModalOpen(true)}
              >
                {t('quickActions.addTask')}
              </Button>
              <Button 
                variant="outline" 
                className="justify-start h-12" 
                leftIcon={<CalendarCheck className="w-5 h-5 text-primary-600 dark:text-primary-400" />}
                onClick={() => navigate('/daily-work')}
              >
                {t('quickActions.dailyWork') || 'Günlük İşler'}
              </Button>
              <Button 
                variant="outline" 
                className="justify-start h-12" 
                leftIcon={<Search className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />}
                onClick={() => navigate('/work-history')}
              >
                {t('quickActions.workHistory') || 'İş Geçmişi Ara'}
              </Button>
            </div>
          </section>

          {/* Pending Tasks */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-info-600 dark:text-info-400" />
                {t('pendingTasks.title')}
              </h2>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/tasks')}
              >
                {t('pendingTasks.viewAll')}
              </Button>
            </div>

            {isTasksLoading ? (
              <TasksSkeleton />
            ) : tasksError ? (
              <ErrorState message={tasksError.message} onRetry={() => refetchTasks()} />
            ) : tasks?.length === 0 ? (
              <Card className="p-6 text-center border-dashed dark:border-[#262626]">
                <p className="text-neutral-500 dark:text-neutral-400 text-sm">{t('pendingTasks.empty')}</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {tasks?.map((task) => (
                  <Card key={task.id} className="p-3 hover:border-info-200 dark:hover:border-info-800 transition-all group">
                    <div className="flex items-start gap-3">
                      <button 
                        onClick={() => handleToggleTask(task)}
                        className="mt-0.5 text-neutral-300 dark:text-neutral-600 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                      >
                        {task.status === 'completed' ? (
                          <CheckCircle2 className="w-5 h-5 text-success-600 dark:text-success-400" />
                        ) : (
                          <Circle className="w-5 h-5" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <h4 className={cn(
                          "text-sm font-semibold truncate text-neutral-900 dark:text-neutral-50",
                          task.status === 'completed' && "line-through text-neutral-400 dark:text-neutral-500"
                        )}>
                          {task.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={priorityVariant[task.priority]} className="text-[10px] px-1.5 py-0">
                            {tTasks(`priorities.${task.priority}`)}
                          </Badge>
                          {task.due_date && (
                            <span className={cn(
                              "text-[10px] font-medium",
                              task.is_overdue ? "text-error-600 dark:text-error-400" : "text-neutral-500 dark:text-neutral-400"
                            )}>
                              {formatDate(task.due_date)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <TaskModal 
        open={isTaskModalOpen} 
        onClose={() => setIsTaskModalOpen(false)} 
      />
    </PageContainer>
  );
}
