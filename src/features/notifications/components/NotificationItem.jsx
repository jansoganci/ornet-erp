import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Check } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { localizeNotificationTitle } from '../../../lib/workOrderNotificationTitle';
import { Badge } from '../../../components/ui/Badge';
import { ICON_MAP, DEFAULT_ICON, getRoute } from '../utils';

/**
 * NotificationItem - Single notification row
 *
 * Displays icon, title, body, timestamp.
 * Click → navigates to related entity.
 * Resolve button for stored notifications only.
 *
 * @param {Object} props - Props from v_active_notifications
 */

export function NotificationItem({
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
  onNavigate,
  isResolved = false,
}) {
  const { t } = useTranslation('notifications');
  const { t: tCommon } = useTranslation('common');
  const navigate = useNavigate();

  const displayTitle = localizeNotificationTitle(title, entity_type, (key) =>
    tCommon(`workType.${key}`)
  );

  const config = ICON_MAP[notification_type] ?? DEFAULT_ICON;
  const { Icon, bg, text } = config;

  const timestamp = isResolved ? resolved_at : created_at;
  const relativeTime = timestamp
    ? formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: tr })
    : '';

  const handleClick = () => {
    const route = getRoute(entity_type, entity_id, notification_type);
    if (route) navigate(route);
    onNavigate?.();
  };

  return (
    <div className="border-b border-neutral-100 dark:border-[#262626] last:border-b-0">
      <button
        type="button"
        role="menuitem"
        className="w-full flex items-start gap-3 px-4 py-3 min-h-[44px] hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-600"
        onClick={handleClick}
      >
        <div className="flex-shrink-0 mt-0.5">
          <div className={cn('w-8 h-8 rounded-full flex items-center justify-center', bg, text)}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50 truncate">
              {displayTitle}
            </p>
            <Badge variant="default" size="sm" className="flex-shrink-0 font-normal">
              {t('types.' + notification_type)}
            </Badge>
          </div>
          {body && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
              {body}
            </p>
          )}
          <div className="flex items-center justify-between mt-1">
            <span className="text-[11px] text-neutral-400 dark:text-neutral-500">
              {isResolved ? `${t('resolvedAt')}: ${relativeTime}` : relativeTime}
            </span>
            {notification_source === 'stored' && notification_id && !isResolved && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onResolve?.(notification_id);
                }}
                className="text-[11px] font-medium text-neutral-400 hover:text-success-600 dark:text-neutral-500 dark:hover:text-success-400 transition-colors"
                aria-label={t('actions.resolve')}
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </button>
    </div>
  );
}
