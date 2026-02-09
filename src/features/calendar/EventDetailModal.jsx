import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Building2, MapPin, Calendar, Clock, User, ExternalLink } from 'lucide-react';
import { Modal, Button, Badge } from '../../components/ui';
import { formatDate, workOrderStatusVariant } from '../../lib/utils';

export function EventDetailModal({ open, onClose, event }) {
  const { t } = useTranslation('calendar');
  const tCommon = useTranslation('common').t;
  const tWorkOrders = useTranslation('workOrders').t;
  const navigate = useNavigate();

  const wo = event?.resource;
  if (!wo) return null;

  const handleOpenFull = () => {
    onClose();
    if (wo.id) navigate(`/work-orders/${wo.id}`);
  };

  const statusKey = wo.status === 'in_progress' ? 'inProgress' : wo.status;
  const workers = Array.isArray(wo.assigned_workers) ? wo.assigned_workers : [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('detail.title')}
      size="sm"
      footer={
        <Button
          onClick={handleOpenFull}
          leftIcon={<ExternalLink className="w-4 h-4" />}
          className="w-full"
        >
          {t('detail.openFull')}
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Status + Work Type badges */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={workOrderStatusVariant[wo.status] ?? 'default'} dot>
            {tWorkOrders(`statuses.${statusKey}`)}
          </Badge>
          <Badge variant="info">
            {tCommon(`workType.${wo.work_type}`)}
          </Badge>
          {wo.priority && wo.priority !== 'normal' && (
            <Badge
              variant={wo.priority === 'urgent' ? 'error' : wo.priority === 'high' ? 'warning' : 'default'}
              size="sm"
            >
              {tWorkOrders(`priorities.${wo.priority}`)}
            </Badge>
          )}
        </div>

        {/* Customer & Site */}
        <div className="rounded-lg border border-neutral-100 dark:border-[#262626] bg-neutral-50/50 dark:bg-[#1a1a1a] p-3 space-y-2">
          <div className="flex items-start gap-2">
            <Building2 className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                {wo.company_name || '—'}
              </p>
              {wo.site_name && (
                <p className="text-sm text-neutral-500 dark:text-neutral-400 truncate">
                  {wo.site_name}
                </p>
              )}
            </div>
            {wo.account_no && (
              <Badge variant="default" size="sm" className="ml-auto shrink-0 font-mono">
                {wo.account_no}
              </Badge>
            )}
          </div>
          {(wo.site_address || wo.district || wo.city) && (
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
              <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-snug">
                {[wo.site_address, wo.district, wo.city].filter(Boolean).join(', ')}
              </p>
            </div>
          )}
        </div>

        {/* Date & Time */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-neutral-400" />
            <span className="text-neutral-700 dark:text-neutral-300">
              {wo.scheduled_date ? formatDate(wo.scheduled_date) : '—'}
            </span>
          </div>
          {wo.scheduled_time && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-neutral-400" />
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                {wo.scheduled_time.slice(0, 5)}
              </span>
            </div>
          )}
        </div>

        {/* Assigned Workers */}
        {workers.length > 0 && (
          <div className="flex items-start gap-2">
            <User className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
            <div className="flex flex-wrap gap-1.5">
              {workers.map((w) => (
                <span
                  key={w.id}
                  className="inline-flex items-center gap-1.5 text-sm bg-neutral-100 dark:bg-[#262626] text-neutral-700 dark:text-neutral-300 px-2 py-0.5 rounded-full"
                >
                  <span className="w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-[10px] font-bold text-primary-700 dark:text-primary-300 uppercase shrink-0">
                    {w.name?.charAt(0) || '?'}
                  </span>
                  {w.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Description (truncated) */}
        {wo.description && (
          <div>
            <p className="text-xs font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1">
              {tWorkOrders('form.fields.description')}
            </p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-3 leading-relaxed">
              {wo.description}
            </p>
          </div>
        )}

        {/* Form No */}
        {wo.form_no && (
          <div className="flex items-center justify-between text-sm text-neutral-400 dark:text-neutral-500 pt-1 border-t border-neutral-100 dark:border-[#262626]">
            <span>{tWorkOrders('form.fields.formNo')}</span>
            <span className="font-mono font-medium text-neutral-600 dark:text-neutral-400">#{wo.form_no}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
