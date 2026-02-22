import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Repeat } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/layout';
import { Button, Spinner, EmptyState, ErrorState, Modal, TableSkeleton } from '../../components/ui';
import {
  useRecurringTemplates,
  useTemplateLastGenerated,
  useUpdateRecurringTemplate,
  useDeleteRecurringTemplate,
} from './recurringHooks';
import { RecurringTemplateRow } from './recurring/RecurringTemplateRow';
import { RecurringTemplateFormModal } from './recurring/RecurringTemplateFormModal';

export function RecurringExpensesPage() {
  const { t } = useTranslation(['recurring', 'common', 'finance']);
  const location = useLocation();
  const navigate = useNavigate();
  const templateRowRefs = useRef({});

  // Data
  const { data: templates = [], isLoading, error, refetch } = useRecurringTemplates();
  const { data: lastGeneratedMap = {} } = useTemplateLastGenerated();

  // Mutations
  const updateTemplateMutation = useUpdateRecurringTemplate();
  const deleteTemplateMutation = useDeleteRecurringTemplate();

  // Modal state
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState(null);
  const [toggleConfirmOpen, setToggleConfirmOpen] = useState(false);
  const [togglingTemplate, setTogglingTemplate] = useState(null);

  const activeTemplates = templates.filter((t) => t.is_active);
  const inactiveTemplates = templates.filter((t) => !t.is_active);

  const highlightTemplateId = location.state?.highlightTemplateId;

  useEffect(() => {
    if (!highlightTemplateId || isLoading || activeTemplates.length + inactiveTemplates.length === 0) return;
    const el = templateRowRefs.current[highlightTemplateId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-primary-500', 'ring-offset-2', 'dark:ring-offset-0');
      const t = setTimeout(() => {
        el.classList.remove('ring-2', 'ring-primary-500', 'ring-offset-2', 'dark:ring-offset-0');
        navigate('/finance/recurring', { replace: true, state: {} });
      }, 2500);
      return () => clearTimeout(t);
    }
    navigate('/finance/recurring', { replace: true, state: {} });
  }, [highlightTemplateId, isLoading, activeTemplates.length, inactiveTemplates.length, navigate]);

  // Handlers
  const handleEditTemplate = (template) => {
    setEditingTemplate(template);
    setTemplateModalOpen(true);
  };

  const handleNewTemplate = () => {
    setEditingTemplate(null);
    setTemplateModalOpen(true);
  };

  const handleToggleActive = (template) => {
    if (template.is_active) {
      setTogglingTemplate(template);
      setToggleConfirmOpen(true);
    } else {
      updateTemplateMutation.mutate({
        id: template.id,
        data: { is_active: true },
      });
    }
  };

  const confirmPauseTemplate = async () => {
    if (togglingTemplate) {
      await updateTemplateMutation.mutateAsync({
        id: togglingTemplate.id,
        data: { is_active: false },
      });
    }
    setToggleConfirmOpen(false);
    setTogglingTemplate(null);
  };

  const handleDeleteTemplate = (template) => {
    setDeletingTemplate(template);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteTemplate = async () => {
    if (deletingTemplate) {
      await deleteTemplateMutation.mutateAsync(deletingTemplate.id);
    }
    setDeleteConfirmOpen(false);
    setDeletingTemplate(null);
  };

  const breadcrumbs = [
    { label: t('common:nav.dashboard'), to: '/' },
    { label: t('finance:dashboard.title'), to: '/finance' },
    { label: t('recurring:title') },
  ];

  if (isLoading) {
    return (
      <PageContainer maxWidth="xl" padding="default">
        <PageHeader title={t('recurring:title')} breadcrumbs={breadcrumbs} />
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer maxWidth="xl" padding="default">
        <PageHeader title={t('recurring:title')} breadcrumbs={breadcrumbs} />
        <ErrorState message={error.message} onRetry={refetch} />
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="xl" padding="default" className="space-y-6">
      <PageHeader
        title={t('recurring:title')}
        breadcrumbs={breadcrumbs}
        actions={
          <Button variant="primary" onClick={handleNewTemplate} className="gap-1.5">
            <Plus className="w-4 h-4" />
            {t('recurring:templates.addButton')}
          </Button>
        }
      />

      {/* Active Templates */}
      <div className="mb-8">
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-50 mb-4">
          {t('recurring:templates.titleWithCount', { count: activeTemplates.length })}
        </h2>

        {activeTemplates.length === 0 ? (
          <EmptyState
            icon={Repeat}
            title={t('recurring:templates.empty.title')}
            description={t('recurring:templates.empty.description')}
            actionLabel={t('recurring:templates.addButton')}
            onAction={handleNewTemplate}
          />
        ) : (
          <div className="rounded-xl border border-neutral-200 dark:border-[#262626] overflow-hidden bg-white dark:bg-[#171717]">
            {/* Table header — hidden on mobile */}
            <div className="hidden sm:grid sm:grid-cols-[3fr_2fr_1.5fr_1fr_1.5fr_1fr] gap-3 px-4 py-2.5 bg-neutral-50 dark:bg-[#111] text-xs font-medium text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-[#262626]">
              <span>{t('recurring:form.fields.name')}</span>
              <span>{t('recurring:form.fields.category')}</span>
              <span className="text-right">{t('recurring:form.fields.amount')}</span>
              <span className="text-center">{t('recurring:form.fields.dayOfMonth')}</span>
              <span className="text-center">{t('recurring:form.fields.hasInvoice')}</span>
              <span />
            </div>
            {activeTemplates.map((tpl) => (
              <div
                key={tpl.id}
                ref={(el) => {
                  if (el) templateRowRefs.current[tpl.id] = el;
                }}
              >
                <RecurringTemplateRow
                  template={tpl}
                  lastGenerated={lastGeneratedMap[tpl.id]}
                  onEdit={handleEditTemplate}
                  onToggleActive={handleToggleActive}
                  onDelete={handleDeleteTemplate}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inactive Templates */}
      {inactiveTemplates.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-neutral-500 dark:text-neutral-400 mb-4">
            {t('recurring:templates.inactive')} ({inactiveTemplates.length})
          </h2>
          <div className="rounded-xl border border-neutral-200 dark:border-[#262626] overflow-hidden bg-white dark:bg-[#171717] opacity-60">
            <div className="hidden sm:grid sm:grid-cols-[3fr_2fr_1.5fr_1fr_1.5fr_1fr] gap-3 px-4 py-2.5 bg-neutral-50 dark:bg-[#111] text-xs font-medium text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-[#262626]">
              <span>{t('recurring:form.fields.name')}</span>
              <span>{t('recurring:form.fields.category')}</span>
              <span className="text-right">{t('recurring:form.fields.amount')}</span>
              <span className="text-center">{t('recurring:form.fields.dayOfMonth')}</span>
              <span className="text-center">{t('recurring:form.fields.hasInvoice')}</span>
              <span />
            </div>
            {inactiveTemplates.map((tpl) => (
              <div
                key={tpl.id}
                ref={(el) => {
                  if (el) templateRowRefs.current[tpl.id] = el;
                }}
              >
                <RecurringTemplateRow
                  template={tpl}
                  lastGenerated={lastGeneratedMap[tpl.id]}
                  onEdit={handleEditTemplate}
                  onToggleActive={handleToggleActive}
                  onDelete={handleDeleteTemplate}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Template Form Modal */}
      <RecurringTemplateFormModal
        open={templateModalOpen}
        onClose={() => {
          setTemplateModalOpen(false);
          setEditingTemplate(null);
        }}
        template={editingTemplate}
      />

      {/* Delete Confirm Modal */}
      <Modal
        open={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setDeletingTemplate(null);
        }}
        title={t('common:confirm.title')}
        size="sm"
        footer={
          <div className="flex flex-col-reverse sm:flex-row gap-3 w-full sm:w-auto">
            <Button variant="ghost" onClick={() => setDeleteConfirmOpen(false)} className="flex-1 sm:flex-none">
              {t('common:actions.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={confirmDeleteTemplate}
              loading={deleteTemplateMutation.isPending}
              className="flex-1 sm:flex-none"
            >
              {t('common:actions.delete')}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {deletingTemplate?.name} {t('common:deleteConfirm')}
        </p>
      </Modal>

      {/* Pause Confirm Modal */}
      <Modal
        open={toggleConfirmOpen}
        onClose={() => {
          setToggleConfirmOpen(false);
          setTogglingTemplate(null);
        }}
        title={t('recurring:confirm.pauseTitle')}
        size="sm"
        footer={
          <div className="flex flex-col-reverse sm:flex-row gap-3 w-full sm:w-auto">
            <Button variant="ghost" onClick={() => setToggleConfirmOpen(false)} className="flex-1 sm:flex-none">
              {t('common:actions.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={confirmPauseTemplate}
              loading={updateTemplateMutation.isPending}
              className="flex-1 sm:flex-none"
            >
              {t('common:actions.confirm')}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {togglingTemplate?.name && (
            <>
              <span className="font-medium text-neutral-900 dark:text-neutral-50">{togglingTemplate.name}</span>
              {' — '}
            </>
          )}
          {t('recurring:confirm.pauseMessage')}
        </p>
      </Modal>
    </PageContainer>
  );
}
