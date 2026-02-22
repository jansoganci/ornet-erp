import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import { Modal, Button, Table, Spinner, EmptyState, ErrorState } from '../../../components/ui';
import { useMaterialUsageHistory } from '../hooks';
import { formatDate } from '../../../lib/utils';

export function MaterialUsageModal({ open, onClose, material }) {
  const { t } = useTranslation(['materials', 'common']);
  const materialId = material?.id;
  const { data: usage = [], isLoading, error, refetch } = useMaterialUsageHistory(materialId);

  const title = material
    ? `${t('materials:usage.title')} — ${material.code} ${material.name}`
    : t('materials:usage.title');

  const columns = [
    {
      header: t('materials:usage.columns.customer'),
      accessor: 'company_name',
      render: (val) => <span className="font-medium text-neutral-900 dark:text-neutral-100">{val || '—'}</span>,
    },
    {
      header: t('materials:usage.columns.site'),
      accessor: 'site_name',
      render: (val, row) => (
        <span className="text-sm text-neutral-600 dark:text-neutral-400">
          {[val, row.account_no].filter(Boolean).join(' — ') || '—'}
        </span>
      ),
    },
    {
      header: t('materials:usage.columns.workOrder'),
      accessor: 'form_no',
      render: (val, row) =>
        row.work_order_id ? (
          <Link
            to={`/work-orders/${row.work_order_id}`}
            className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium underline"
            onClick={(e) => e.stopPropagation()}
          >
            {val || '—'}
          </Link>
        ) : (
          val || '—'
        ),
    },
    {
      header: t('materials:usage.columns.workType'),
      accessor: 'work_type',
      render: (val) => (
        <span className="text-sm">{val ? t(`common:workType.${val}`) : '—'}</span>
      ),
    },
    {
      header: t('materials:usage.columns.date'),
      accessor: 'completed_at',
      render: (_, row) => (
        <span className="text-sm whitespace-nowrap">
          {formatDate(row.completed_at || row.scheduled_date) || '—'}
        </span>
      ),
    },
    {
      header: t('materials:usage.columns.status'),
      accessor: 'status',
      render: (val) => (
        <span className="text-sm">{val ? t(`common:status.${val}`) : '—'}</span>
      ),
    },
    {
      header: t('materials:usage.columns.quantity'),
      accessor: 'quantity',
      align: 'right',
      render: (val) => <span className="font-mono text-sm">{val ?? '—'}</span>,
    },
  ];

  const emptyState = (
    <EmptyState
      icon={ClipboardList}
      title={t('materials:usage.empty')}
      className="py-8"
    />
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="xl"
      footer={
        <Button variant="ghost" onClick={onClose}>
          {t('common:actions.close')}
        </Button>
      }
    >
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : (
        <Table
          columns={columns}
          data={usage}
          emptyState={emptyState}
          loading={false}
        />
      )}
    </Modal>
  );
}
