import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, ChevronDown, CheckCircle2, Circle, Clock, User, Edit, Trash2 } from 'lucide-react';
import { Badge, Card, IconButton } from '../../../components/ui';
import { formatDate, priorityVariant, cn } from '../../../lib/utils';

export function PlanGroupSection({
  title,
  icon: Icon,
  count,
  variant = 'default',
  tasks = [],
  defaultOpen = true,
  onToggleStatus,
  onEdit,
  onDelete,
  highlightDate = null,
}) {
  const { t } = useTranslation('tasks');
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (tasks.length === 0) return null;

  return (
    <div>
      {/* Section header */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-2 w-full py-2 px-1 group text-left"
      >
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-neutral-400 dark:text-neutral-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-neutral-400 dark:text-neutral-500" />
        )}
        <Icon className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
        <span className="font-semibold text-sm text-neutral-700 dark:text-neutral-200">
          {title}
        </span>
        <Badge variant={variant} size="sm">
          {count}
        </Badge>
      </button>

      {/* Plan cards */}
      {isOpen && (
        <div className="space-y-2 ml-6">
          {tasks.map((task) => (
            <Card
              key={task.id}
              className={cn(
                'p-3 sm:p-4 hover:border-primary-300 dark:hover:border-primary-700 transition-colors group/card',
                highlightDate && task.due_date === highlightDate &&
                  'ring-2 ring-primary-400 dark:ring-primary-500 border-primary-300 dark:border-primary-600'
              )}
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={() => onToggleStatus(task)}
                  className="mt-0.5 text-neutral-400 dark:text-neutral-600 hover:text-primary-600 dark:hover:text-primary-400 transition-colors flex-shrink-0"
                >
                  {task.status === 'completed' ? (
                    <CheckCircle2 className="w-5 h-5 text-success-600 dark:text-success-400" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3
                      className={cn(
                        'font-medium text-sm truncate text-neutral-900 dark:text-neutral-50',
                        task.status === 'completed' &&
                          'line-through text-neutral-400 dark:text-neutral-500'
                      )}
                    >
                      {task.title}
                    </h3>
                    <Badge variant={priorityVariant[task.priority]} size="sm">
                      {t(`priorities.${task.priority}`)}
                    </Badge>
                  </div>

                  {task.description && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1 mb-1">
                      {task.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-400 dark:text-neutral-500">
                    {task.due_date && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(task.due_date)}
                        {task.due_time && ` ${task.due_time}`}
                      </span>
                    )}
                    {task.assigned_to_name && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {task.assigned_to_name}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity flex-shrink-0">
                  <IconButton
                    icon={<Edit className="w-3.5 h-3.5" />}
                    onClick={() => onEdit(task)}
                    aria-label={t('actions.edit')}
                    variant="ghost"
                    size="sm"
                  />
                  <IconButton
                    icon={<Trash2 className="w-3.5 h-3.5" />}
                    onClick={() => onDelete(task.id)}
                    aria-label={t('actions.delete')}
                    variant="ghost"
                    size="sm"
                    className="text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-950/30"
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
