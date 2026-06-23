import { useTranslation } from 'react-i18next';
import { CreditCard, DollarSign, Network } from 'lucide-react';
import { Badge, Card } from '../../../components/ui';
import { cn } from '../../../lib/utils';
import { SubscriptionPricingCard } from './SubscriptionPricingCard';
import { StaticIpCard } from './StaticIpCard';

const SURFACE =
  'rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-[#262626] dark:bg-[#171717]';

function MetaRow({ label, value }) {
  if (value == null || value === '') return null;
  return (
    <div className="flex items-center justify-between gap-3 py-1 text-sm">
      <span className="text-neutral-500 dark:text-neutral-400">{label}</span>
      <span className="font-medium text-neutral-900 dark:text-neutral-100 text-right">{value}</span>
    </div>
  );
}

export function SubscriptionDetailSidebar({ subscription, isAdmin, simCardId }) {
  const { t } = useTranslation(['subscriptions', 'notifications']);

  const cardLabel = [
    subscription.card_bank_name || subscription.pm_bank_name,
    (subscription.card_last4 || subscription.pm_card_last4) && `•••• ${subscription.card_last4 || subscription.pm_card_last4}`,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <aside className="flex min-w-0 flex-col gap-4 lg:col-span-1">
      <Card className={cn(SURFACE, 'p-4 sm:p-5')}>
        <div className="space-y-5">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary-600 dark:text-primary-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                {t('subscriptions:detail.sections.pricing')}
              </h3>
            </div>
            <SubscriptionPricingCard
              subscription={subscription}
              isAdmin={isAdmin}
              className="border-0 bg-transparent shadow-none"
            />
          </div>

          <div className="border-t border-neutral-200 pt-5 dark:border-[#262626]">
            <div className="mb-3 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary-600 dark:text-primary-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                {t('subscriptions:detail.sections.paymentMethod')}
              </h3>
            </div>
            <div className="space-y-0.5">
              <MetaRow
                label={t('subscriptions:detail.fields.billingFrequency')}
                value={t(`subscriptions:form.fields.${subscription.billing_frequency || 'monthly'}`)}
              />
              <MetaRow
                label={t('subscriptions:detail.fields.billingDay')}
                value={subscription.billing_day ? `${subscription.billing_day}. gün` : '—'}
              />
              {subscription.billing_frequency !== 'monthly' && subscription.payment_start_month && (
                <MetaRow
                  label={t('subscriptions:detail.fields.paymentStartMonth')}
                  value={t(`notifications:months.${subscription.payment_start_month}`)}
                />
              )}
              <div className="flex items-center justify-between gap-3 py-1 text-sm">
                <span className="text-neutral-500 dark:text-neutral-400">
                  {t('subscriptions:detail.fields.officialInvoice')}
                </span>
                <Badge variant={subscription.official_invoice !== false ? 'info' : 'outline'} size="sm">
                  {subscription.official_invoice !== false
                    ? t('subscriptions:detail.officialInvoiceResmi')
                    : t('subscriptions:detail.officialInvoiceGayri')}
                </Badge>
              </div>
              {cardLabel && (
                <p className="pt-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">{cardLabel}</p>
              )}
              {subscription.pm_card_holder && (
                <p className="text-xs text-neutral-500">{subscription.pm_card_holder}</p>
              )}
              {subscription.pm_iban && (
                <p className="text-xs font-mono text-neutral-500">{subscription.pm_iban}</p>
              )}
              {subscription.cash_collector_name && (
                <MetaRow
                  label={t('subscriptions:detail.fields.cashCollector')}
                  value={subscription.cash_collector_name}
                />
              )}
              <MetaRow
                label={t('subscriptions:detail.fields.managedBy')}
                value={subscription.managed_by_name || t('subscriptions:detail.noManager')}
              />
            </div>
          </div>

          {simCardId && (
            <div className="border-t border-neutral-200 pt-5 dark:border-[#262626]">
              <div className="mb-3 flex items-center gap-2">
                <Network className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                  {t('subscriptions:detail.sections.staticIp')}
                </h3>
              </div>
              <StaticIpCard simCardId={simCardId} isAdmin={isAdmin} className="border-0 bg-transparent shadow-none" compact />
            </div>
          )}
        </div>
      </Card>
    </aside>
  );
}
