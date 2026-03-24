import { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Repeat, Play } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/layout';
import { Button, EmptyState, ErrorState, Modal } from '../../components/ui';
import { getErrorMessage } from '../../lib/errorHandler';
import { formatCurrency } from '../../lib/utils';
import {
  useRecurringTemplates,
  useTemplateLastGenerated,
  useUpdateRecurringTemplate,
  useDeleteRecurringTemplate,
  useTriggerRecurringGeneration,
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
  const triggerGenerationMutation = useTriggerRecurringGeneration();

  // Modal state
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState(null);
  const [toggleConfirmOpen, setToggleConfirmOpen] = useState(false);
  const [togglingTemplate, setTogglingTemplate] = useState(null);

  const activeTemplates = templates.filter((t) => t.is_active);
  const inactiveTemplates = templates.filter((t) => !t.is_active);

  // ── KPI data ──
  const kpis = useMemo(() => {
    const monthlyTotal = activeTemplates.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const nextDay = activeTemplates.length > 0
      ? Math.min(...activeTemplates.map((t) => t.day_of_month || 31))
      : null;
    return {
      monthlyTotal,
      activeCount: activeTemplates.length,
      pausedCount: inactiveTemplates.length,
      nextDay,
    };
  }, [activeTemplates, inactiveTemplates]);

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

  // ══════════════════════════════════════════════════════════════════════════
  // LOADING STATE
  // ══════════════════════════════════════════════════════════════════════════

  if (isLoading) {
    return (
      <PageContainer maxWidth="full" padding="default" className="space-y-6">
        <PageHeader title={t('recurring:title')} breadcrumbs={breadcrumbs} />

        {/* Mobile loading — md:hidden */}
        <div className="md:hidden space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/10">
                <div className="h-3 w-14 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse mb-2" />
                <div className="h-6 w-16 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
              </div>
            ))}
          </div>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/5">
              <div className="flex justify-between items-start mb-3">
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-32 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
                  <div className="h-3 w-24 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
                </div>
                <div className="h-5 w-16 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
              </div>
              <div className="flex justify-between items-center mt-3">
                <div className="h-3 w-20 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
                <div className="flex gap-1">
                  <div className="w-7 h-7 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
                  <div className="w-7 h-7 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop loading — hidden md:block */}
        <div className="hidden md:flex justify-center py-12">
          <div className="h-8 w-8 rounded-full border-2 border-primary-600 border-t-transparent animate-spin" />
        </div>
      </PageContainer>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ERROR STATE
  // ══════════════════════════════════════════════════════════════════════════

  if (error) {
    return (
      <PageContainer maxWidth="full" padding="default">
        <PageHeader title={t('recurring:title')} breadcrumbs={breadcrumbs} />
        <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
      </PageContainer>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <PageContainer maxWidth="full" padding="default" className="space-y-6">
      <PageHeader
        title={t('recurring:title')}
        breadcrumbs={breadcrumbs}
        actions={
          <div className="flex gap-2">
            {/* Desktop buttons */}
            <Button
              variant="outline"
              onClick={() => triggerGenerationMutation.mutate()}
              loading={triggerGenerationMutation.isPending}
              disabled={activeTemplates.length === 0}
              className="hidden md:inline-flex gap-1.5"
              title={activeTemplates.length === 0 ? t('recurring:generate.noTemplates') : undefined}
            >
              <Play className="w-4 h-4" />
              {t('recurring:generate.button')}
            </Button>
            <Button variant="primary" onClick={handleNewTemplate} className="hidden md:inline-flex gap-1.5">
              <Plus className="w-4 h-4" />
              {t('recurring:templates.addButton')}
            </Button>

            {/* Mobile icon buttons */}
            <button
              type="button"
              onClick={() => triggerGenerationMutation.mutate()}
              disabled={activeTemplates.length === 0 || triggerGenerationMutation.isPending}
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 active:scale-95 transition-transform border border-neutral-200 dark:border-neutral-700 disabled:opacity-40"
              aria-label={t('recurring:generate.button')}
            >
              <Play className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={handleNewTemplate}
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-primary-600 text-white active:scale-95 transition-transform shadow-lg shadow-primary-600/20"
              aria-label={t('recurring:templates.addButton')}
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        }
      />

      {/* ── Mobile KPI Strip — md:hidden ── */}
      <section className="grid grid-cols-2 gap-3 md:hidden">
        <div className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/10">
          <p className="text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-neutral-500 dark:text-neutral-400 mb-1">
            {t('finance:mobile.monthlyTotal')}
          </p>
          <p className="text-red-400 font-bold text-xl tracking-tight tabular-nums">
            {formatCurrency(kpis.monthlyTotal)}
          </p>
        </div>
        <div className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/10">
          <p className="text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-neutral-500 dark:text-neutral-400 mb-1">
            {t('finance:mobile.activeCount')}
          </p>
          <p className="text-neutral-900 dark:text-neutral-50 font-bold text-xl tracking-tight">
            {kpis.activeCount}
          </p>
        </div>
        <div className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/10">
          <p className="text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-neutral-500 dark:text-neutral-400 mb-1">
            {t('finance:mobile.nextDay')}
          </p>
          <p className="text-neutral-900 dark:text-neutral-50 font-bold text-xl tracking-tight">
            {kpis.nextDay ? `${kpis.nextDay}.` : '-'}
          </p>
        </div>
        <div className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/10">
          <p className="text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-neutral-500 dark:text-neutral-400 mb-1">
            {t('finance:mobile.pausedCount')}
          </p>
          <p className="text-neutral-500 dark:text-neutral-400 font-bold text-xl tracking-tight">
            {kpis.pausedCount}
          </p>
        </div>
      </section>

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
            <div className="hidden md:grid md:grid-cols-[3fr_2fr_1.5fr_1fr_1.5fr_1fr] gap-3 px-4 py-2.5 bg-neutral-50 dark:bg-[#111] text-xs font-medium text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-[#262626]">
              <span>{t('recurring:form.fields.name')}</span>
              <span>{t('recurring:form.fields.category')}</span>
              <span className="text-right">{t('recurring:form.fields.amount')}</span>
              <span className="text-center">{t('recurring:form.fields.dayOfMonth')}</span>
              <span className="text-center">{t('recurring:form.fields.hasInvoice')}</span>
              <span />
            </div>

            {/* Mobile: card-style rows with dividers */}
            <div className="md:hidden divide-y divide-neutral-100 dark:divide-[#262626]">
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

            {/* Desktop rows */}
            <div className="hidden md:block">
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
            <div className="hidden md:grid md:grid-cols-[3fr_2fr_1.5fr_1fr_1.5fr_1fr] gap-3 px-4 py-2.5 bg-neutral-50 dark:bg-[#111] text-xs font-medium text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-[#262626]">
              <span>{t('recurring:form.fields.name')}</span>
              <span>{t('recurring:form.fields.category')}</span>
              <span className="text-right">{t('recurring:form.fields.amount')}</span>
              <span className="text-center">{t('recurring:form.fields.dayOfMonth')}</span>
              <span className="text-center">{t('recurring:form.fields.hasInvoice')}</span>
              <span />
            </div>

            {/* Mobile rows */}
            <div className="md:hidden divide-y divide-neutral-100 dark:divide-[#262626]">
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

            {/* Desktop rows */}
            <div className="hidden md:block">
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
