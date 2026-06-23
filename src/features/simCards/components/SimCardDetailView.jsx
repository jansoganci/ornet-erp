import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  CreditCard,
  History,
  MapPin,
  PencilLine,
  Signal,
  StickyNote,
  UserCheck,
} from 'lucide-react';
import { Badge, Button, Card, EmptyState } from '../../../components/ui';
import { cn, formatCurrency, formatDateTime, formatPhone } from '../../../lib/utils';
import { useSimCardHistory } from '../hooks';
import { fetchActiveStaticIp, fetchStaticIpHistory } from '../staticIpApi';

const SURFACE_CARD = 'rounded-2xl border border-neutral-200/80 bg-white shadow-sm dark:border-[#262626] dark:bg-[#171717]';
const VALUE_EMPTY = 'text-neutral-400 dark:text-neutral-500';

function statusBadgeVariant(status) {
  if (status === 'active') return 'success';
  if (status === 'subscription') return 'primary';
  if (status === 'cancelled') return 'error';
  return 'warning';
}

function buildSiteLabel(site, fallback) {
  if (!site) return fallback;
  const parts = [site.site_name, site.address, site.district, site.city].filter(Boolean);
  return parts.join(', ') || fallback;
}

function buildHistoryDetail(entry, t) {
  if (entry?.notes) return entry.notes;

  if (entry?.old_status || entry?.new_status) {
    const before = entry.old_status ? t(`simCards:status.${entry.old_status}`) : t('simCards:detail.emptyValue');
    const after = entry.new_status ? t(`simCards:status.${entry.new_status}`) : t('simCards:detail.emptyValue');
    return `${before} → ${after}`;
  }

  if (entry?.new_site_id || entry?.old_site_id || entry?.new_customer_id || entry?.old_customer_id) {
    return t('simCards:history.assignment');
  }

  return t('simCards:detail.system');
}

function DetailField({ label, value, mono = false, valueClassName }) {
  const displayValue = value || null;

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      <p
        className={cn(
          'text-sm font-medium text-neutral-900 dark:text-neutral-100 md:text-[15px]',
          mono && 'font-mono tracking-tight',
          !displayValue && VALUE_EMPTY,
          valueClassName
        )}
      >
        {displayValue || '—'}
      </p>
    </div>
  );
}

function SectionCard({ icon: Icon, title, children, className }) {
  return (
    <Card className={cn(SURFACE_CARD, 'overflow-hidden', className)}>
      <div className="flex items-center gap-3 border-b border-neutral-200/80 px-5 py-4 dark:border-[#262626]">
        <div className="rounded-xl bg-neutral-100 p-2 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
          <Icon className="h-4 w-4" />
        </div>
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
          {title}
        </h2>
      </div>
      <div className="p-5">{children}</div>
    </Card>
  );
}

export function SimCardDetailView({ simCard, site, onBack, onEdit }) {
  const { t } = useTranslation(['simCards', 'common']);
  const { data: history = [], isLoading: historyLoading } = useSimCardHistory(simCard?.id);
  const { data: activeStaticIp, isLoading: activeStaticIpLoading } = useQuery({
    queryKey: ['simCards', simCard?.id, 'staticIp', 'active'],
    queryFn: () => fetchActiveStaticIp(simCard.id),
    enabled: !!simCard?.id,
  });
  const { data: staticIpHistory = [], isLoading: staticIpHistoryLoading } = useQuery({
    queryKey: ['simCards', simCard?.id, 'staticIp', 'history'],
    queryFn: () => fetchStaticIpHistory(simCard.id),
    enabled: !!simCard?.id,
  });

  const summaryItems = [
    {
      label: t('simCards:form.phoneNumber'),
      value: formatPhone(simCard?.phone_number) || simCard?.phone_number,
      mono: true,
    },
    {
      label: t('simCards:list.columns.status'),
      value: (
        <Badge variant={statusBadgeVariant(simCard?.status)} size="lg">
          {t(`simCards:status.${simCard?.status}`)}
        </Badge>
      ),
    },
    {
      label: t('simCards:list.columns.customer'),
      value: simCard?.customers?.company_name,
    },
    {
      label: t('simCards:list.columns.provider'),
      value: simCard?.provider_company?.name || t('simCards:detail.emptyValue'),
    },
    {
      label: t('simCards:form.costPrice'),
      value: formatCurrency(simCard?.cost_price ?? 0, simCard?.currency || 'TRY'),
    },
    {
      label: t('simCards:form.salePrice'),
      value: formatCurrency(simCard?.sale_price ?? 0, simCard?.currency || 'TRY'),
    },
  ];

  const historyItems = history.slice(0, 5);
  const locationLabel = buildSiteLabel(site, t('simCards:detail.locationUnknown'));
  const hasNotes = Boolean(simCard?.notes?.trim());
  const activeIpLabel = activeStaticIp?.ip_address || t('simCards:staticIp.noIp');

  return (
    <PageShell
      title={t('simCards:detail.title')}
      backLabel={t('simCards:list.title')}
      status={simCard?.status ? t(`simCards:status.${simCard.status}`) : null}
      statusVariant={statusBadgeVariant(simCard?.status)}
      onBack={onBack}
      onEdit={onEdit}
      editLabel={t('simCards:actions.edit')}
    >
      <Card className={cn(SURFACE_CARD, 'overflow-hidden')}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 px-5 py-5 md:grid-cols-3 xl:grid-cols-6 xl:gap-x-8">
          {summaryItems.map((item) => (
            <div key={item.label} className="min-w-0 space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">
                {item.label}
              </p>
              <div className={cn('min-w-0 text-sm font-semibold text-neutral-950 dark:text-neutral-50 md:text-[15px]', item.mono && 'font-mono tracking-tight')}>
                {typeof item.value === 'string' ? <span className="block truncate">{item.value}</span> : item.value}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <div className="space-y-5">
          <SectionCard icon={UserCheck} title={t('simCards:form.sections.assignment')}>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <DetailField label={t('simCards:list.columns.customer')} value={simCard?.customers?.company_name} />
              <DetailField label={t('simCards:form.customerLabel')} value={simCard?.customer_label} />
              <DetailField label={t('simCards:form.accountNo')} value={simCard?.account_no} mono />
              <DetailField label={t('simCards:list.columns.site')} value={locationLabel} />
            </div>
          </SectionCard>

          <SectionCard icon={Signal} title={t('simCards:form.sections.technical')}>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <DetailField label={t('simCards:form.imsi')} value={simCard?.imsi} mono />
              <DetailField label={t('simCards:form.gprsSerialNo')} value={simCard?.gprs_serial_no} mono />
              <DetailField label={t('simCards:staticIp.title')} value={activeStaticIpLoading ? '...' : activeIpLabel} mono />
              <DetailField label={t('simCards:form.capacity')} value={simCard?.capacity} />
            </div>
          </SectionCard>
        </div>

        <div className="space-y-5">
          <SectionCard icon={CreditCard} title={t('simCards:form.sections.financial')}>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <DetailField label={t('simCards:form.costPrice')} value={formatCurrency(simCard?.cost_price ?? 0, simCard?.currency || 'TRY')} />
              <DetailField label={t('simCards:form.salePrice')} value={formatCurrency(simCard?.sale_price ?? 0, simCard?.currency || 'TRY')} />
              <DetailField label={t('simCards:form.vatRate')} value={simCard?.vat_rate != null ? `%${simCard.vat_rate}` : null} />
              <DetailField label={t('common:fields.currency')} value={t(`common:currencies.${simCard?.currency || 'TRY'}`)} />
            </div>
          </SectionCard>

          <SectionCard icon={StickyNote} title={t('simCards:form.sections.notesHistory')}>
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">
                  {t('simCards:form.notes')}
                </p>
                <div className="rounded-2xl border border-neutral-200/80 bg-neutral-50/80 px-4 py-3 text-sm leading-6 text-neutral-700 dark:border-[#303030] dark:bg-neutral-900/60 dark:text-neutral-300">
                  {hasNotes ? simCard.notes : t('simCards:detail.noNotes')}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-neutral-400" />
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">
                    {t('simCards:history.title')}
                  </p>
                </div>
                {historyLoading ? (
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">...</p>
                ) : historyItems.length === 0 ? (
                  <EmptyState
                    className="p-6"
                    title={t('simCards:detail.noHistory')}
                    description={t('simCards:detail.noHistoryDescription')}
                  />
                ) : (
                  <div className="space-y-3">
                    {historyItems.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-2xl border border-neutral-200/80 px-4 py-3 dark:border-[#303030]"
                      >
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                            {t(`simCards:history.${entry.action}`, { defaultValue: entry.action })}
                          </p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            {formatDateTime(entry.created_at)}
                          </p>
                        </div>
                        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                          {buildHistoryDetail(entry, t)}
                        </p>
                        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                          {entry.profiles?.full_name || t('simCards:detail.system')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-neutral-400" />
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">
                    {t('simCards:staticIp.history')}
                  </p>
                </div>
                {staticIpHistoryLoading ? (
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">...</p>
                ) : staticIpHistory.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-neutral-200 px-4 py-3 text-sm text-neutral-500 dark:border-[#303030] dark:text-neutral-400">
                    {t('simCards:staticIp.noIp')}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {staticIpHistory.slice(0, 3).map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-start justify-between gap-4 rounded-2xl border border-neutral-200/80 px-4 py-3 dark:border-[#303030]"
                      >
                        <div>
                          <p className="font-mono text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                            {entry.ip_address}
                          </p>
                          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            {formatDateTime(entry.activated_at)}
                          </p>
                        </div>
                        {entry.cancelled_at && (
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            {formatDateTime(entry.cancelled_at)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </PageShell>
  );
}

function PageShell({
  title,
  backLabel,
  status,
  statusVariant,
  onBack,
  onEdit,
  editLabel,
  children,
}) {
  return (
    <div className="space-y-5 pb-16">
      <div className="space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </button>

        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-3xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
                {title}
              </h1>
              {status && (
                <Badge variant={statusVariant} size="lg">
                  {status}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="primary" onClick={onEdit} leftIcon={<PencilLine className="h-4 w-4" />}>
              {editLabel}
            </Button>
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}
