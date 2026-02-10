import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  Target,
  Users,
  Clock,
  Plus,
  ChevronRight,
  UserPlus,
  FilePlus,
  CheckCircle2,
  Circle,
  CalendarCheck,
  Search,
  Cpu as SimIcon
} from 'lucide-react';
import { PageContainer } from '../components/layout';
import { Button, Card, Skeleton, ErrorState } from '../components/ui';
import { formatDate, cn } from '../lib/utils';
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

function TodoListSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(3)].map((_, i) => (
        <Card key={`wo-${i}`} className="p-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-10 flex-shrink-0" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3.5 w-2/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
          </div>
        </Card>
      ))}
      {[...Array(2)].map((_, i) => (
        <Card key={`task-${i}`} className="p-3">
          <div className="flex items-center gap-2">
            <Skeleton className="w-4 h-4 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-2.5 w-16" />
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
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  const { data: stats, isLoading: isStatsLoading, error: statsError, refetch: refetchStats } = useDashboardStats();
  const { data: simStats, isLoading: isSimStatsLoading } = useSimFinancialStats();
  const { data: schedule, isLoading: isScheduleLoading, error: scheduleError, refetch: refetchSchedule } = useTodaySchedule();
  const { data: tasks, isLoading: isTasksLoading, error: tasksError, refetch: refetchTasks } = usePendingTasks();
  const updateTaskMutation = useUpdateTask();

  const handleToggleTask = (e, task) => {
    e.stopPropagation();
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

  const isTodoLoading = isScheduleLoading || isTasksLoading;
  const todoError = scheduleError || tasksError;
  const refetchTodo = () => {
    refetchSchedule();
    refetchTasks();
  };

  const scheduleList = Array.isArray(schedule) ? [...schedule].sort((a, b) => (a.scheduled_time || '').localeCompare(b.scheduled_time || '')) : [];
  const tasksList = Array.isArray(tasks) ? [...tasks].sort((a, b) => (a.due_date || '').localeCompare(b.due_date || '')) : [];
  const hasSchedule = scheduleList.length > 0;
  const hasTasks = tasksList.length > 0;
  const isEmpty = !hasSchedule && !hasTasks;

  return (
    <PageContainer maxWidth="full" padding="compact" className="space-y-5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h1 className="text-base font-medium text-neutral-900 dark:text-neutral-50">
          {t('welcome')}, {userName}
        </h1>
        <span className="text-sm text-neutral-500 dark:text-neutral-400">{formattedToday}</span>
      </div>

      {statsError ? (
        <ErrorState message={statsError.message} onRetry={() => refetchStats()} />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            title={t('stats.todayWorkOrders')}
            value={stats?.today_work_orders ?? 0}
            icon={Clock}
            loading={isStatsLoading}
          />
          <StatCard
            title={t('stats.pendingWorkOrders')}
            value={stats?.pending_work_orders ?? 0}
            icon={ClipboardList}
            loading={isStatsLoading}
          />
          <StatCard
            title={t('stats.openTasks')}
            value={stats?.open_tasks ?? 0}
            icon={Target}
            loading={isStatsLoading}
          />
          <StatCard
            title={t('stats.totalCustomers')}
            value={stats?.total_customers ?? 0}
            icon={Users}
            loading={isStatsLoading}
          />
          <StatCard
            title={tCommon('simCards:stats.active')}
            value={simStats?.active_sim_count ?? 0}
            icon={SimIcon}
            loading={isSimStatsLoading}
            onClick={() => navigate('/sim-cards')}
          />
          <StatCard
            title={tCommon('simCards:stats.monthlyProfit')}
            value={new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(simStats?.total_monthly_profit ?? 0)}
            icon={CheckCircle2}
            loading={isSimStatsLoading}
            onClick={() => navigate('/sim-cards')}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
              {t('todoSection.title')}
            </h2>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => navigate('/work-orders')}
                className="text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-50 transition-colors"
              >
                {t('todoSection.viewWorkOrders')}
              </button>
              <span className="text-neutral-300 dark:text-[#404040]">|</span>
              <button
                type="button"
                onClick={() => navigate('/tasks')}
                className="text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-50 transition-colors"
              >
                {t('todoSection.viewTasks')}
              </button>
            </div>
          </div>

          {isTodoLoading ? (
            <TodoListSkeleton />
          ) : todoError ? (
            <ErrorState message={todoError.message} onRetry={refetchTodo} />
          ) : isEmpty ? (
            <Card className="p-5 text-center border border-dashed border-neutral-200 dark:border-[#262626]">
              <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('todoSection.empty')}</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {scheduleList.map((item) => (
                <Card
                  key={`wo-${item.id}`}
                  className="p-3 hover:border-neutral-300 dark:hover:border-[#404040] transition-colors cursor-pointer group"
                  onClick={() => navigate(`/work-orders/${item.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex-shrink-0 text-sm font-medium text-neutral-900 dark:text-neutral-50 tabular-nums">
                      {item.scheduled_time?.slice(0, 5) ?? '–'}
                    </span>
                    <span className="text-neutral-400 dark:text-neutral-500">·</span>
                    <span className="flex-1 min-w-0 text-sm text-neutral-900 dark:text-neutral-50 truncate">
                      {item.customer_name} · {item.title}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-neutral-400 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
                  </div>
                </Card>
              ))}
              {hasSchedule && hasTasks && (
                <div className="pt-1 pb-0.5">
                  <p className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">
                    {t('todoSection.openTasksLabel')}
                  </p>
                </div>
              )}
              {tasksList.map((task) => (
                <Card
                  key={`task-${task.id}`}
                  className="p-3 hover:border-neutral-300 dark:hover:border-[#404040] transition-colors cursor-pointer group"
                  onClick={() => navigate('/tasks')}
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => handleToggleTask(e, task)}
                      className="flex-shrink-0 text-neutral-300 dark:text-neutral-600 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                    >
                      {task.status === 'completed' ? (
                        <CheckCircle2 className="w-4 h-4 text-success-600 dark:text-success-400" />
                      ) : (
                        <Circle className="w-4 h-4" />
                      )}
                    </button>
                    <span
                      className={cn(
                        'flex-1 min-w-0 text-sm font-medium truncate text-neutral-900 dark:text-neutral-50',
                        task.status === 'completed' && 'line-through text-neutral-400 dark:text-neutral-500'
                      )}
                    >
                      {task.title}
                    </span>
                    <span
                      className={cn(
                        'flex-shrink-0 text-xs tabular-nums',
                        task.is_overdue ? 'text-error-600 dark:text-error-400' : 'text-neutral-500 dark:text-neutral-400'
                      )}
                    >
                      {task.due_date ? formatDate(task.due_date) : ''}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
              {t('quickActions.title')}
            </h2>
            <Button
              variant="primary"
              size="md"
              className="w-full justify-start"
              leftIcon={<FilePlus className="w-4 h-4" />}
              onClick={() => navigate('/work-orders/new')}
            >
              {t('quickActions.addWorkOrder')}
            </Button>
            <div className="space-y-0 border border-neutral-200 dark:border-[#262626] rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => navigate('/customers/new')}
                className="w-full p-3 flex items-center gap-3 text-left text-sm text-neutral-900 dark:text-neutral-50 hover:bg-neutral-50 dark:hover:bg-[#262626] transition-colors border-b border-neutral-200 dark:border-[#262626] last:border-b-0"
              >
                <UserPlus className="w-4 h-4 text-neutral-500 dark:text-neutral-400 flex-shrink-0" />
                {t('quickActions.addCustomer')}
              </button>
              <button
                type="button"
                onClick={() => setIsTaskModalOpen(true)}
                className="w-full p-3 flex items-center gap-3 text-left text-sm text-neutral-900 dark:text-neutral-50 hover:bg-neutral-50 dark:hover:bg-[#262626] transition-colors border-b border-neutral-200 dark:border-[#262626] last:border-b-0"
              >
                <Plus className="w-4 h-4 text-neutral-500 dark:text-neutral-400 flex-shrink-0" />
                {t('quickActions.addTask')}
              </button>
              <button
                type="button"
                onClick={() => navigate('/daily-work')}
                className="w-full p-3 flex items-center gap-3 text-left text-sm text-neutral-900 dark:text-neutral-50 hover:bg-neutral-50 dark:hover:bg-[#262626] transition-colors border-b border-neutral-200 dark:border-[#262626] last:border-b-0"
              >
                <CalendarCheck className="w-4 h-4 text-neutral-500 dark:text-neutral-400 flex-shrink-0" />
                {t('quickActions.dailyWork')}
              </button>
              <button
                type="button"
                onClick={() => navigate('/work-history')}
                className="w-full p-3 flex items-center gap-3 text-left text-sm text-neutral-900 dark:text-neutral-50 hover:bg-neutral-50 dark:hover:bg-[#262626] transition-colors"
              >
                <Search className="w-4 h-4 text-neutral-500 dark:text-neutral-400 flex-shrink-0" />
                {t('quickActions.workHistory')}
              </button>
            </div>
          </section>
        </div>
      </div>

      <TaskModal open={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} />
    </PageContainer>
  );
}
