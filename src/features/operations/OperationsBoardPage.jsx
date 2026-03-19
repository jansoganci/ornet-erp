import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ClipboardList, Calendar, BarChart3 } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/layout';
import { RequestPoolTab } from './components/RequestPoolTab';
import { CalendarTab } from './components/CalendarTab';
import { InsightsTab } from './components/InsightsTab';

const TABS = [
  { id: 'pool', icon: ClipboardList, labelKey: 'operations:tabs.pool' },
  { id: 'calendar', icon: Calendar, labelKey: 'operations:tabs.calendar' },
  { id: 'insights', icon: BarChart3, labelKey: 'operations:tabs.insights' },
];

export function OperationsBoardPage() {
  const { t } = useTranslation(['operations', 'common']);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'pool';

  const handleTabChange = (tabId) => {
    setSearchParams({ tab: tabId }, { replace: true });
  };

  return (
    <PageContainer maxWidth="full">
      <PageHeader title={t('operations:title')} />

      {/* Tab bar */}
      <div className="mt-4 border-b border-neutral-200 dark:border-neutral-800">
        <nav className="flex gap-1 -mb-px" role="tablist">
          {TABS.map(({ id, icon: Icon, labelKey }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={isActive}
                onClick={() => handleTabChange(id)}
                className={`
                  flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                  ${isActive
                    ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
                    : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-600'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{t(labelKey)}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {activeTab === 'pool' && <RequestPoolTab />}
        {activeTab === 'calendar' && <CalendarTab />}
        {activeTab === 'insights' && <InsightsTab />}
      </div>
    </PageContainer>
  );
}
