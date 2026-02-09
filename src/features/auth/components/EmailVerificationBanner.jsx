import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, X, Mail, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { resendVerificationEmail } from '../api';
import { getAuthErrorKey } from '../utils/errorMapper';
import { cn } from '../../../lib/utils';

/**
 * Banner displayed when user's email is not verified.
 * Shows warning message and allows resending verification email.
 */
export function EmailVerificationBanner({ email, onDismiss, className }) {
  const { t } = useTranslation('auth');
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error

  const handleResend = async () => {
    if (!email) return;

    setStatus('sending');
    try {
      await resendVerificationEmail(email);
      setStatus('sent');
      toast.success(t('emailVerificationBanner.sent'));
    } catch (error) {
      setStatus('error');
      const errorKey = getAuthErrorKey(error);
      toast.error(t(errorKey));
    }
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 bg-warning-50 dark:bg-warning-950/30 border-b border-warning-200 dark:border-warning-800',
        className
      )}
    >
      {/* Icon */}
      <AlertTriangle className="w-5 h-5 text-warning-600 dark:text-warning-400 flex-shrink-0" />

      {/* Message */}
      <p className="flex-1 text-sm text-warning-800 dark:text-warning-200">
        {t('emailVerificationBanner.message')}
      </p>

      {/* Action button */}
      {status === 'sent' ? (
        <span className="flex items-center gap-1.5 text-sm text-success-600 dark:text-success-400">
          <CheckCircle className="w-4 h-4" />
          {t('emailVerificationBanner.sent')}
        </span>
      ) : (
        <button
          type="button"
          onClick={handleResend}
          disabled={status === 'sending'}
          className={cn(
            'flex items-center gap-1.5 text-sm font-medium text-warning-700 dark:text-warning-300',
            'hover:text-warning-800 dark:hover:text-warning-200',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-colors'
          )}
        >
          <Mail className="w-4 h-4" />
          {status === 'sending'
            ? t('emailVerificationBanner.sending')
            : t('emailVerificationBanner.resend')}
        </button>
      )}

      {/* Dismiss button (optional) */}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="p-1 text-warning-600 dark:text-warning-400 hover:text-warning-800 dark:hover:text-warning-200 transition-colors"
          aria-label="Kapat"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
