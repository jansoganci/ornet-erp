import { useTranslation } from 'react-i18next';
import { VIEW_MODES } from '../schema';

export function ViewModeToggle({ value, onChange, size = 'md' }) {
  const { t } = useTranslation('finance');

  const sizeClasses = {
    sm: 'text-xs px-2 py-1.5',
    md: 'text-sm px-3 py-2',
    lg: 'text-base px-4 py-2.5',
  };

  return (
    <div className="inline-flex rounded-lg border border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-neutral-900/50 p-0.5">
      {VIEW_MODES.map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={`
            rounded-md font-medium transition-colors
            ${sizeClasses[size]}
            ${value === mode
              ? 'bg-primary-600 text-white shadow-sm dark:bg-primary-500'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-700/60'
            }
          `}
        >
          {t(`filters.viewMode.${mode}`)}
        </button>
      ))}
    </div>
  );
}
