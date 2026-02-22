import { useTranslation } from 'react-i18next';
import { CheckCircle2, Clock, Wifi, AlertTriangle, Phone, Mail, MapPin, FileText } from 'lucide-react';
import { Card, Button } from '../../../components/ui';
import { formatPhone } from '../../../lib/utils';
import { CustomerMetricCard } from '../components/CustomerMetricCard';
import { CustomerAlertItem } from '../components/CustomerAlertItem';
import { RecentWorkOrderRow } from '../components/RecentWorkOrderRow';
import { LocationSummaryCard } from '../components/LocationSummaryCard';
import { ContactRow } from '../components/ContactRow';

const MAX_RECENT_WORK_ORDERS = 5;
const MAX_LOCATION_SUMMARY = 6;

export function CustomerOverviewTab({
  customer,
  sites = [],
  workOrders = [],
  assets = [],
  counts = {},
  subscriptionsBySite = {},
  onTabSwitch,
  navigate,
}) {
  const { t } = useTranslation('customers');

  // Calculated
  const recentWorkOrders = workOrders.slice(0, MAX_RECENT_WORK_ORDERS);
  const visibleSites = sites.slice(0, MAX_LOCATION_SUMMARY);

  const registrationDate = customer.created_at
    ? new Date(customer.created_at).toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '—';

  const fullAddress = [customer.address, customer.district, customer.city]
    .filter(Boolean)
    .join(', ');

  const mapsHref = fullAddress
    ? `https://maps.google.com/?q=${encodeURIComponent(fullAddress)}`
    : null;

  const infoRows = [
    { label: t('detail.overview.customerInfo.customerNo'), value: customer.account_number || '—' },
    { label: t('form.fields.taxNumber'), value: customer.tax_number || '—' },
    { label: t('detail.overview.customerInfo.registrationDate'), value: registrationDate },
    { label: t('detail.overview.customerInfo.totalLocations'), value: String(sites.length) },
    { label: t('detail.overview.customerInfo.totalEquipment'), value: String(assets.length) },
  ];

  return (
    <div className="space-y-6">
      {/* ── 1. Metrik Kartlar ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <CustomerMetricCard
          icon={CheckCircle2}
          label={t('detail.overview.metrics.activeSubscriptions')}
          value={counts.activeSubscriptions ?? 0}
          variant="success"
        />
        <CustomerMetricCard
          icon={Clock}
          label={t('detail.overview.metrics.openWorkOrders')}
          value={counts.openWorkOrders ?? 0}
          variant="info"
        />
        <CustomerMetricCard
          icon={Wifi}
          label={t('detail.overview.metrics.activeSimCards')}
          value={counts.activeSimCards ?? 0}
          variant="default"
        />
        <CustomerMetricCard
          icon={AlertTriangle}
          label={t('detail.overview.metrics.faultyEquipment')}
          value={counts.faultyEquipment ?? 0}
          variant={counts.faultyEquipment > 0 ? 'error' : 'default'}
        />
      </div>

      {/* ── 2. Uyarılar ── */}
      {counts.faultyEquipment > 0 && (
        <CustomerAlertItem count={counts.faultyEquipment} />
      )}

      {/* ── 3. Son İş Emirleri ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            {t('detail.overview.recentWorkOrders.title')}
          </h2>
          {workOrders.length > MAX_RECENT_WORK_ORDERS && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onTabSwitch('workOrders')}
              className="text-primary-600 dark:text-primary-400 text-xs"
            >
              {t('detail.overview.recentWorkOrders.viewAll')}
            </Button>
          )}
        </div>
        <div className="rounded-xl border border-neutral-200 dark:border-[#262626] bg-white dark:bg-[#171717] overflow-hidden divide-y divide-neutral-100 dark:divide-[#262626]">
          {recentWorkOrders.length > 0 ? (
            recentWorkOrders.map(wo => (
              <RecentWorkOrderRow
                key={wo.id}
                workOrder={wo}
                onClick={() => navigate(`/work-orders/${wo.id}`)}
              />
            ))
          ) : (
            <p className="px-4 py-6 text-sm text-neutral-400 dark:text-neutral-500 italic text-center">
              {t('detail.overview.recentWorkOrders.empty')}
            </p>
          )}
        </div>
      </div>

      {/* ── 4. Lokasyon Özeti ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            {t('detail.overview.locationSummary.title')}
          </h2>
          {sites.length > MAX_LOCATION_SUMMARY && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onTabSwitch('locations')}
              className="text-primary-600 dark:text-primary-400 text-xs"
            >
              {t('detail.overview.locationSummary.viewAll')}
            </Button>
          )}
        </div>
        {visibleSites.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleSites.map(site => {
              const subs = subscriptionsBySite[site.id] || [];
              const primary = subs.find(s => s.status === 'active') || subs[0];
              return (
                <LocationSummaryCard
                  key={site.id}
                  site={site}
                  subscription={primary}
                  onClick={() => onTabSwitch('locations')}
                />
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-neutral-400 dark:text-neutral-500 italic py-2">
            {t('detail.overview.locationSummary.empty')}
          </p>
        )}
      </div>

      {/* ── 5. Müşteri Bilgileri + İletişim + Notlar (2-col on lg+) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sol: Müşteri Bilgileri + İletişim */}
        <div className="space-y-6">
          {/* Müşteri Bilgileri */}
          <Card padding="compact">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 mb-4">
              {t('detail.overview.customerInfo.title')}
            </h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              {infoRows.map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-[10px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-wider">
                    {label}
                  </dt>
                  <dd className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 mt-0.5 truncate">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>

          {/* İletişim */}
          <Card padding="compact">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 mb-3">
              {t('detail.overview.contact.title')}
            </h2>
            <div className="space-y-2">
              {customer.phone && (
                <ContactRow
                  icon={Phone}
                  iconBgClass="bg-success-50 dark:bg-success-950/20"
                  iconColorClass="text-success-600 dark:text-success-400"
                  label={t('detail.overview.contact.phone1')}
                  value={formatPhone(customer.phone)}
                  href={`tel:${customer.phone.replace(/\s/g, '')}`}
                />
              )}
              {customer.phone_secondary && (
                <ContactRow
                  icon={Phone}
                  iconBgClass="bg-success-50 dark:bg-success-950/20"
                  iconColorClass="text-success-600 dark:text-success-400"
                  label={t('detail.overview.contact.phone2')}
                  value={formatPhone(customer.phone_secondary)}
                  href={`tel:${customer.phone_secondary.replace(/\s/g, '')}`}
                  showExternalIcon
                />
              )}
              {customer.email && (
                <ContactRow
                  icon={Mail}
                  iconBgClass="bg-primary-50 dark:bg-primary-950/20"
                  iconColorClass="text-primary-600 dark:text-primary-400"
                  label={t('detail.overview.contact.email')}
                  value={customer.email}
                  href={`mailto:${customer.email}`}
                />
              )}
              {fullAddress && (
                <ContactRow
                  icon={MapPin}
                  iconBgClass="bg-violet-50 dark:bg-violet-950/20"
                  iconColorClass="text-violet-600 dark:text-violet-400"
                  label={t('detail.overview.contact.address')}
                  value={fullAddress}
                  href={mapsHref}
                  showExternalIcon={!!mapsHref}
                />
              )}
              {!customer.phone && !customer.phone_secondary && !customer.email && !fullAddress && (
                <p className="text-sm text-neutral-400 dark:text-neutral-500 italic py-2">
                  {t('detail.noContactInfo')}
                </p>
              )}
            </div>
          </Card>
        </div>

        {/* Sağ: Notlar */}
        <Card padding="compact" className="h-fit">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
              {t('detail.notes')}
            </h2>
          </div>
          {customer.notes ? (
            <p className="text-sm text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap leading-relaxed">
              {customer.notes}
            </p>
          ) : (
            <p className="text-sm text-neutral-400 dark:text-neutral-500 italic">
              {t('detail.noNotes')}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
