import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, User, ExternalLink, Flag } from 'lucide-react';
import { Modal, Button, Badge } from '../../../components/ui';
import { formatDate, taskStatusVariant, priorityVariant } from '../../../lib/utils';

export function PlanDetailModal({ open, onClose, event }) {
  const { t } = useTranslation('calendar');
  const tTasks = useTranslation('tasks').t;
  const navigate = useNavigate();

  const task = event?.resource;
  if (!task) return null;

  const handleOpenFull = () => {
    onClose();
    navigate('/tasks');
  };

  const statusKey = task.status === 'in_progress' ? 'inProgress' : task.status;
  const priorityKey = task.priority || 'normal';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('planDetail.title')}
      size="sm"
      footer={
        <Button
          onClick={handleOpenFull}
          leftIcon={<ExternalLink className="w-4 h-4" />}
          className="w-full"
        >
          {t('planDetail.openFull')}
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Title */}
        <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
          {task.title}
        </h3>

        {/* Status + Priority badges */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={taskStatusVariant[task.status] ?? 'default'} dot>
            {tTasks(`statuses.${statusKey}`)}
          </Badge>
          <Badge
            variant={priorityVariant[priorityKey] ?? 'default'}
            size="sm"
          >
            <Flag className="w-3 h-3 mr-1 inline" />
            {tTasks(`priorities.${priorityKey}`)}
          </Badge>
        </div>

        {/* Date & Time */}
        <div className="flex items-center gap-4">
          {task.due_date && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-neutral-400" />
              <span className="text-neutral-700 dark:text-neutral-300">
                {formatDate(task.due_date)}
              </span>
            </div>
          )}
          {task.due_time && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-neutral-400" />
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                {task.due_time.slice(0, 5)}
              </span>
            </div>
          )}
        </div>

        {/* Assigned to */}
        {task.assigned_to_name && (
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-neutral-400 shrink-0" />
            <span className="inline-flex items-center gap-1.5 text-sm bg-neutral-100 dark:bg-[#262626] text-neutral-700 dark:text-neutral-300 px-2 py-0.5 rounded-full">
              <span className="w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center text-[10px] font-bold text-violet-700 dark:text-violet-300 uppercase shrink-0">
                {task.assigned_to_name.charAt(0) || '?'}
              </span>
              {task.assigned_to_name}
            </span>
          </div>
        )}

        {/* Description */}
        {task.description && (
          <div>
            <p className="text-xs font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1">
              {tTasks('form.fields.description')}
            </p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-3 leading-relaxed">
              {task.description}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
