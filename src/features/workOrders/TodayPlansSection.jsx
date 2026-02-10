import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Circle, CheckCircle2, Clock, Flag, ListTodo } from 'lucide-react';
import { Card, Badge, Spinner } from '../../components/ui';
import { useTasks, useUpdateTask, taskKeys } from '../tasks/hooks';
import { TaskModal } from '../tasks/TaskModal';
import { cn, priorityVariant } from '../../lib/utils';
import { calendarKeys } from '../calendar/hooks';

export function TodayPlansSection({ selectedDate, selectedWorkerId }) {
  const { t } = useTranslation(['dailyWork', 'tasks']);
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const filters = {
    status: 'all',
    assigned_to: selectedWorkerId || 'all',
  };

  const { data: allTasks = [], isLoading } = useTasks(filters);
  const updateMutation = useUpdateTask();

  // Filter tasks to only those with due_date matching selectedDate
  const todayTasks = allTasks.filter((task) => task.due_date === selectedDate);

  const handleToggleStatus = (e, task) => {
    e.stopPropagation();
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    updateMutation.mutate(
      { id: task.id, status: newStatus },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
          queryClient.invalidateQueries({ queryKey: calendarKeys.all });
        },
      }
    );
  };

  const handleTaskClick = (task) => {
    setEditingTask(task);
  };

  const handleModalClose = () => {
    setEditingTask(null);
  };

  const getPriorityIcon = (priority) => {
    if (priority === 'urgent' || priority === 'high') {
      return <Flag className="w-3 h-3" />;
    }
    return null;
  };

  return (
    <>
      <Card className="shadow-sm border-neutral-200/60 dark:border-neutral-800/60 overflow-hidden">
        {/* Header — collapsible */}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-between px-4 py-3 bg-violet-50/50 dark:bg-violet-900/10 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
        >
          <div className="flex items-center gap-2">
            <ListTodo className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            <span className="text-sm font-bold text-violet-800 dark:text-violet-200 uppercase tracking-wider">
              {t('dailyWork:todayPlans.title')}
            </span>
            {!isLoading && (
              <Badge variant="default" size="sm" className="ml-1">
                {todayTasks.length}
              </Badge>
            )}
          </div>
          {collapsed ? (
            <ChevronRight className="w-4 h-4 text-violet-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-violet-400" />
          )}
        </button>

        {/* Content */}
        {!collapsed && (
          <div className="px-4 py-3">
            {isLoading ? (
              <div className="flex justify-center py-6">
                <Spinner size="sm" />
              </div>
            ) : todayTasks.length === 0 ? (
              <p className="text-sm text-neutral-400 dark:text-neutral-500 text-center py-4">
                {t('dailyWork:todayPlans.empty')}
              </p>
            ) : (
              <ul className="space-y-1">
                {todayTasks.map((task) => (
                  <li key={task.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => handleTaskClick(task)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleTaskClick(task);
                        }
                      }}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors group',
                        'hover:bg-neutral-50 dark:hover:bg-[#1a1a1a]',
                        task.status === 'completed' && 'opacity-60'
                      )}
                    >
                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={(e) => handleToggleStatus(e, task)}
                        className="shrink-0 focus:outline-none"
                        aria-label={
                          task.status === 'completed'
                            ? t('tasks:actions.start')
                            : t('tasks:actions.complete')
                        }
                      >
                        {task.status === 'completed' ? (
                          <CheckCircle2 className="w-5 h-5 text-success-500" />
                        ) : (
                          <Circle className="w-5 h-5 text-neutral-300 dark:text-neutral-600 group-hover:text-violet-400 transition-colors" />
                        )}
                      </button>

                      {/* Task info */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            'text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate',
                            task.status === 'completed' && 'line-through text-neutral-400 dark:text-neutral-500'
                          )}
                        >
                          {task.title}
                        </p>
                        {task.assigned_to_name && (
                          <p className="text-xs text-neutral-400 dark:text-neutral-500 truncate mt-0.5">
                            {task.assigned_to_name}
                          </p>
                        )}
                      </div>

                      {/* Meta: time + priority */}
                      <div className="flex items-center gap-2 shrink-0">
                        {task.due_time && (
                          <span className="flex items-center gap-1 text-xs text-neutral-400 dark:text-neutral-500">
                            <Clock className="w-3 h-3" />
                            {task.due_time.slice(0, 5)}
                          </span>
                        )}
                        {task.priority && task.priority !== 'normal' && (
                          <Badge
                            variant={priorityVariant[task.priority] ?? 'default'}
                            size="sm"
                          >
                            {getPriorityIcon(task.priority)}
                            {t(`tasks:priorities.${task.priority}`)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>

      <TaskModal
        open={!!editingTask}
        onClose={handleModalClose}
        task={editingTask}
      />
    </>
  );
}
