import { useTranslation } from 'react-i18next';
import { FileText, Plus } from 'lucide-react';
import { Button, Table, Badge } from '../../../components/ui';
import { formatDate, workOrderStatusVariant } from '../../../lib/utils';

export function CustomerWorkOrdersTab({
  customerId,
  workOrders = [],
  workOrdersLoading = false,
  navigate,
}) {
  const { t } = useTranslation('customers');
  const { t: tCommon } = useTranslation('common');
  const { t: tWO } = useTranslation('workOrders');

  const columns = [
    {
      key: 'work_type',
      header: tWO('form.fields.workType'),
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
      header: tWO('form.fields.description'),
      render: (_, wo) => (
        <p className="text-sm text-neutral-700 dark:text-neutral-300 truncate max-w-[200px]">
          {wo.description || '—'}
        </p>
      ),
    },
    {
      key: 'site',
      header: t('customers:sites.title'),
      render: (_, wo) => (
        <div>
          <p className="font-medium text-neutral-900 dark:text-neutral-50 truncate max-w-[150px]">
            {wo.site_name || wo.site_address}
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {wo.account_no || '—'}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: tWO('list.columns.status'),
      render: (_, wo) => (
        <Badge variant={workOrderStatusVariant[wo.status]} size="sm" dot>
          {tCommon(`status.${wo.status}`)}
        </Badge>
      ),
    },
    {
      key: 'scheduled_date',
      header: tWO('list.columns.scheduledDate'),
      render: (_, wo) => (
        <div className="text-sm tabular-nums">
          <p>{wo.scheduled_date ? formatDate(wo.scheduled_date) : '—'}</p>
          {wo.scheduled_time && (
            <p className="text-xs text-neutral-400">{wo.scheduled_time}</p>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">
          {t('customers:detail.tabs.workOrders')}
        </h2>
        <Button
          size="sm"
          variant="primary"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => navigate(`/work-orders/new?customerId=${customerId}`)}
        >
          {t('customers:detail.actions.newWorkOrder')}
        </Button>
      </div>

      <div className="rounded-xl border border-neutral-200 dark:border-[#262626] overflow-hidden bg-white dark:bg-[#171717]">
        <Table
          columns={columns}
          data={workOrders}
          loading={workOrdersLoading}
          emptyMessage={t('customers:detail.workHistory.empty')}
          onRowClick={(wo) => navigate(`/work-orders/${wo.id}`)}
        />
      </div>
    </div>
  );
}
