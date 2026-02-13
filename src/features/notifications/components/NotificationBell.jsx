import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';
import { useCurrentProfile } from '../../subscriptions/hooks';
import { useNotificationBadge, useNotificationRealtime } from '../hooks';
import { IconButton } from '../../../components/ui';
import { NotificationDropdown } from './NotificationDropdown';

/**
 * NotificationBell - Displays notification badge and triggers dropdown
 *
 * Shows real-time notification count with badge.
 * Opens NotificationDropdown on click.
 * Badge updates via Realtime + 60s polling.
 */
export function NotificationBell() {
  const { t } = useTranslation('notifications');
  const { data: currentProfile } = useCurrentProfile();
  const hasNotificationAccess =
    currentProfile?.role === 'admin' || currentProfile?.role === 'accountant';

  const [isOpen, setIsOpen] = useState(false);
  const bellRef = useRef(null);
  const { data: badge } = useNotificationBadge();
  useNotificationRealtime();

  const total = badge?.total ?? 0;
  const badgeLabel = total > 0 ? t('bell.labelWithCount', { count: total }) : t('bell.label');

  const handleClose = () => {
    setIsOpen(false);
    bellRef.current?.focus();
  };

  if (!hasNotificationAccess) return null;

  return (
    <div className="relative">
      <IconButton
        ref={bellRef}
        icon={<Bell className="w-5 h-5" />}
        variant="ghost"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={badgeLabel}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-controls="notification-dropdown"
      />
      {total > 0 && (
        <span
          className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-error-600 text-white text-[11px] font-semibold"
          aria-hidden
        >
          {total > 99 ? '99+' : total}
        </span>
      )}
      {isOpen && (
        <NotificationDropdown
          isOpen={isOpen}
          onClose={handleClose}
          total={total}
        />
      )}
    </div>
  );
}
