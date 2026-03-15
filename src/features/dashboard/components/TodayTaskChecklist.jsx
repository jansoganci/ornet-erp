import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { differenceInDays, parseISO } from 'date-fns';
import { CheckSquare, Square, AlertTriangle } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { Skeleton } from '../../../components/ui/Skeleton';
import { usePendingTasks } from '../hooks';
import { useUpdateTask } from '../../tasks/hooks';

// ── Skeleton ───────────────────────────────────────────────────────────────

function ChecklistSkeleton() {
  return (
    <div className="divide-y divide-gray-100 dark:divide-white/5">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-start gap-3 px-5 py-3.5">
          <Skeleton className="w-4 h-4 rounded flex-shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

/**
 * TodayTaskChecklist — Card showing pending tasks assigned to current user.
 * Checkbox fires useUpdateTask mutation. Optimistic checked state via local Set.
 * Amber tip row shown for overdue tasks (is_overdue === true).
 * "Tümünü Gör" links to /tasks.
 *
 * Data source: usePendingTasks() → get_my_pending_tasks(limit_count: 5)
 */
export function TodayTaskChecklist() {
  const { t } = useTranslation('dashboard');
  const { data: tasks, isLoading } = usePendingTasks();
  const updateTask = useUpdateTask();

  // Optimistic local state — tracks IDs checked in this session
  const [checkedIds, setCheckedIds] = useState(new Set());

  const taskList = Array.isArray(tasks) ? tasks : [];
  const total = taskList.length + checkedIds.size;
  const completedCount = checkedIds.size;

  function handleCheck(e, taskId) {
    e.preventDefault();
    e.stopPropagation();

    if (checkedIds.has(taskId)) return; // no un-checking from dashboard

    setCheckedIds((prev) => new Set([...prev, taskId]));
    updateTask.mutate({ id: taskId, status: 'completed' });
  }

  function getDaysOverdue(task) {
    if (!task.is_overdue || !task.due_date) return 0;
    return Math.max(1, differenceInDays(new Date(), parseISO(task.due_date)));
  }

  return (
    <div className="rounded-xl border overflow-hidden bg-white border-gray-200 dark:bg-gray-800/40 dark:backdrop-blur-sm dark:border-white/10">
      {/* Card header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-neutral-500 dark:text-neutral-500">
            {t('sections.todayTasks')}
          </h3>
          {/* Counter badge — only shown when there are tasks */}
          {!isLoading && total > 0 && (
            <span className="text-xs font-medium text-neutral-400 dark:text-neutral-500">
              {t('checklist.counter', { completed: completedCount, total })}
            </span>
          )}
        </div>
        <Link
          to="/tasks"
          className="text-xs font-medium text-blue-500 hover:text-blue-400 transition-colors"
        >
          {t('feed.viewAll')}
        </Link>
      </div>

      {/* Body */}
      {isLoading ? (
        <ChecklistSkeleton />
      ) : taskList.length === 0 && checkedIds.size === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-neutral-500 dark:text-neutral-500">
            {t('feed.emptyTasks')}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-white/5">
          {taskList.map((task, index) => {
            const isChecked = checkedIds.has(task.id);
            const daysOverdue = getDaysOverdue(task);

            return (
              <div
                key={task.id}
                className={cn(
                  'feed-row flex items-start gap-3 px-5 py-3.5',
                  'transition-colors',
                  isChecked
                    ? 'opacity-50'
                    : 'hover:bg-gray-50 dark:hover:bg-white/5'
                )}
                style={{ '--row-delay': `${Math.min(index, 5) * 50}ms` }}
              >
                {/* Checkbox */}
                <button
                  type="button"
                  onClick={(e) => handleCheck(e, task.id)}
                  disabled={isChecked}
                  className={cn(
                    'flex-shrink-0 mt-0.5 transition-colors',
                    isChecked
                      ? 'text-green-500 dark:text-green-400 cursor-default'
                      : 'text-neutral-300 dark:text-neutral-600 hover:text-neutral-500 dark:hover:text-neutral-400'
                  )}
                  aria-label={isChecked ? 'Tamamlandı' : 'Tamamla'}
                >
                  {isChecked
                    ? <CheckSquare className="w-4 h-4" />
                    : <Square className="w-4 h-4" />
                  }
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Title */}
                  <p className={cn(
                    'text-sm font-medium text-neutral-900 dark:text-neutral-50 truncate',
                    isChecked && 'line-through text-neutral-400 dark:text-neutral-500'
                  )}>
                    {task.title}
                  </p>

                  {/* Customer / WO context */}
                  {(task.customer_name || task.work_order_title) && !isChecked && (
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 truncate mt-0.5">
                      {[task.customer_name, task.work_order_title].filter(Boolean).join(' · ')}
                    </p>
                  )}

                  {/* Overdue amber tip */}
                  {daysOverdue > 0 && !isChecked && (
                    <div className="flex items-center gap-1 mt-1">
                      <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />
                      <span className="text-[11px] italic text-amber-600 dark:text-amber-400">
                        {t('feed.daysOverdue', { count: daysOverdue })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Checked-off items — ghosted at bottom */}
          {checkedIds.size > 0 && taskList.length === 0 && (
            <div className="px-5 py-3 text-center">
              <p className="text-xs text-neutral-400 dark:text-neutral-500">
                Tüm görevler tamamlandı.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
