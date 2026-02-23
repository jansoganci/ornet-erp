import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import { startOfMonth, endOfMonth, format, parseISO } from 'date-fns';
import { PageContainer, PageHeader } from '../../components/layout';
import { Select, EmptyState, ErrorState, Button, Table, Badge, DateRangeFilter, Card } from '../../components/ui';
import { useNotificationsList, useResolveNotification } from './hooks';
import { Check, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { tr } from 'date-fns/locale';

export function NotificationsCenterPage() {
  const { t } = useTranslation(['notifications', 'common']);
  const [searchParams, setSearchParams] = useSearchParams();
  const { mutate: resolve } = useResolveNotification();
  const navigate = useNavigate();

  const resolvedParam = searchParams.get('resolved') || 'undone';
  const pageParam = Number(searchParams.get('page')) || 1;
  const yearParam = searchParams.get('year') || '';
  const monthParam = searchParams.get('month') || '';
  const dateFromParam = searchParams.get('dateFrom') || '';
  const dateToParam = searchParams.get('dateTo') || '';

  const isResolved = resolvedParam === 'done';

  // Calculate date range from month/year
  const dateRange = useMemo(() => {
    if (yearParam && monthParam) {
      const date = new Date(parseInt(yearParam), parseInt(monthParam) - 1, 1);
      return {
        from: format(startOfMonth(date), 'yyyy-MM-dd'),
        to: format(endOfMonth(date), 'yyyy-MM-dd'),
      };
    }
    return { from: undefined, to: undefined };
  }, [yearParam, monthParam]);

  const { data, isLoading, error, refetch } = useNotificationsList({
    resolved: isResolved,
    page: pageParam,
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
  });

  const handleFilterChange = (updates) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(updates).forEach(([key, value]) => {
        if (value) next.set(key, value);
        else next.delete(key);
      });
      next.set('page', '1');
      return next;
    });
  };

  const clearFilters = () => {
    setSearchParams({ resolved: resolvedParam, page: '1' });
  };

  const handlePageChange = (newPage) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('page', newPage.toString());
      return next;
    });
  };

  const columns = [
    {
      header: t('notifications:table.type'),
      key: 'notification_type',
      render: (type) => (
        <Badge variant="default" size="sm" className="font-normal">
          {t('notifications:types.' + type)}
        </Badge>
      ),
    },
    {
      header: t('notifications:table.content'),
      key: 'title',
      render: (_, row) => (
        <div className="max-w-md">
          <p className="font-medium text-neutral-900 dark:text-neutral-50 truncate">
            {row.title}
          </p>
          {row.body && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
              {row.body}
            </p>
          )}
        </div>
      ),
    },
    {
      header: isResolved ? t('notifications:table.resolvedDate') : t('notifications:table.date'),
      key: isResolved ? 'resolved_at' : 'created_at',
      render: (date) => (
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          {date ? format(parseISO(date), 'dd.MM.yyyy', { locale: tr }) : '-'}
        </span>
      ),
    },
    {
      header: t('notifications:table.actions'),
      key: 'actions',
      align: 'right',
      render: (_, row) => {
        const getRoute = (entityType, entityId) => {
          if (!entityId && entityType !== 'task') return null;
          switch (entityType) {
            case 'work_order': return `/work-orders/${entityId}`;
            case 'proposal': return `/proposals/${entityId}`;
            case 'subscription': return `/subscriptions/${entityId}`;
            case 'task': return '/tasks';
            case 'sim_card': return `/sim-cards/${entityId}/edit`;
            default: return null;
          }
        };
        const route = getRoute(row.entity_type, row.entity_id);

        return (
          <div className="flex items-center justify-end gap-2">
            {route && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(route)}
                title={t('common:actions.viewDetails')}
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            )}
            {!isResolved && row.notification_source === 'stored' && row.notification_id && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => resolve(row.notification_id)}
                className="text-neutral-400 hover:text-success-600"
                title={t('notifications:actions.resolve')}
              >
                <Check className="w-4 h-4" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString());
  }, []);

  const monthOptions = [
    { value: '', label: t('notifications:filters.month') },
    ...Object.entries(t('notifications:months', { returnObjects: true })).map(([val, label]) => ({
      value: val,
      label,
    })),
  ];

  const yearOptions = [
    { value: '', label: t('notifications:filters.year') },
    ...years.map((y) => ({ value: y, label: y })),
  ];

  return (
    <PageContainer>
      <PageHeader title={t('notifications:page.title')} />

      <Card className="p-3 mb-6 border-neutral-200/60 dark:border-neutral-800/60">
        <div className="flex flex-col lg:flex-row items-end gap-3">
          <div className="w-full lg:w-48">
            <Select
              label={t('notifications:filters.status')}
              value={resolvedParam}
              onChange={(e) => handleFilterChange({ resolved: e.target.value })}
              options={[
                { value: 'undone', label: t('notifications:filters.undone') },
                { value: 'done', label: t('notifications:filters.done') },
              ]}
              size="sm"
            />
          </div>
          <div className="w-full lg:w-32">
            <Select
              label={t('notifications:filters.year')}
              value={yearParam}
              onChange={(e) => handleFilterChange({ year: e.target.value })}
              options={yearOptions}
              size="sm"
            />
          </div>
          <div className="w-full lg:w-40">
            <Select
              label={t('notifications:filters.month')}
              value={monthParam}
              onChange={(e) => handleFilterChange({ month: e.target.value })}
              options={monthOptions}
              size="sm"
            />
          </div>
          <div className="flex items-center gap-2 pb-1">
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              {t('notifications:filters.clear')}
            </Button>
          </div>
        </div>
      </Card>

      {error ? (
        <ErrorState message={t('notifications:error.loadFailed')} onRetry={refetch} />
      ) : (
        <>
          <Table
            columns={columns}
            data={data || []}
            loading={isLoading}
            emptyState={
              <EmptyState
                title={t('notifications:empty.title')}
                description={isResolved ? t('notifications:empty.done') : t('notifications:empty.undone')}
              />
            }
          />

          <div className="mt-6 flex justify-center gap-4">
            <Button
              variant="outline"
              disabled={pageParam <= 1}
              onClick={() => handlePageChange(pageParam - 1)}
            >
              {t('common:pagination.previous')}
            </Button>
            <Button
              variant="outline"
              disabled={!data || data.length < 20}
              onClick={() => handlePageChange(pageParam + 1)}
            >
              {t('common:pagination.next')}
            </Button>
          </div>
        </>
      )}
    </PageContainer>
  );
}
