import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Plus, DollarSign, RefreshCw } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/layout';
import {
  Button,
  Input,
  Card,
  Table,
  EmptyState,
  Spinner,
  ErrorState,
  TableSkeleton,
} from '../../components/ui';
import { useCurrentProfile } from '../subscriptions/hooks';
import { useExchangeRates, useCreateRate, useFetchTcmbRates } from './hooks';
import { rateSchema, rateDefaultValues } from './schema';
import { formatDate } from '../../lib/utils';

function getTodayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatRate(val) {
  if (val == null) return '-';
  const n = Number(val);
  return Number.isNaN(n) ? '-' : n.toFixed(4);
}

export function ExchangeRatePage() {
  const { t } = useTranslation(['finance', 'common']);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(rateSchema),
    defaultValues: {
      ...rateDefaultValues,
      rate_date: getTodayISO(),
    },
  });

  const { data: currentProfile } = useCurrentProfile();
  const hasFinanceAccess = currentProfile?.role === 'admin' || currentProfile?.role === 'accountant';
  const { data: rates = [], isLoading, error, refetch } = useExchangeRates();
  const createMutation = useCreateRate();
  const fetchTcmbMutation = useFetchTcmbRates();

  const onSubmit = async (data) => {
    const payload = {
      rate_date: data.rate_date,
      buy_rate: data.buy_rate != null && data.buy_rate !== '' ? Number(data.buy_rate) : null,
      sell_rate: data.sell_rate != null && data.sell_rate !== '' ? Number(data.sell_rate) : null,
      effective_rate: Number(data.effective_rate),
      currency: data.currency || 'USD',
      source: data.source || 'TCMB',
    };
    try {
      await createMutation.mutateAsync(payload);
      reset({
        ...rateDefaultValues,
        rate_date: getTodayISO(),
      });
    } catch {
      // Error handled by useCreateRate onError (including duplicate)
    }
  };

  const columns = [
    {
      header: t('finance:exchangeRates.currency'),
      accessor: 'currency',
      render: (val) => val || '-',
    },
    {
      header: t('finance:exchangeRates.date'),
      accessor: 'rate_date',
      render: (val) => formatDate(val),
    },
    {
      header: t('finance:exchangeRates.buyRate'),
      accessor: 'buy_rate',
      align: 'right',
      render: (val) => formatRate(val),
    },
    {
      header: t('finance:exchangeRates.sellRate'),
      accessor: 'sell_rate',
      align: 'right',
      render: (val) => formatRate(val),
    },
    {
      header: t('finance:exchangeRates.effectiveRate'),
      accessor: 'effective_rate',
      align: 'right',
      render: (val) => formatRate(val),
    },
    {
      header: t('finance:exchangeRates.source'),
      accessor: 'source',
      render: (val) => val || '-',
    },
  ];

  const breadcrumbs = [
    { label: t('common:nav.dashboard'), to: '/' },
    { label: t('finance:dashboard.title'), to: '/finance' },
    { label: t('finance:exchangeRates.title') },
  ];

  if (isLoading) {
    return (
      <PageContainer maxWidth="xl" padding="default">
        <PageHeader title={t('finance:exchangeRates.title')} />
        <div className="mt-6">
          <TableSkeleton cols={6} />
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer maxWidth="xl" padding="default">
        <PageHeader title={t('finance:exchangeRates.title')} breadcrumbs={breadcrumbs} />
        <ErrorState message={error.message} onRetry={refetch} />
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="xl" padding="default" className="space-y-6">
      <PageHeader
        title={t('finance:exchangeRates.title')}
        breadcrumbs={breadcrumbs}
        actions={
          hasFinanceAccess && (
            <Button
              variant="secondary"
              leftIcon={<RefreshCw className="w-4 h-4" />}
              loading={fetchTcmbMutation.isPending}
              onClick={() => fetchTcmbMutation.mutate()}
            >
              {t('finance:exchangeRates.fetchTcmb')}
            </Button>
          )
        }
      />

      <Card className="p-6 border-neutral-200/60 dark:border-neutral-800/60">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <h3 className="text-sm font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
            {t('finance:exchangeRates.addRate')}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Input
              label={t('finance:exchangeRates.date')}
              type="date"
              error={errors.rate_date?.message}
              {...register('rate_date')}
              autoFocus
            />
            <Input
              label={t('finance:exchangeRates.buyRate')}
              type="number"
              step="0.0001"
              min="0"
              placeholder="0"
              error={errors.buy_rate?.message}
              {...register('buy_rate')}
            />
            <Input
              label={t('finance:exchangeRates.sellRate')}
              type="number"
              step="0.0001"
              min="0"
              placeholder="0"
              error={errors.sell_rate?.message}
              {...register('sell_rate')}
            />
            <Input
              label={t('finance:exchangeRates.effectiveRate')}
              type="number"
              step="0.0001"
              min="0"
              placeholder="0"
              error={errors.effective_rate?.message}
              {...register('effective_rate')}
            />
          </div>
          <div className="flex">
            <Button
              type="submit"
              variant="primary"
              leftIcon={<Plus className="w-4 h-4" />}
              loading={isSubmitting}
            >
              {t('finance:exchangeRates.addRate')}
            </Button>
          </div>
        </form>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : rates.length === 0 ? (
        <EmptyState
          icon={DollarSign}
          title={t('finance:exchangeRates.empty')}
          description={t('finance:exchangeRates.empty')}
        />
      ) : (
        <div className="bg-white dark:bg-[#171717] rounded-2xl border border-neutral-200 dark:border-[#262626] overflow-hidden shadow-sm">
          <Table
            columns={columns}
            data={rates}
            keyExtractor={(row) => row.id}
          />
        </div>
      )}
    </PageContainer>
  );
}
