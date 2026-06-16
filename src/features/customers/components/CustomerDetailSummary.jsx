import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Eye, Cloud, Cpu } from 'lucide-react';
import { Button } from '../../../components/ui';
import { cn, formatDate, formatPhone } from '../../../lib/utils';

const SURFACE =
  'rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-[#262626] dark:bg-[#171717]';
const TEXT_MUTED = 'text-neutral-500 dark:text-neutral-400';

const SUB_ICONS = [Eye, Cloud, Cpu];

function ContactItem({ label, value, className }) {
  if (!value || value === '—') return null;
  return (
    <div className={cn('min-w-0', className)}>
      <p className={cn('text-[10px] font-semibold uppercase tracking-wide', TEXT_MUTED)}>{label}</p>
      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50 break-words">{value}</p>
    </div>
  );
}

function ContactEmailPhone({ label, email, phone }) {
  if (!email && !phone) return null;
  return (
    <div className="min-w-0">
      <p className={cn('text-[10px] font-semibold uppercase tracking-wide', TEXT_MUTED)}>{label}</p>
      {email && (
        <p className="text-sm font-medium text-neutral-900 break-all dark:text-neutral-50">{email}</p>
      )}
      {phone && <p className="text-sm text-neutral-700 dark:text-neutral-200">{phone}</p>}
    </div>
  );
}

function FinanceRow({ label, value, valueClassName }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className={TEXT_MUTED}>{label}</span>
      <span className={cn('font-semibold tabular-nums text-neutral-900 dark:text-neutral-100', valueClassName)}>
        {value}
      </span>
    </div>
  );
}

export function CustomerDetailSummary({
  customer,
  primarySite,
  billingAddressLines,
  accountManagerName,
  activeSubscriptions = [],
  monthlyRevenue,
  paymentInsights,
  defaultPaymentMethod,
  fmtMoney,
  nextInvoiceLabel,
  canWrite,
}) {
  const { t } = useTranslation('customers');
  const { t: tSub } = useTranslation('subscriptions');
  const navigate = useNavigate();

  const contactName = primarySite?.contact_name?.trim() || '';
  const email = customer?.email?.trim() || '';
  const phone = customer?.phone ? formatPhone(customer.phone) : '';
  const billing = billingAddressLines && billingAddressLines !== '—' ? billingAddressLines : '';
  const manager = accountManagerName?.trim() || '';

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <section className={cn(SURFACE, 'px-4 py-3 sm:px-5 sm:py-4')}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
            <ContactItem label={t('detail.profileLayout.primaryContact')} value={contactName} />
            <ContactEmailPhone
              label={t('detail.profileLayout.emailPhone')}
              email={email}
              phone={phone}
            />
            <ContactItem label={t('detail.profileLayout.billingAddress')} value={billing} />
            <ContactItem
              label={t('detail.profileLayout.accountManager')}
              value={manager || t('detail.profileLayout.noManager')}
            />
          </div>
      </section>

      <div className="grid w-full min-w-0 grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        {/* Subscriptions — 2/3 */}
        <section className={cn(SURFACE, 'min-w-0 p-4 sm:p-5 lg:col-span-2')}>
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-50">
              {t('detail.profileLayout.columnSubscriptions')}
            </h2>
            <span className="text-xs font-bold uppercase tracking-wide text-primary-600 dark:text-primary-400">
              {t('detail.profileLayout.servicesCount', { count: activeSubscriptions.length })}
            </span>
          </div>
          <div className="space-y-3">
            {activeSubscriptions.length === 0 ? (
              <p className={cn('text-sm', TEXT_MUTED)}>{t('detail.profileLayout.subscriptions.empty')}</p>
            ) : (
              activeSubscriptions.map((sub, idx) => {
                const Icon = SUB_ICONS[idx % SUB_ICONS.length];
                const freqKey = sub.billing_frequency;
                const freqLabel = freqKey ? tSub(`form.fields.${freqKey}`) : '—';
                const serviceLabel = sub.service_type
                  ? tSub(`serviceTypes.${sub.service_type}`, { defaultValue: sub.service_type })
                  : '';
                return (
                  <div
                    key={sub.id}
                    className="rounded-lg border border-neutral-200 bg-neutral-50/80 p-3 dark:border-[#333] dark:bg-[#1a1a1a]/80"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-neutral-900 dark:text-neutral-50">
                            {sub.site_name || sub.account_no || tSub('list.title')}
                          </p>
                          <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                            {[serviceLabel, freqLabel].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold tabular-nums text-neutral-900 dark:text-neutral-50">
                          {fmtMoney(sub.subtotal)}
                        </p>
                        <p className="text-[10px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                          {freqLabel}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 border-t border-neutral-200/80 pt-2 text-xs dark:border-[#333]">
                      <span className={TEXT_MUTED}>
                        {paymentInsights?.earliestPendingMonth
                          ? t('detail.profileLayout.subscriptions.nextDue', {
                              date: formatDate(paymentInsights.earliestPendingMonth),
                            })
                          : t('detail.profileLayout.subscriptions.nextDueUnknown')}
                      </span>
                      {canWrite && (
                        <button
                          type="button"
                          onClick={() => navigate(`/subscriptions/${sub.id}`)}
                          className="font-semibold text-primary-600 dark:text-primary-400"
                        >
                          {t('detail.profileLayout.financial.manageSubscription')}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Financial — 1/3 single card */}
        <section className={cn(SURFACE, 'min-w-0 p-4 sm:p-5')}>
          <h2 className="mb-3 text-base font-bold text-neutral-900 dark:text-neutral-50">
            {t('detail.profileLayout.columnFinancial')}
          </h2>
          {canWrite ? (
            <div className="space-y-1">
              <FinanceRow
                label={t('detail.profileLayout.financial.monthlyBilling')}
                value={
                  <>
                    {fmtMoney(monthlyRevenue)}
                    <span className="ml-1 text-xs font-normal text-neutral-500 dark:text-neutral-400">
                      {t('detail.profileLayout.financial.perMonth')}
                    </span>
                  </>
                }
              />
              <p className={cn('pb-2 text-xs', TEXT_MUTED)}>{nextInvoiceLabel}</p>
              <FinanceRow
                label={t('detail.profileLayout.financial.pendingBalance')}
                value={fmtMoney(paymentInsights?.overdueTotal || 0)}
                valueClassName={
                  (paymentInsights?.overdueTotal || 0) > 0
                    ? 'text-error-600 dark:text-error-400'
                    : undefined
                }
              />
              <FinanceRow
                label={t('detail.profileLayout.financial.primaryPayment')}
                value={
                  defaultPaymentMethod
                    ? `${(defaultPaymentMethod.method_type || '').toUpperCase()}${defaultPaymentMethod.card_last4 ? ` •••• ${defaultPaymentMethod.card_last4}` : ''}`
                    : t('detail.profileLayout.financial.noPaymentMethod')
                }
              />
              <Button
                variant="outline"
                size="sm"
                className="mt-4 w-full rounded-lg"
                onClick={() => navigate('/subscriptions/collection')}
              >
                {t('detail.profileLayout.financial.payBalance')}
              </Button>
            </div>
          ) : (
            <p className={cn('text-sm', TEXT_MUTED)}>—</p>
          )}
        </section>
      </div>
    </div>
  );
}
