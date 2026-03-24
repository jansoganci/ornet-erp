import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Plus, DollarSign, RefreshCw, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/layout';
import {
  Button,
  Input,
  Card,
  Table,
  EmptyState,
  ErrorState,
  TableSkeleton,
  IconButton,
  Modal,
} from '../../components/ui';
import { useCurrentProfile } from '../subscriptions/hooks';
import { useExchangeRates, useCreateRate, useFetchTcmbRates, useDeleteRate } from './hooks';
import { rateSchema, rateDefaultValues } from './schema';
import { formatDate } from '../../lib/utils';
import { getErrorMessage } from '../../lib/errorHandler';

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
  const [showMobileForm, setShowMobileForm] = useState(false);

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
  const [rateToDelete, setRateToDelete] = useState(null);
  const { data: rates = [], isLoading, error, refetch } = useExchangeRates();
  const createMutation = useCreateRate();
  const fetchTcmbMutation = useFetchTcmbRates();
  const deleteMutation = useDeleteRate();

  // ── Derived: latest rates for mobile KPIs ──
  const latestUSD = rates.find((r) => r.currency === 'USD');
  const latestEUR = rates.find((r) => r.currency === 'EUR');

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
      setShowMobileForm(false);
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
    ...(hasFinanceAccess
      ? [
          {
            header: '',
            accessor: 'actions',
            stickyRight: true,
            render: (_, row) => (
              <IconButton
                icon={Trash2}
                variant="ghost"
                size="sm"
                aria-label={t('common:actions.delete')}
                onClick={(e) => {
                  e.stopPropagation();
                  setRateToDelete(row);
                }}
              />
            ),
          },
        ]
      : []),
  ];

  const breadcrumbs = [
    { label: t('common:nav.dashboard'), to: '/' },
    { label: t('finance:dashboard.title'), to: '/finance' },
    { label: t('finance:exchangeRates.title') },
  ];

  // ══════════════════════════════════════════════════════════════════════════
  // LOADING STATE
  // ══════════════════════════════════════════════════════════════════════════

  if (isLoading) {
    return (
      <PageContainer maxWidth="full" padding="default" className="space-y-6">
        <PageHeader title={t('finance:exchangeRates.title')} />

        {/* Mobile loading — md:hidden */}
        <div className="md:hidden space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/10">
                <div className="h-3 w-12 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse mb-2" />
                <div className="h-6 w-20 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
              </div>
            ))}
          </div>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/5">
              <div className="flex justify-between items-start mb-3">
                <div className="space-y-2">
                  <div className="h-5 w-12 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
                  <div className="h-3 w-24 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
                </div>
                <div className="h-5 w-16 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
              </div>
              <div className="flex gap-4 mt-3">
                <div className="h-3 w-16 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
                <div className="h-3 w-16 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
              </div>
            </div>
          ))}
        </div>

        {/* Desktop loading — hidden md:block */}
        <div className="hidden md:block mt-6">
          <TableSkeleton cols={6} />
        </div>
      </PageContainer>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ERROR STATE
  // ══════════════════════════════════════════════════════════════════════════

  if (error) {
    return (
      <PageContainer maxWidth="full" padding="default">
        <PageHeader title={t('finance:exchangeRates.title')} breadcrumbs={breadcrumbs} />
        <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
      </PageContainer>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <PageContainer maxWidth="full" padding="default" className="space-y-6">
      <PageHeader
        title={t('finance:exchangeRates.title')}
        breadcrumbs={breadcrumbs}
        actions={
          hasFinanceAccess && (
            <div className="flex gap-2">
              {/* Desktop buttons */}
              <Button
                variant="secondary"
                leftIcon={<RefreshCw className="w-4 h-4" />}
                loading={fetchTcmbMutation.isPending}
                onClick={() => fetchTcmbMutation.mutate()}
                className="hidden md:inline-flex"
              >
                {t('finance:exchangeRates.fetchTcmb')}
              </Button>

              {/* Mobile icon buttons */}
              <button
                type="button"
                onClick={() => fetchTcmbMutation.mutate()}
                disabled={fetchTcmbMutation.isPending}
                className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 active:scale-95 transition-transform border border-neutral-200 dark:border-neutral-700"
                aria-label={t('finance:exchangeRates.fetchTcmb')}
              >
                <RefreshCw className={`w-5 h-5 ${fetchTcmbMutation.isPending ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => setShowMobileForm((v) => !v)}
                className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-primary-600 text-white active:scale-95 transition-transform shadow-lg shadow-primary-600/20"
                aria-label={t('finance:exchangeRates.addRate')}
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          )
        }
      />

      {/* ── Mobile KPI Strip — md:hidden ── */}
      <section className="grid grid-cols-2 gap-3 md:hidden">
        <div className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/10">
          <p className="text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-neutral-500 dark:text-neutral-400 mb-1">
            USD
          </p>
          <p className="text-primary-400 font-bold text-xl tracking-tight tabular-nums">
            {latestUSD ? formatRate(latestUSD.effective_rate) : '-'}
          </p>
          {latestUSD && (
            <p className="text-[0.625rem] text-neutral-400 dark:text-neutral-500 mt-0.5">
              {formatDate(latestUSD.rate_date)}
            </p>
          )}
        </div>
        <div className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/10">
          <p className="text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-neutral-500 dark:text-neutral-400 mb-1">
            EUR
          </p>
          <p className="text-primary-400 font-bold text-xl tracking-tight tabular-nums">
            {latestEUR ? formatRate(latestEUR.effective_rate) : '-'}
          </p>
          {latestEUR && (
            <p className="text-[0.625rem] text-neutral-400 dark:text-neutral-500 mt-0.5">
              {formatDate(latestEUR.rate_date)}
            </p>
          )}
        </div>
        <div className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/10">
          <p className="text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-neutral-500 dark:text-neutral-400 mb-1">
            {t('finance:mobile.lastUpdated')}
          </p>
          <p className="text-neutral-900 dark:text-neutral-50 font-bold text-base tracking-tight">
            {rates.length > 0 ? formatDate(rates[0].rate_date) : '-'}
          </p>
        </div>
        <div className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/10">
          <p className="text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-neutral-500 dark:text-neutral-400 mb-1">
            {t('finance:exchangeRates.source')}
          </p>
          <p className="text-neutral-900 dark:text-neutral-50 font-bold text-base tracking-tight">
            {rates.length > 0 ? (rates[0].source || 'TCMB') : '-'}
          </p>
        </div>
      </section>

      {/* ── Mobile Collapsible Form — md:hidden ── */}
      {hasFinanceAccess && showMobileForm && (
        <section className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/20 md:hidden">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                {t('finance:exchangeRates.addRate')}
              </h3>
              <button type="button" onClick={() => setShowMobileForm(false)} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
                <ChevronUp className="w-5 h-5" />
              </button>
            </div>
            <Input label={t('finance:exchangeRates.date')} type="date" error={errors.rate_date?.message} {...register('rate_date')} />
            <div className="grid grid-cols-2 gap-3">
              <Input label={t('finance:exchangeRates.buyRate')} type="number" step="0.0001" min="0" placeholder="0" error={errors.buy_rate?.message} {...register('buy_rate')} />
              <Input label={t('finance:exchangeRates.sellRate')} type="number" step="0.0001" min="0" placeholder="0" error={errors.sell_rate?.message} {...register('sell_rate')} />
            </div>
            <Input label={t('finance:exchangeRates.effectiveRate')} type="number" step="0.0001" min="0" placeholder="0" error={errors.effective_rate?.message} {...register('effective_rate')} />
            <Button type="submit" variant="primary" leftIcon={<Plus className="w-4 h-4" />} loading={isSubmitting} className="w-full">
              {t('finance:exchangeRates.addRate')}
            </Button>
          </form>
        </section>
      )}

      {/* ── Desktop Form Card — hidden md:block ── */}
      {hasFinanceAccess && (
        <Card className="hidden md:block p-6 border-neutral-200/60 dark:border-neutral-800/60">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <h3 className="text-sm font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
              {t('finance:exchangeRates.addRate')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <Input label={t('finance:exchangeRates.date')} type="date" error={errors.rate_date?.message} {...register('rate_date')} autoFocus />
              <Input label={t('finance:exchangeRates.buyRate')} type="number" step="0.0001" min="0" placeholder="0" error={errors.buy_rate?.message} {...register('buy_rate')} />
              <Input label={t('finance:exchangeRates.sellRate')} type="number" step="0.0001" min="0" placeholder="0" error={errors.sell_rate?.message} {...register('sell_rate')} />
              <Input label={t('finance:exchangeRates.effectiveRate')} type="number" step="0.0001" min="0" placeholder="0" error={errors.effective_rate?.message} {...register('effective_rate')} />
            </div>
            <div className="flex">
              <Button type="submit" variant="primary" leftIcon={<Plus className="w-4 h-4" />} loading={isSubmitting}>
                {t('finance:exchangeRates.addRate')}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* ── Rate List ── */}
      {rates.length === 0 ? (
        <EmptyState
          icon={DollarSign}
          title={t('finance:exchangeRates.empty')}
          description={t('finance:exchangeRates.emptyDescription')}
        />
      ) : (
        <>
          {/* ── Mobile Rate Cards — md:hidden ── */}
          <section className="space-y-3 md:hidden">
            {rates.map((rate) => (
              <div
                key={rate.id}
                className="bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-neutral-200 dark:border-[#262626]/5"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-neutral-900 dark:text-neutral-50">
                        {rate.currency || '-'}
                      </span>
                      <span className="text-[0.625rem] px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                        {rate.source || 'TCMB'}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      {formatDate(rate.rate_date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-primary-400 font-bold text-lg tabular-nums">
                      {formatRate(rate.effective_rate)}
                    </span>
                    {hasFinanceAccess && (
                      <IconButton
                        icon={Trash2}
                        variant="ghost"
                        size="sm"
                        className="text-error-500 hover:text-error-600"
                        aria-label={t('common:actions.delete')}
                        onClick={() => setRateToDelete(rate)}
                      />
                    )}
                  </div>
                </div>
                <div className="flex gap-6 mt-3 text-xs text-neutral-500 dark:text-neutral-400">
                  <div>
                    <span className="text-[0.625rem] uppercase tracking-wider text-neutral-400 dark:text-neutral-500">{t('finance:exchangeRates.buyRate')}</span>
                    <p className="font-semibold text-neutral-700 dark:text-neutral-300 tabular-nums">{formatRate(rate.buy_rate)}</p>
                  </div>
                  <div>
                    <span className="text-[0.625rem] uppercase tracking-wider text-neutral-400 dark:text-neutral-500">{t('finance:exchangeRates.sellRate')}</span>
                    <p className="font-semibold text-neutral-700 dark:text-neutral-300 tabular-nums">{formatRate(rate.sell_rate)}</p>
                  </div>
                </div>
              </div>
            ))}
          </section>

          {/* ── Desktop Table — hidden md:block ── */}
          <div className="hidden md:block">
            <div className="bg-white dark:bg-[#171717] rounded-2xl border border-neutral-200 dark:border-[#262626] overflow-hidden shadow-sm">
              <Table columns={columns} data={rates} keyExtractor={(row) => row.id} />
            </div>
          </div>
        </>
      )}

      <Modal
        open={!!rateToDelete}
        onClose={() => setRateToDelete(null)}
        title={t('finance:deleteConfirm.title')}
        size="sm"
        footer={
          <div className="flex gap-3 w-full">
            <Button variant="ghost" onClick={() => setRateToDelete(null)} className="flex-1">
              {t('common:actions.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (rateToDelete) {
                  try {
                    await deleteMutation.mutateAsync(rateToDelete.id);
                    setRateToDelete(null);
                  } catch {
                    // Error handled by mutation onError
                  }
                }
              }}
              loading={deleteMutation.isPending}
              className="flex-1"
            >
              {t('common:actions.delete')}
            </Button>
          </div>
        }
      >
        <p className="text-center py-4">{t('finance:categories.deleteRateConfirm')}</p>
      </Modal>
    </PageContainer>
  );
}
