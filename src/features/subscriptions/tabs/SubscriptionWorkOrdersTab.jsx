import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { Table, Badge, SearchInput, EmptyState, Spinner } from '../../../components/ui';
import { formatDate, workOrderStatusVariant } from '../../../lib/utils';
import { normalizeForSearch } from '../../../lib/normalizeForSearch';
import { toCSV, downloadCSV } from '../../../lib/csvExport';
import { useWorkOrdersBySite } from '../../workOrders/hooks';

export function SubscriptionWorkOrdersTab({ siteId }) {
  const navigate = useNavigate();
  const { t } = useTranslation('subscriptions');
  const { t: tCommon } = useTranslation('common');
  const { data: workOrders = [], isLoading, error } = useWorkOrdersBySite(siteId);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return workOrders;
    const normalized = normalizeForSearch(search);
    return workOrders.filter((wo) => {
      const haystack = normalizeForSearch(
        [wo.description, wo.form_no, wo.work_type].filter(Boolean).join(' ')
      );
      return haystack.includes(normalized);
    });
  }, [workOrders, search]);

  const columns = [
    {
      key: 'work_type',
      header: t('detail.tabContent.workOrders.columns.workType'),
      render: (_, wo) => (
        <div>
          <Badge variant="outline" size="sm" className="mb-1">
            {tCommon(`workType.${wo.work_type}`)}
          </Badge>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
            {wo.form_no || '—'}
          </p>
        </div>
      ),
    },
    {
      key: 'description',
      header: t('detail.tabContent.workOrders.columns.description'),
      render: (_, wo) => (
        <p className="text-sm text-neutral-700 dark:text-neutral-300 truncate max-w-[200px]">
          {wo.description || '—'}
        </p>
      ),
    },
    {
      key: 'status',
      header: t('detail.tabContent.workOrders.columns.status'),
      render: (_, wo) => (
        <Badge variant={workOrderStatusVariant[wo.status]} size="sm" dot>
          {tCommon(`status.${wo.status}`)}
        </Badge>
      ),
    },
    {
      key: 'scheduled_date',
      header: t('detail.tabContent.workOrders.columns.scheduledDate'),
      render: (_, wo) => (
        <div className="text-sm tabular-nums">
          <p>{wo.scheduled_date ? formatDate(wo.scheduled_date) : '—'}</p>
          {wo.scheduled_time && (
            <p className="text-xs text-neutral-400">{wo.scheduled_time}</p>
          )}
        </div>
      ),
    },
    {
      key: 'assigned_workers',
      header: t('detail.tabContent.workOrders.columns.assignedWorkers'),
      render: (_, wo) => {
        const workers = wo.assigned_workers || [];
        if (!workers.length) return <span className="text-neutral-400">—</span>;
        return (
          <p className="text-sm text-neutral-700 dark:text-neutral-300 truncate max-w-[150px]">
            {workers.map((w) => w.name).join(', ')}
          </p>
        );
      },
    },
  ];

  const handleExport = () => {
    const csvColumns = columns.map((col) => ({
      key: col.key,
      header: col.header,
    }));
    const rows = filtered.map((wo) => ({
      work_type: tCommon(`workType.${wo.work_type}`),
      description: wo.description || '',
      status: tCommon(`status.${wo.status}`),
      scheduled_date: wo.scheduled_date ? formatDate(wo.scheduled_date) : '',
      assigned_workers: (wo.assigned_workers || []).map((w) => w.name).join(', '),
    }));
    const csv = toCSV(rows, csvColumns);
    downloadCSV(csv, t('detail.tabContent.workOrders.exportFilename'));
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title={tCommon('errors.loadFailed')}
        description={error.message}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t('detail.tabContent.searchPlaceholder')}
          className="max-w-xs"
        />
        {filtered.length > 0 && (
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-1.5 text-xs font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            {t('detail.tabContent.exportCsv')}
          </button>
        )}
      </div>

      <div className="rounded-xl border border-neutral-200 dark:border-[#262626] overflow-hidden bg-white dark:bg-[#171717]">
        <Table
          columns={columns}
          data={filtered}
          emptyMessage={t('detail.tabContent.workOrders.empty')}
          onRowClick={(wo) => navigate(`/work-orders/${wo.id}`)}
        />
      </div>
    </div>
  );
}
