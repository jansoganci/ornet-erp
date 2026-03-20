import { useTranslation } from 'react-i18next';

const TABS = ['overview', 'work', 'subscriptions', 'sim'];

export function FinanceDashboardTabs({ activeTab, onChange }) {
  const { t } = useTranslation('finance');

  return (
    <div className="inline-flex w-full rounded-lg border border-neutral-200 dark:border-[#262626] bg-neutral-50 dark:bg-neutral-900/50 p-0.5">
      {TABS.map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          className={`
            flex-1 min-h-[44px] rounded-md text-sm font-medium transition-colors px-2 py-2.5
            ${activeTab === tab
              ? 'bg-primary-600 text-white shadow-sm dark:bg-primary-500'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-700/60'
            }
          `}
        >
          {t(`dashboardV2.tabs.${tab}`)}
        </button>
      ))}
    </div>
  );
}
