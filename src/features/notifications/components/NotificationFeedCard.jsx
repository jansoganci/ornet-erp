import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { toast } from 'sonner';
import { useCompleteReminder } from '../hooks';
import { CheckCircle2, CheckCheck } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { localizeNotificationTitle } from '../../../lib/workOrderNotificationTitle';
import { Card } from '../../../components/ui/Card';
import { ICON_MAP, DEFAULT_ICON, getRoute } from '../utils';

export function NotificationFeedCard({
  notification_type,
  title,
  body,
  entity_type,
  entity_id,
  created_at,
  resolved_at,
  notification_id,
  notification_source,
  onResolve,
  isResolved = false,
}) {
  const { t } = useTranslation('notifications');
  const { t: tCommon } = useTranslation('common');
  const navigate = useNavigate();
  const completeReminderMutation = useCompleteReminder();

  const displayTitle = localizeNotificationTitle(title, entity_type, (key) =>
    tCommon(`workType.${key}`)
  );

  const isUnread = !isResolved && notification_source === 'stored' && !resolved_at;
  const config = ICON_MAP[notification_type] ?? DEFAULT_ICON;
  const { Icon, bg, text } = config;

  const timestamp = isResolved ? resolved_at : created_at;
  const relativeTime = timestamp
    ? formatDistanceToNow(new Date(timestamp), { addSuffix: false, locale: tr })
    : '';

  const route = getRoute(entity_type, entity_id, notification_type);

  const handleClick = () => {
    if (route) navigate(route);
  };

  const handleResolve = (e) => {
    e.stopPropagation();
    if (notification_source === 'stored' && notification_id) {
      onResolve?.(notification_id);
    }
  };

  const handleComplete = (e) => {
    e.stopPropagation();
    completeReminderMutation.mutate(entity_id, {
      onSuccess: () => toast.success(t('reminder.completed')),
    });
  };

  return (
    <Card
      onClick={handleClick}
      padding="compact"
      className={cn(
        'group relative transition-all',
        isUnread
          ? 'shadow-md dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)]'
          : 'bg-neutral-50 dark:bg-neutral-900 opacity-80 hover:opacity-100'
      )}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="relative flex-shrink-0">
          <div className={cn('h-11 w-11 rounded-full flex items-center justify-center', bg, text)}>
            <Icon className="w-5 h-5" />
          </div>
          {/* Pulse indicator for unread */}
          {isUnread && (
            <div className="absolute -top-0.5 -right-0.5 h-3 w-3 bg-primary-500 rounded-full ring-2 ring-white dark:ring-[#171717] animate-pulse" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-1 gap-2">
            <h3 className={cn('text-sm truncate', isUnread ? 'font-bold text-neutral-900 dark:text-neutral-50' : 'font-medium text-neutral-700 dark:text-neutral-300')}>
              {displayTitle}
            </h3>
            <span className={cn(
              'text-[10px] font-medium whitespace-nowrap flex-shrink-0 uppercase tracking-wide',
              isUnread
                ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 px-2 py-0.5 rounded'
                : 'text-neutral-400 dark:text-neutral-500'
            )}>
              {relativeTime}
            </span>
          </div>

          {body && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed line-clamp-2 mb-2.5">
              {body}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            {route && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); navigate(route); }}
                className="text-[10px] font-bold text-primary-500 hover:underline uppercase tracking-wide"
              >
                {t('actions.viewLogs')}
              </button>
            )}
            {!isResolved && notification_source === 'stored' && notification_id && (
              <>
                {route && <span className="text-neutral-300 dark:text-neutral-600">&middot;</span>}
                <button
                  type="button"
                  onClick={handleResolve}
                  className="text-[10px] font-bold text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 uppercase tracking-wide"
                >
                  {t('actions.dismiss')}
                </button>
              </>
            )}
            {notification_type === 'user_reminder' && !isResolved && (
              <>
                {route && <span className="text-neutral-300 dark:text-neutral-600">&middot;</span>}
                <button
                  type="button"
                  onClick={handleComplete}
                  disabled={completeReminderMutation.isPending}
                  className="flex items-center gap-1 text-[10px] font-bold text-neutral-400 hover:text-success-600 dark:hover:text-success-400 uppercase tracking-wide transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  {t('actions.completeReminder')}
                </button>
              </>
            )}
            {isResolved && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">
                <CheckCircle2 className="w-3.5 h-3.5 text-success-500 dark:text-success-400" />
                {t('resolved.completedAt', { time: relativeTime })}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
