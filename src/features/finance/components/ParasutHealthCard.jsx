import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, Skeleton } from '../../../components/ui';
import { supabase } from '../../../lib/supabase';
import { useQuery } from '@tanstack/react-query';

async function fetchParasutHealth() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('financial_transactions')
    .select('parasut_sync_status')
    .gte('updated_at', since)
    .not('parasut_sync_status', 'is', null);

  if (error) throw error;
  const rows = data || [];
  return {
    confirmed: rows.filter((row) => row.parasut_sync_status === 'confirmed').length,
    failed: rows.filter((row) => row.parasut_sync_status === 'failed').length,
    pending: rows.filter((row) => ['ready', 'draft', 'sent'].includes(row.parasut_sync_status)).length,
  };
}

export function ParasutHealthCard() {
  const { t } = useTranslation('finance');
  const enabled = import.meta.env.VITE_PARASUT_ENABLED === 'true';
  const { data, isLoading } = useQuery({
    queryKey: ['parasutHealth'],
    queryFn: fetchParasutHealth,
    enabled,
  });

  if (!enabled) return null;
  if (isLoading) return <Skeleton className="h-24 rounded-xl" />;

  const hasFailure = (data?.failed || 0) > 0;
  const Icon = hasFailure ? AlertTriangle : CheckCircle2;

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <Icon className={hasFailure ? 'h-5 w-5 text-error-600' : 'h-5 w-5 text-success-600'} />
        <div>
          <p className="text-sm font-bold text-neutral-900 dark:text-neutral-50">
            {t('parasut.health.title')}
          </p>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {t('parasut.health.summary', {
              confirmed: data?.confirmed ?? 0,
              failed: data?.failed ?? 0,
              pending: data?.pending ?? 0,
            })}
          </p>
        </div>
      </div>
    </Card>
  );
}
