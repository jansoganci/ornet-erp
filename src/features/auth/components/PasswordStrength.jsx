import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';

/**
 * Password strength indicator component.
 * Shows a progress bar and label indicating password strength.
 *
 * Strength algorithm:
 * - Length < 8: weak (0-25%)
 * - Length 8-10 + has numbers: fair (26-50%)
 * - Length 11+ + uppercase + numbers: good (51-75%)
 * - Length 12+ + uppercase + numbers + symbols: strong (76-100%)
 */
export function PasswordStrength({ password = '' }) {
  const { t } = useTranslation('auth');

  const { strength, percentage, label, colorClass } = useMemo(() => {
    if (!password) {
      return { strength: 0, percentage: 0, label: '', colorClass: 'bg-neutral-200' };
    }

    const length = password.length;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    const hasSymbols = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    let score = 0;

    // Length scoring
    if (length >= 8) score += 1;
    if (length >= 10) score += 1;
    if (length >= 12) score += 1;

    // Character variety scoring
    if (hasUppercase) score += 1;
    if (hasLowercase) score += 1;
    if (hasNumbers) score += 1;
    if (hasSymbols) score += 1;

    // Determine strength level
    let strength, percentage, label, colorClass;

    if (length < 8) {
      strength = 0;
      percentage = 25;
      label = t('passwordStrength.weak');
      colorClass = 'bg-error-500';
    } else if (score < 4) {
      strength = 1;
      percentage = 50;
      label = t('passwordStrength.fair');
      colorClass = 'bg-warning-500';
    } else if (score < 6) {
      strength = 2;
      percentage = 75;
      label = t('passwordStrength.good');
      colorClass = 'bg-success-500';
    } else {
      strength = 3;
      percentage = 100;
      label = t('passwordStrength.strong');
      colorClass = 'bg-primary-500';
    }

    return { strength, percentage, label, colorClass };
  }, [password, t]);

  // Don't render if no password
  if (!password) return null;

  return (
    <div className="mt-2">
      {/* Progress bar */}
      <div className="h-1.5 w-full bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
        <div
          className={cn('h-full transition-all duration-300 rounded-full', colorClass)}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Label */}
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          {t('passwordStrength.label')}
        </span>
        <span
          className={cn(
            'text-xs font-medium',
            strength === 0 && 'text-error-600 dark:text-error-400',
            strength === 1 && 'text-warning-600 dark:text-warning-400',
            strength === 2 && 'text-success-600 dark:text-success-400',
            strength === 3 && 'text-primary-600 dark:text-primary-400'
          )}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
