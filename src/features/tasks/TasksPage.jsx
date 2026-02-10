import { useState, useMemo, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  AlertCircle,
  Calendar,
  CalendarDays,
  CalendarRange,
  HelpCircle,
  CheckCircle2,
  Target,
} from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/layout';
import {
  Button,
  Select,
  Card,
  Modal,
  EmptyState,
  Skeleton,
  ErrorState,
} from '../../components/ui';
import { useTasks, useUpdateTask, useDeleteTask, useProfiles } from './hooks';
import { groupPlansByHorizon } from './utils';
import { TaskModal } from './TaskModal';
import { QuickPlanInput } from './components/QuickPlanInput';
import { PlanGroupSection } from './components/PlanGroupSection';
import { MiniCalendarSidebar } from './components/MiniCalendarSidebar';

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

const SECTION_CONFIG = [
  { key: 'overdue', icon: AlertCircle, variant: 'error', defaultOpen: true },
  { key: 'thisWeek', icon: Calendar, variant: 'warning', defaultOpen: true },
  { key: 'thisMonth', icon: CalendarDays, variant: 'info', defaultOpen: true },
  { key: 'upcoming', icon: CalendarRange, variant: 'default', defaultOpen: true },
  { key: 'noDueDate', icon: HelpCircle, variant: 'default', defaultOpen: true },
  { key: 'completed', icon: CheckCircle2, variant: 'success', defaultOpen: false },
];

export function TasksPage() {
  const { t } = useTranslation('tasks');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [highlightDate, setHighlightDate] = useState(null);

  // Refs for each section to allow scrolling
  const sectionRefs = useRef({});

  const { data: tasks, isLoading, error, refetch } = useTasks({
    status: 'all',
    assigned_to: assigneeFilter,
  });
  const { data: profiles } = useProfiles();
  const updateMutation = useUpdateTask();
  const deleteMutation = useDeleteTask();

  const groups = useMemo(() => groupPlansByHorizon(tasks), [tasks]);

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
        onSuccess: () => setTaskToDelete(null),
      });
    }
  };

  const openNewTaskModal = () => {
    setSelectedTask(null);
    setIsModalOpen(true);
  };

  const assigneeOptions = [
    { value: 'all', label: t('list.filters.all') },
    ...(profiles?.map((p) => ({ value: p.id, label: p.full_name })) || []),
  ];

  // Find which section a selected date belongs to, then scroll to it
  const handleSelectDate = useCallback(
    (isoDate) => {
      setHighlightDate(isoDate);

      // Find which section contains tasks with this date
      for (const { key } of SECTION_CONFIG) {
        const sectionTasks = groups[key] || [];
        const found = sectionTasks.some((task) => task.due_date === isoDate);
        if (found && sectionRefs.current[key]) {
          sectionRefs.current[key].scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
          return;
        }
      }
    },
    [groups]
  );

  const setSectionRef = useCallback((key, el) => {
    sectionRefs.current[key] = el;
  }, []);

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

      {/* Quick-add bar */}
      <QuickPlanInput />

      {/* Assignee filter */}
      {profiles?.length > 1 && (
        <div className="max-w-xs">
          <Select
            label={t('form.fields.assignedTo')}
            options={assigneeOptions}
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
          />
        </div>
      )}

      {/* Content: 2-column layout on desktop, single on mobile */}
      {isLoading ? (
        <TasksSkeleton />
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : !tasks?.length ? (
        <EmptyState
          icon={Target}
          title={t('list.empty.title')}
          description={t('list.empty.description')}
          actionLabel={t('list.addButton')}
          onAction={openNewTaskModal}
        />
      ) : (
        <div className="flex gap-6 items-start">
          {/* Main task list */}
          <div className="flex-1 min-w-0 space-y-4">
            {SECTION_CONFIG.map(({ key, icon, variant, defaultOpen }) => (
              <div key={key} ref={(el) => setSectionRef(key, el)}>
                <PlanGroupSection
                  title={t(`list.sections.${key}`)}
                  icon={icon}
                  count={groups[key]?.length || 0}
                  variant={variant}
                  tasks={groups[key] || []}
                  defaultOpen={defaultOpen}
                  onToggleStatus={handleToggleStatus}
                  onEdit={handleEdit}
                  onDelete={(id) => setTaskToDelete(id)}
                  highlightDate={highlightDate}
                />
              </div>
            ))}
          </div>

          {/* Mini calendar sidebar — desktop only */}
          <div className="hidden lg:block w-64 shrink-0 sticky top-24">
            <MiniCalendarSidebar
              tasks={tasks}
              onSelectDate={handleSelectDate}
              selectedDate={highlightDate}
            />
          </div>
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
            <Button
              variant="danger"
              onClick={handleDelete}
              loading={deleteMutation.isPending}
            >
              {t('actions.delete')}
            </Button>
          </div>
        }
      >
        <p className="text-neutral-700 dark:text-neutral-300">
          {t('delete.message')}
        </p>
      </Modal>
    </PageContainer>
  );
}
