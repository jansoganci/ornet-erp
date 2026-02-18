import { Building2, MapPin, CreditCard, TrendingUp, Edit, Trash2, Plus, ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button, IconButton, Badge } from '../../../components/ui';
import { cn } from '../../../lib/utils';

export function CustomerHero({
  customer,
  monthlyRevenue = 0,
  locationCount = 0,
  onEdit,
  onDelete,
  onNewWorkOrder,
}) {
  const { t } = useTranslation(['customers', 'common']);

  const monthlyStr = new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0,
  }).format(monthlyRevenue);

  return (
    <div className="space-y-4">
      {/* Breadcrumb + Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/customers"
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          {t('common:nav.customers')}
        </Link>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={onNewWorkOrder}
          >
            {t('customers:detail.actions.newWorkOrder')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Edit className="w-4 h-4" />}
            onClick={onEdit}
          >
            {t('customers:detail.actions.edit')}
          </Button>
          <IconButton
            icon={Trash2}
            variant="ghost"
            size="sm"
            onClick={onDelete}
            aria-label={t('customers:detail.actions.delete')}
            className="text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-950/30"
          />
        </div>
      </div>

      {/* Hero Card */}
      <div className="rounded-xl border border-neutral-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-5 shadow-sm">
        {/* Identity row */}
        <div className="flex items-start gap-4 mb-5">
          <div className="p-3 rounded-xl bg-primary-100 dark:bg-primary-950/40 flex-shrink-0">
            <Building2 className="w-7 h-7 text-primary-600 dark:text-primary-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-50 leading-tight truncate">
                  {customer.company_name}
                </h1>
                {customer.account_number && (
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5 font-mono">
                    {customer.account_number}
                  </p>
                )}
              </div>
              <Badge variant="success" size="sm" dot className="flex-shrink-0 mt-1">
                {t('common:status.active')}
              </Badge>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Lokasyon */}
          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
            <MapPin className="w-4 h-4 text-neutral-500 dark:text-neutral-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-wider">
                {t('customers:sites.title')}
              </p>
              <p className="text-sm font-bold text-neutral-900 dark:text-neutral-50 mt-0.5">
                {t('customers:sites.siteCount', { count: locationCount })}
              </p>
            </div>
          </div>

          {/* Vergi No */}
          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
            <CreditCard className="w-4 h-4 text-neutral-500 dark:text-neutral-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-wider">
                {t('customers:form.fields.taxNumber')}
              </p>
              <p className="text-sm font-bold text-neutral-900 dark:text-neutral-50 font-mono mt-0.5">
                {customer.tax_number || '—'}
              </p>
            </div>
          </div>

          {/* Aylık Gelir */}
          <div className={cn(
            'flex items-center gap-2.5 p-3 rounded-lg',
            monthlyRevenue > 0
              ? 'bg-primary-50 dark:bg-primary-950/20'
              : 'bg-neutral-50 dark:bg-neutral-800/50'
          )}>
            <TrendingUp className={cn(
              'w-4 h-4 flex-shrink-0',
              monthlyRevenue > 0
                ? 'text-primary-600 dark:text-primary-400'
                : 'text-neutral-500 dark:text-neutral-400'
            )} />
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-wider">
                {t('customers:detail.monthlyRevenue')}
              </p>
              <p className={cn(
                'text-sm font-bold mt-0.5 tabular-nums',
                monthlyRevenue > 0
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-neutral-900 dark:text-neutral-50'
              )}>
                {monthlyStr}
                <span className="text-xs font-medium opacity-70">/ay</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
