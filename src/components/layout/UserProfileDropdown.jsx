import { useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { User, LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useCurrentProfile } from '../../features/subscriptions/hooks';
import { cn } from '../../lib/utils';

/**
 * UserProfileDropdown - User menu in topbar
 * Shows user name/email, profile link, logout.
 */
export function UserProfileDropdown({ isOpen, onClose, triggerRef }) {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { data: profile } = useCurrentProfile();
  const dropdownRef = useRef(null);

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || t('nav.account');
  const email = user?.email || '';

  const handleLogout = useCallback(async () => {
    onClose();
    await signOut();
    navigate('/login');
  }, [signOut, navigate, onClose]);

  const handleEscape = useCallback(
    (e) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, handleEscape]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      const inTrigger = triggerRef?.current?.contains(e.target);
      const inDropdown = dropdownRef.current?.contains(e.target);
      if (!inTrigger && !inDropdown) onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, triggerRef]);

  if (!user) return null;

  return (
    <div
      ref={dropdownRef}
      id="user-profile-dropdown"
      role="menu"
      aria-label={t('nav.account')}
      className={cn(
        'absolute right-0 top-full mt-1.5 w-56 rounded-xl border border-neutral-200 dark:border-[#262626] bg-white dark:bg-[#171717] shadow-lg py-1 z-50',
        !isOpen && 'hidden'
      )}
    >
      <div className="px-4 py-3 border-b border-neutral-100 dark:border-[#262626]">
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50 truncate">
          {displayName}
        </p>
        {email && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
            {email}
          </p>
        )}
      </div>
      <div className="py-1">
        <Link
          to="/profile"
          onClick={onClose}
          className="flex items-center gap-2 px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
          role="menuitem"
        >
          <User className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
          {t('nav.profile')}
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2 px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors text-left"
          role="menuitem"
        >
          <LogOut className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
          {t('nav.logout')}
        </button>
      </div>
    </div>
  );
}
