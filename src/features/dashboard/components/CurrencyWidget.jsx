import { RefreshCw, DollarSign, Euro } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLatestRate, useFetchTcmbRates } from '../../finance/hooks';
import { Button, Card, Skeleton } from '../../../components/ui';
import { cn } from '../../../lib/utils';

export function CurrencyWidget() {
  const { t } = useTranslation(['common', 'finance']);
  const { data: usdRate, isLoading: isUsdLoading } = useLatestRate('USD');
  const { data: eurRate, isLoading: isEurLoading } = useLatestRate('EUR');
  const fetchTcmbRatesMutation = useFetchTcmbRates();

  const handleRefresh = () => {
    fetchTcmbRatesMutation.mutate();
  };

  const isLoading = isUsdLoading || isEurLoading;

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h2 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
            {t('finance:exchangeRates.title')}
          </h2>
          {usdRate?.rate_date && (
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
              {new Date(usdRate.rate_date).toLocaleDateString('tr-TR')} {usdRate.created_at ? new Date(usdRate.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : ''}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="xs"
          className="h-7 px-2 text-xs gap-1.5"
          onClick={handleRefresh}
          loading={fetchTcmbRatesMutation.isPending}
        >
          <RefreshCw className={cn("w-3 h-3", fetchTcmbRatesMutation.isPending && "animate-spin")} />
          {t('finance:exchangeRates.fetchTcmb')}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <CurrencyCard 
          symbol="USD" 
          icon={DollarSign} 
          rate={usdRate} 
          label="Amerikan Doları"
        />
      </div>
    </div>
  );
}

function CurrencyCard({ symbol, icon: Icon, rate, label }) {
  const { t } = useTranslation('finance');

  return (
    <Card className="p-3 bg-white dark:bg-[#171717] border-neutral-200 dark:border-[#262626]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-[#262626] flex items-center justify-center">
            <Icon className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
          </div>
          <div>
            <div className="text-xs font-bold text-neutral-900 dark:text-neutral-50">{symbol}</div>
            <div className="text-[10px] text-neutral-500 dark:text-neutral-500 leading-none">{label}</div>
          </div>
        </div>

        <div className="flex gap-8 text-right">
          <div>
            <div className="text-[10px] text-neutral-500 dark:text-neutral-500 uppercase tracking-tighter font-medium">Efektif Alış</div>
            <div className="text-base font-bold text-neutral-900 dark:text-neutral-50 tabular-nums">
              {rate?.buy_rate ? Number(rate.buy_rate).toFixed(4) : '-'}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-neutral-500 dark:text-neutral-500 uppercase tracking-tighter font-medium">Efektif Satış</div>
            <div className="text-base font-bold text-primary-600 dark:text-primary-400 tabular-nums">
              {rate?.sell_rate ? Number(rate.sell_rate).toFixed(4) : '-'}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
