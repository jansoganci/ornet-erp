import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, CheckCircle2, Circle, Clock, User, Edit, Trash2, CheckSquare } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/layout';
import { 
  Button, 
  Select, 
  Badge, 
  Spinner, 
  Card,
  IconButton,
  Modal,
  EmptyState,
  Skeleton,
  ErrorState,
} from '../../components/ui';
import { 
  formatDate, 
  priorityVariant, 
  cn
} from '../../lib/utils';
import { useTasks, useUpdateTask, useDeleteTask, useProfiles } from './hooks';
import { TaskModal } from './TaskModal';

function TasksSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <Card key={i} className="p-4">
          <div className="flex items-start gap-4">
            <Skeleton className="w-6 h-6 rounded-full mt-1" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-full" />
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

export function TasksPage() {
  const { t } = useTranslation('tasks');
  const [statusFilter, setStatusFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskToDelete, setTaskToDelete] = useState(null);

  const { data: tasks, isLoading, error, refetch } = useTasks({ 
    status: statusFilter, 
    assigned_to: assigneeFilter 
  });
  const { data: profiles } = useProfiles();
  const updateMutation = useUpdateTask();
  const deleteMutation = useDeleteTask();

  const handleToggleStatus = (task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    updateMutation.mutate({ id: task.id, status: newStatus });
  };

  const handleEdit = (task) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const handleDelete = () => {
    if (taskToDelete) {
      deleteMutation.mutate(taskToDelete, {
        onSuccess: () => setTaskToDelete(null)
      });
    }
  };

  const openNewTaskModal = () => {
    setSelectedTask(null);
    setIsModalOpen(true);
  };

  const statusOptions = [
    { value: 'all', label: t('list.filters.all') },
    { value: 'pending', label: t('statuses.pending') },
    { value: 'in_progress', label: t('statuses.inProgress') },
    { value: 'completed', label: t('statuses.completed') },
  ];

  const assigneeOptions = [
    { value: 'all', label: t('list.filters.all') },
    ...(profiles?.map(p => ({ value: p.id, label: p.full_name })) || [])
  ];

  return (
    <PageContainer maxWidth="xl" padding="default" className="space-y-6">
      <PageHeader
        title={t('list.title')}
        actions={
          <Button 
            onClick={openNewTaskModal}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            {t('list.addButton')}
          </Button>
        }
      />

      <Card className="p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Select
            label={t('form.fields.status')}
            options={statusOptions}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
          <Select
            label={t('form.fields.assignedTo')}
            options={assigneeOptions}
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
          />
        </div>
      </Card>

      {isLoading ? (
        <TasksSkeleton />
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : (
        <div className="space-y-3">
          {tasks?.length === 0 ? (
            <EmptyState
              icon={CheckSquare}
              title={t('list.empty.title')}
              description={t('list.empty.description') || 'No tasks found. Start by creating one.'}
              actionLabel={t('list.addButton')}
              onAction={openNewTaskModal}
            />
          ) : (
            tasks?.map((task) => (
              <Card 
                key={task.id} 
                className="p-4 hover:border-primary-300 dark:hover:border-primary-700 transition-colors group"
              >
                <div className="flex items-start gap-4">
                  <button 
                    onClick={() => handleToggleStatus(task)}
                    className="mt-1 text-neutral-400 dark:text-neutral-600 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                  >
                    {task.status === 'completed' ? (
                      <CheckCircle2 className="w-6 h-6 text-success-600 dark:text-success-400" />
                    ) : (
                      <Circle className="w-6 h-6" />
                    )}
                  </button>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className={cn(
                        "font-semibold truncate text-neutral-900 dark:text-neutral-50",
                        task.status === 'completed' ? 'line-through text-neutral-400 dark:text-neutral-500' : ''
                      )}>
                        {task.title}
                      </h3>
                      <Badge variant={priorityVariant[task.priority]}>
                        {t(`priorities.${task.priority}`)}
                      </Badge>
                    </div>
                    
                    {task.description && (
                      <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2 mb-2">
                        {task.description}
                      </p>
                    )}
                    
                    <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400">
                      {task.due_date && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatDate(task.due_date)} {task.due_time}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        <span>{task.assigned_to_name || t('form.placeholders.selectAssignee')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <IconButton
                      icon={<Edit className="w-4 h-4" />}
                      onClick={() => handleEdit(task)}
                      aria-label={t('actions.edit')}
                      variant="ghost"
                      size="sm"
                    />
                    <IconButton
                      icon={<Trash2 className="w-4 h-4" />}
                      onClick={() => setTaskToDelete(task.id)}
                      aria-label={t('actions.delete')}
                      variant="ghost"
                      size="sm"
                      className="text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-950/30"
                    />
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      <TaskModal 
        open={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        task={selectedTask} 
      />

      <Modal
        open={!!taskToDelete}
        onClose={() => setTaskToDelete(null)}
        title={t('delete.title')}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setTaskToDelete(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deleteMutation.isPending}>
              {t('actions.delete')}
            </Button>
          </div>
        }
      >
        <p className="text-neutral-700 dark:text-neutral-300">{t('delete.message')}</p>
      </Modal>
    </PageContainer>
  );
}
