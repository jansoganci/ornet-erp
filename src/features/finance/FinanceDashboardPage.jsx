import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/layout';
import { Button } from '../../components/ui';
import { FinanceDashboardFilters } from './components/dashboard/FinanceDashboardFilters';
import { FinanceDashboardTabs } from './components/dashboard/FinanceDashboardTabs';
import { OverviewTab } from './components/dashboard/OverviewTab';
import { WorkTab } from './components/dashboard/WorkTab';
import { SubscriptionsTab } from './components/dashboard/SubscriptionsTab';
import { SimTab } from './components/dashboard/SimTab';

const VALID_TABS = ['overview', 'work', 'subscriptions', 'sim'];

export function FinanceDashboardPage() {
  const { t } = useTranslation(['finance', 'common']);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const now = useMemo(() => new Date(), []);
  const defaultYear = now.getFullYear();
  const defaultMonth = now.getMonth() + 1;

  const year = Number(searchParams.get('year')) || defaultYear;
  const monthParam = searchParams.get('month');
  const month = monthParam ? Number(monthParam) : defaultMonth;
  const viewMode = searchParams.get('viewMode') || 'total';
  const tab = searchParams.get('tab') || 'overview';
  const activeTab = VALID_TABS.includes(tab) ? tab : 'overview';

  const updateParam = (key, value, defaultValue) => {
    setSearchParams((prev) => {
      if (value === defaultValue || value === null || value === undefined || value === '') {
        prev.delete(key);
      } else {
        prev.set(key, String(value));
      }
      return prev;
    });
  };

  const handleYearChange = (v) => updateParam('year', v, defaultYear);
  const handleMonthChange = (v) => updateParam('month', v, defaultMonth);
  const handleViewModeChange = (v) => updateParam('viewMode', v, 'total');
  const handleTabChange = (v) => updateParam('tab', v, 'overview');

  const tabProps = { year, month, viewMode };

  return (
    <PageContainer maxWidth="full" padding="default" className="space-y-6">
      <PageHeader
        title={t('finance:dashboardV2.title')}
        breadcrumbs={[
          { label: t('common:nav.dashboard'), to: '/' },
          { label: t('finance:dashboardV2.title') },
        ]}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              leftIcon={<TrendingUp className="w-4 h-4" />}
              onClick={() => navigate('/finance/income')}
            >
              {t('finance:quickActions.addIncome')}
            </Button>
            <Button
              variant="primary"
              leftIcon={<TrendingDown className="w-4 h-4" />}
              onClick={() => navigate('/finance/expenses')}
            >
              {t('finance:quickActions.addExpense')}
            </Button>
          </div>
        }
      />

      <FinanceDashboardFilters
        year={year}
        month={month}
        viewMode={viewMode}
        onYearChange={handleYearChange}
        onMonthChange={handleMonthChange}
        onViewModeChange={handleViewModeChange}
      />

      <FinanceDashboardTabs activeTab={activeTab} onChange={handleTabChange} />

      {activeTab === 'overview' && <OverviewTab {...tabProps} />}
      {activeTab === 'work' && <WorkTab {...tabProps} />}
      {activeTab === 'subscriptions' && <SubscriptionsTab {...tabProps} />}
      {activeTab === 'sim' && <SimTab {...tabProps} />}
    </PageContainer>
  );
}
