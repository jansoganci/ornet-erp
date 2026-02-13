import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CreditCard, ArrowLeft, StickyNote } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/layout';
import {
  Button,
  Select,
  Table,
  Badge,
  Card,
  Input,
  EmptyState,
  ErrorState,
  Spinner,
  IconButton,
} from '../../components/ui';
import { formatDate } from '../../lib/utils';
import { useSubscriptions, useCurrentProfile, useBulkUpdateSubscriptionPrices } from './hooks';
import { RevisionNotesModal } from './components/RevisionNotesModal';
import { SERVICE_TYPES, BILLING_FREQUENCIES } from './schema';

function toNum(val, defaultVal = 0) {
  if (val === '' || val === undefined || val === null) return defaultVal;
  const n = Number(val);
  return Number.isNaN(n) ? defaultVal : n;
}

export function PriceRevisionPage() {
  const { t } = useTranslation(['subscriptions', 'common']);
  const navigate = useNavigate();
  const { data: currentProfile } = useCurrentProfile();
  const isAdmin = currentProfile?.role === 'admin';

  const [serviceType, setServiceType] = useState('all');
  const [billingFrequency, setBillingFrequency] = useState('all');
  const [startMonth, setStartMonth] = useState('');
  const [editsById, setEditsById] = useState({});
  const [notesModalSubscription, setNotesModalSubscription] = useState(null);

  const filters = useMemo(() => {
    const f = {
      service_type: serviceType === 'all' ? undefined : serviceType,
      billing_frequency: billingFrequency === 'all' ? undefined : billingFrequency,
    };
    if (billingFrequency === 'yearly' || billingFrequency === '6_month') {
      const monthNum = startMonth === '' || startMonth === 'all' ? null : Number(startMonth);
      if (monthNum >= 1 && monthNum <= 12) f.start_month = monthNum;
    }
    return f;
  }, [serviceType, billingFrequency, startMonth]);

  const { data: subscriptions = [], isLoading, error, refetch } = useSubscriptions(filters);
  const bulkUpdateMutation = useBulkUpdateSubscriptionPrices();

  const displayRows = useMemo(
    () => subscriptions.map((row) => ({ ...row, ...editsById[row.id] })),
    [subscriptions, editsById]
  );

  const updateEdit = (id, field, value) => {
    setEditsById((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value === '' ? '' : value },
    }));
  };

  const handleSaveClick = () => {
    const payload = Object.keys(editsById).map((id) => {
      const row = subscriptions.find((s) => s.id === id);
      const merged = row ? { ...row, ...editsById[id] } : { ...editsById[id], id };
      return {
        id,
        base_price: toNum(merged.base_price, 0),
        sms_fee: toNum(merged.sms_fee, 0),
        line_fee: toNum(merged.line_fee, 0),
        vat_rate: toNum(merged.vat_rate, 20),
        cost: toNum(merged.cost, 0),
      };
    });
    if (payload.length === 0) return;
    bulkUpdateMutation.mutate(payload, {
      onSuccess: () => setEditsById({}),
    });
  };

  const hasEdits = Object.keys(editsById).length > 0;

  if (!isAdmin) {
    return (
      <PageContainer>
        <PageHeader title={t('subscriptions:priceRevision.title')} />
        <Card className="p-8 text-center space-y-4">
          <p className="text-neutral-600 dark:text-neutral-400">
            {t('subscriptions:priceRevision.unauthorized')}
          </p>
          <Button variant="outline" onClick={() => navigate('/subscriptions')} leftIcon={<ArrowLeft className="w-4 h-4" />}>
            {t('common:actions.back')}
          </Button>
        </Card>
      </PageContainer>
    );
  }

  const serviceTypeOptions = [
    { value: 'all', label: t('subscriptions:priceRevision.filters.all') },
    ...SERVICE_TYPES.map((st) => ({
      value: st,
      label: t(`subscriptions:serviceTypes.${st}`),
    })),
  ];

  const billingFrequencyOptions = [
    { value: 'all', label: t('subscriptions:priceRevision.filters.all') },
    { value: 'monthly', label: t('subscriptions:priceRevision.filters.monthly') },
    { value: '6_month', label: t('subscriptions:priceRevision.filters.6_month') },
    { value: 'yearly', label: t('subscriptions:priceRevision.filters.yearly') },
  ];

  const startMonthOptions = [
    { value: 'all', label: t('subscriptions:priceRevision.filters.all') },
    ...Array.from({ length: 12 }, (_, i) => ({
      value: String(i + 1),
      label: t(`subscriptions:priceRevision.filters.months.${i + 1}`),
    })),
  ];

  const columns = [
    {
      header: t('subscriptions:priceRevision.columns.customer'),
      accessor: 'company_name',
      render: (value, row) => (
        <div className="min-w-[120px]">
          <p className="font-medium text-neutral-900 dark:text-neutral-100 truncate">{value}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{row.site_name}</p>
        </div>
      ),
    },
    {
      header: t('subscriptions:priceRevision.columns.accountNo'),
      accessor: 'account_no',
      render: (value) => (
        <span className="font-mono text-sm text-neutral-600 dark:text-neutral-400">{value || '—'}</span>
      ),
    },
    {
      header: t('subscriptions:priceRevision.columns.startDate'),
      accessor: 'start_date',
      render: (value) => <span className="text-sm whitespace-nowrap">{formatDate(value)}</span>,
    },
    {
      header: t('subscriptions:priceRevision.columns.type'),
      accessor: 'subscription_type',
      render: (value) => (
        <Badge variant="outline" size="sm">
          {t(`subscriptions:types.${value}`)}
        </Badge>
      ),
    },
    {
      header: t('subscriptions:priceRevision.columns.serviceType'),
      accessor: 'service_type',
      render: (value) => (
        <span className="text-sm text-neutral-700 dark:text-neutral-300">
          {value ? t(`subscriptions:serviceTypes.${value}`) : '—'}
        </span>
      ),
    },
    {
      header: t('subscriptions:priceRevision.columns.billingFrequency'),
      accessor: 'billing_frequency',
      render: (value) => (
        <span className="text-sm">
          {t(`subscriptions:priceRevision.filters.${value || 'monthly'}`)}
        </span>
      ),
    },
    {
      header: t('subscriptions:priceRevision.columns.pricing'),
      accessor: 'base_price',
      align: 'right',
      render: (_, row) => (
        <div className="space-y-2 min-w-[140px]" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500 dark:text-neutral-400 w-20 shrink-0">
              {t('subscriptions:priceRevision.columns.basePrice')}
            </span>
            <Input
              type="number"
              min={0}
              step={0.01}
              size="sm"
              className="w-24"
              value={row.base_price ?? ''}
              onChange={(e) => updateEdit(row.id, 'base_price', e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              onKeyUp={(e) => e.stopPropagation()}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500 dark:text-neutral-400 w-20 shrink-0">
              {t('subscriptions:priceRevision.columns.smsFee')}
            </span>
            <Input
              type="number"
              min={0}
              step={0.01}
              size="sm"
              className="w-24"
              value={row.sms_fee ?? ''}
              onChange={(e) => updateEdit(row.id, 'sms_fee', e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              onKeyUp={(e) => e.stopPropagation()}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500 dark:text-neutral-400 w-20 shrink-0">
              {t('subscriptions:priceRevision.columns.lineFee')}
            </span>
            <Input
              type="number"
              min={0}
              step={0.01}
              size="sm"
              className="w-24"
              value={row.line_fee ?? ''}
              onChange={(e) => updateEdit(row.id, 'line_fee', e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              onKeyUp={(e) => e.stopPropagation()}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500 dark:text-neutral-400 w-20 shrink-0">
              {t('subscriptions:priceRevision.columns.vatRate')}
            </span>
            <Input
              type="number"
              min={0}
              max={100}
              step={0.01}
              size="sm"
              className="w-24"
              value={row.vat_rate ?? ''}
              onChange={(e) => updateEdit(row.id, 'vat_rate', e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              onKeyUp={(e) => e.stopPropagation()}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500 dark:text-neutral-400 w-20 shrink-0">
              {t('subscriptions:priceRevision.columns.cost')}
            </span>
            <Input
              type="number"
              min={0}
              step={0.01}
              size="sm"
              className="w-24"
              value={row.cost ?? ''}
              onChange={(e) => updateEdit(row.id, 'cost', e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              onKeyUp={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      ),
    },
    {
      header: t('subscriptions:priceRevision.columns.notesColumn'),
      accessor: 'id',
      render: (_, row) => (
        <IconButton
          icon={StickyNote}
          size="sm"
          variant="ghost"
          aria-label={t('subscriptions:priceRevision.notes.title')}
          onClick={(e) => {
            e.stopPropagation();
            setNotesModalSubscription({ id: row.id, company_name: row.company_name, site_name: row.site_name });
          }}
        />
      ),
    },
  ];

  return (
    <PageContainer maxWidth="xl" padding="default" className="space-y-6">
      <PageHeader
        title={t('subscriptions:priceRevision.title')}
        actions={
          <Button
            variant="primary"
            onClick={handleSaveClick}
            disabled={!hasEdits || bulkUpdateMutation.isPending}
            loading={bulkUpdateMutation.isPending}
          >
            {t('subscriptions:priceRevision.saveButton')}
          </Button>
        }
      />

      <Card className="p-4 border-neutral-200/60 dark:border-neutral-800/60">
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
          {t('subscriptions:priceRevision.filters.title')}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 flex-wrap items-start">
          <div className="w-full sm:w-auto min-w-[200px]">
            <Select
              label={t('subscriptions:priceRevision.filters.serviceType')}
              options={serviceTypeOptions}
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              size="sm"
            />
          </div>
          <div className="w-full sm:w-auto min-w-[200px]">
            <Select
              label={t('subscriptions:priceRevision.filters.billingFrequency')}
              options={billingFrequencyOptions}
              value={billingFrequency}
              onChange={(e) => setBillingFrequency(e.target.value)}
              size="sm"
            />
          </div>
          {(billingFrequency === 'yearly' || billingFrequency === '6_month') && (
            <div className="w-full sm:w-auto min-w-[200px]">
              <Select
                label={t('subscriptions:priceRevision.filters.startMonth')}
                options={startMonthOptions}
                value={startMonth || 'all'}
                onChange={(e) => setStartMonth(e.target.value === 'all' ? '' : e.target.value)}
                size="sm"
              />
            </div>
          )}
        </div>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : displayRows.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title={t('subscriptions:priceRevision.empty.title')}
          description={t('subscriptions:priceRevision.empty.description')}
        />
      ) : (
        <div className="bg-white dark:bg-[#171717] rounded-2xl border border-neutral-200 dark:border-[#262626] overflow-hidden shadow-sm">
          <Table
            columns={columns}
            data={displayRows}
            keyExtractor={(item) => item.id}
            loading={false}
            emptyMessage={t('subscriptions:priceRevision.empty.title')}
            className="border-none"
          />
        </div>
      )}

      <RevisionNotesModal
        open={!!notesModalSubscription}
        onClose={() => setNotesModalSubscription(null)}
        subscription={notesModalSubscription}
      />
    </PageContainer>
  );
}
