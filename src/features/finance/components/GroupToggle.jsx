import { List, Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const MODES = [
  { key: 'list', Icon: List },
  { key: 'grouped', Icon: Layers },
];

export function GroupToggle({ value, onChange }) {
  const { t } = useTranslation('finance');

  return (
    <div className="flex flex-col gap-1.5">
      <span className="block text-sm font-medium text-neutral-700 dark:text-neutral-200">
        {t('grouped.viewToggle')}
      </span>
      <div className="inline-flex rounded-lg border border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-neutral-900/50 p-0.5">
        {MODES.map(({ key, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`
              flex items-center gap-1.5 rounded-md text-sm px-3 py-2 font-medium transition-colors
              ${value === key
                ? 'bg-primary-600 text-white shadow-sm dark:bg-primary-500'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-700/60'
              }
            `}
          >
            <Icon className="w-4 h-4" />
            {t(`grouped.${key}Label`)}
          </button>
        ))}
      </div>
    </div>
  );
}
