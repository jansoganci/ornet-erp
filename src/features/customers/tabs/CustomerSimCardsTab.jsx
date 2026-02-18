import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Button, Table, Badge } from '../../../components/ui';

export function CustomerSimCardsTab({
  customerId,
  simCards = [],
  simCardsLoading = false,
  navigate,
}) {
  const { t } = useTranslation(['customers', 'simCards']);

  const columns = [
    {
      key: 'phone_number',
      header: t('simCards:list.columns.phoneNumber'),
      render: (_, sim) => (
        <p className="font-medium text-neutral-900 dark:text-neutral-50 font-mono">
          {sim.phone_number}
        </p>
      ),
    },
    {
      key: 'status',
      header: t('simCards:list.columns.status'),
      render: (_, sim) => (
        <Badge
          variant={
            sim.status === 'active'       ? 'success'  :
            sim.status === 'available'    ? 'info'     :
            sim.status === 'subscription' ? 'primary'  :
            sim.status === 'cancelled'    ? 'warning'  : 'default'
          }
          size="sm"
        >
          {t(`simCards:status.${sim.status}`)}
        </Badge>
      ),
    },
    {
      key: 'site',
      header: t('simCards:list.columns.site'),
      render: (_, sim) => (
        <span className="text-sm text-neutral-600 dark:text-neutral-400">
          {sim.customer_sites?.site_name || '—'}
        </span>
      ),
    },
    {
      key: 'sale_price',
      header: t('simCards:list.columns.salePrice'),
      render: (_, sim) => (
        <span className="font-medium tabular-nums">
          {new Intl.NumberFormat('tr-TR', {
            style: 'currency',
            currency: sim.currency || 'TRY',
          }).format(sim.sale_price)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">
          {t('customers:detail.tabs.simCards')}
        </h2>
        <Button
          size="sm"
          variant="outline"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => navigate(`/sim-cards/new?customerId=${customerId}`)}
        >
          {t('simCards:actions.add')}
        </Button>
      </div>

      <div className="rounded-xl border border-neutral-200 dark:border-[#262626] overflow-hidden bg-white dark:bg-[#171717]">
        <Table
          columns={columns}
          data={simCards}
          loading={simCardsLoading}
          emptyMessage={t('simCards:list.empty.title')}
          onRowClick={(sim) => navigate(`/sim-cards/${sim.id}/edit`)}
        />
      </div>
    </div>
  );
}
