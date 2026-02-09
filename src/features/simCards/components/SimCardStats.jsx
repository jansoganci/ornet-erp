import { useTranslation } from 'react-i18next';
import { Card } from '../../../components/ui';
import { Cpu as SimIcon, CheckCircle2, XCircle, Package, TrendingUp } from 'lucide-react';

export function SimCardStats({ simCards = [], statsData }) {
  const { t } = useTranslation('simCards');

  const stats = {
    total: statsData?.total_count || simCards.length,
    available: statsData?.available_count || simCards.filter(s => s.status === 'available').length,
    active: statsData?.active_sim_count || simCards.filter(s => s.status === 'active').length,
    profit: statsData?.total_monthly_profit || simCards.reduce((acc, curr) => acc + (curr.sale_price - curr.cost_price), 0),
  };

  const statItems = [
    {
      label: t('stats.total'),
      value: stats.total,
      icon: Package,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      label: t('stats.available'),
      value: stats.available,
      icon: SimIcon,
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-900/20',
    },
    {
      label: t('stats.active'),
      value: stats.active,
      icon: TrendingUp,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-900/20',
    },
    {
      label: t('stats.monthlyProfit'),
      value: new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(stats.profit),
      icon: CheckCircle2,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
      {statItems.map((item, i) => (
        <Card key={i} className="p-4 border-neutral-200/60 dark:border-neutral-800/60 shadow-sm">
          <div className="flex items-center gap-4">
            <div className={`p-2.5 rounded-xl ${item.bg} shrink-0`}>
              <item.icon className={`w-5 h-5 ${item.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider leading-none mb-1.5 truncate">
                {item.label}
              </p>
              <p className="text-xl font-black text-neutral-900 dark:text-neutral-50 leading-none truncate">
                {item.value}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
