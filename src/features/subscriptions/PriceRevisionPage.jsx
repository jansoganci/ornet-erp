import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as XLSX from 'xlsx';
import { CreditCard, ArrowLeft, StickyNote, Copy, Check, Download } from 'lucide-react';
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
  TableSkeleton,
} from '../../components/ui';
import { formatDate, formatCurrency } from '../../lib/utils';
import { useSubscriptions, useCurrentProfile, useBulkUpdateSubscriptionPrices } from './hooks';
import { RevisionNotesModal } from './components/RevisionNotesModal';
import { SERVICE_TYPES, BILLING_FREQUENCIES } from './schema';

function toNum(val, defaultVal = 0) {
  if (val === '' || val === undefined || val === null) return defaultVal;
  const n = Number(val);
  return Number.isNaN(n) ? defaultVal : n;
}

function formatForMessage(n) {
  return Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '₺';
}

function buildPriceRevisionMessage(originalRow, displayRow, messageMonth, t) {
  if (!originalRow || !displayRow) return null;
  const oldBase = toNum(originalRow.base_price, 0);
  const oldSms = toNum(originalRow.sms_fee, 0);
  const oldLine = toNum(originalRow.line_fee, 0);
  const newBase = toNum(displayRow.base_price, 0);
  const newSms = toNum(displayRow.sms_fee, 0);
  const newLine = toNum(displayRow.line_fee, 0);
  if (oldBase === newBase && oldSms === newSms && oldLine === newLine) return null;
  const serviceLabel = originalRow.service_type
    ? (t(`subscriptions:priceRevision.serviceLabelsForMessage.${originalRow.service_type}`) || 'Abonelik')
    : 'Abonelik';
  const frequencyLabel =
    t(`subscriptions:priceRevision.frequencyLabelsForMessage.${originalRow.billing_frequency || 'monthly'}`) || 'aylık';
  const monthLabel = t(`subscriptions:priceRevision.filters.months.${messageMonth}`);
  const lines = [];
  if (oldBase !== newBase && (oldBase > 0 || newBase > 0)) {
    lines.push(
      t('subscriptions:priceRevision.messageTemplate.basePrice') + `: ${formatForMessage(oldBase)}'den ${formatForMessage(newBase)}'ye`
    );
  }
  if (oldSms !== newSms && (oldSms > 0 || newSms > 0)) {
    lines.push(
      t('subscriptions:priceRevision.messageTemplate.smsFee') + `: ${formatForMessage(oldSms)}'den ${formatForMessage(newSms)}'ye`
    );
  }
  if (oldLine !== newLine && (oldLine > 0 || newLine > 0)) {
    lines.push(
      t('subscriptions:priceRevision.messageTemplate.simFee') + `: ${formatForMessage(oldLine)}'den ${formatForMessage(newLine)}'ye`
    );
  }
  const hasUnchanged = (oldBase === newBase && (oldBase > 0 || newBase > 0)) ||
    (oldSms === newSms && (oldSms > 0 || newSms > 0)) ||
    (oldLine === newLine && (oldLine > 0 || newLine > 0));
  if (hasUnchanged && lines.length > 0) {
    lines.push(t('subscriptions:priceRevision.messageTemplate.unchangedParts'));
  }
  const oldTotal = oldBase + oldSms + oldLine;
  const newTotal = newBase + newSms + newLine;
  lines.push(
    t('subscriptions:priceRevision.messageTemplate.total') + `: ${formatForMessage(oldTotal)}'den ${formatForMessage(newTotal)}'ye`
  );
  const intro = t('subscriptions:priceRevision.messageTemplate.intro', {
    service: serviceLabel,
    frequency: frequencyLabel,
    month: monthLabel,
  });
  const closing = t('subscriptions:priceRevision.messageTemplate.closing', { month: monthLabel });
  return `${t('subscriptions:priceRevision.messageTemplate.greeting')} ${intro}\n• ${lines.join('\n• ')}\n\n${closing}`;
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
  const [messageMonth, setMessageMonth] = useState(() => new Date().getMonth() + 1);
  const [copiedId, setCopiedId] = useState(null);

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

  const handleZamPercentChange = (id, value) => {
    const original = subscriptions.find((s) => s.id === id);
    const orijinalBase = original?.base_price ?? 0;
    if (value === '' || value === null || value === undefined || Number(value) === 0) {
      setEditsById((prev) => {
        const next = { ...prev[id] };
        delete next.zam_percent;
        delete next.base_price;
        if (Object.keys(next).length === 0) {
          const rest = { ...prev };
          delete rest[id];
          return rest;
        }
        return { ...prev, [id]: next };
      });
      return;
    }
    const zp = Number(value);
    const yeniBase = orijinalBase * (1 + zp / 100);
    setEditsById((prev) => ({
      ...prev,
      [id]: { ...prev[id], zam_percent: zp, base_price: yeniBase },
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

  const handleExportExcel = () => {
    if (!displayRows.length) return;
    const exportData = displayRows.map((row) => {
      const base = toNum(row.base_price, 0);
      const sms = toNum(row.sms_fee, 0);
      const line = toNum(row.line_fee, 0);
      const total = base + sms + line;
      return {
        [t('subscriptions:priceRevision.columns.customer')]: row.company_name || '',
        [t('subscriptions:priceRevision.columns.site')]: row.site_name || '',
        [t('subscriptions:priceRevision.columns.accountNo')]: row.account_no || '',
        [t('subscriptions:priceRevision.columns.startDate')]: formatDate(row.start_date),
        [t('subscriptions:priceRevision.columns.type')]: row.subscription_type ? t(`subscriptions:types.${row.subscription_type}`) : '',
        [t('subscriptions:priceRevision.columns.serviceType')]: row.service_type ? t(`subscriptions:serviceTypes.${row.service_type}`) : '',
        [t('subscriptions:priceRevision.columns.billingFrequency')]: t(`subscriptions:priceRevision.filters.${row.billing_frequency || 'monthly'}`),
        [t('subscriptions:priceRevision.zamPercent')]: row.zam_percent != null && row.zam_percent !== '' ? Number(row.zam_percent) : '',
        [t('subscriptions:priceRevision.columns.basePrice')]: base,
        [t('subscriptions:priceRevision.columns.smsFee')]: sms,
        [t('subscriptions:priceRevision.columns.lineFee')]: line,
        [t('subscriptions:priceRevision.columns.vatRate')]: toNum(row.vat_rate, 20),
        [t('subscriptions:priceRevision.columns.cost')]: toNum(row.cost, 0),
        [t('subscriptions:priceRevision.messageTemplate.total')]: total,
      };
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Fiyat Revizyonu');
    const fileName = `Fiyat_Revizyonu_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const hasEdits = Object.keys(editsById).length > 0;

  if (isLoading) {
    return (
      <PageContainer maxWidth="xl" padding="default">
        <PageHeader title={t('subscriptions:priceRevision.title')} />
        <div className="mt-6">
          <TableSkeleton cols={8} />
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer maxWidth="xl" padding="default">
        <PageHeader title={t('subscriptions:priceRevision.title')} />
        <ErrorState message={error.message} onRetry={refetch} />
      </PageContainer>
    );
  }

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
      header: t('subscriptions:priceRevision.columns.currentTotal'),
      accessor: 'base_price',
      align: 'right',
      render: (_, row) => {
        const base = toNum(row.base_price, 0);
        const sms = toNum(row.sms_fee, 0);
        const line = toNum(row.line_fee, 0);
        return (
          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 whitespace-nowrap">
            {formatCurrency(base + sms + line)}
          </span>
        );
      },
    },
    {
      header: t('subscriptions:priceRevision.columns.vatAmount'),
      accessor: 'vat_amount',
      align: 'right',
      render: (_, row) => {
        const base = toNum(row.base_price, 0);
        const sms = toNum(row.sms_fee, 0);
        const line = toNum(row.line_fee, 0);
        const vatRate = toNum(row.vat_rate, 20);
        const guncelTutar = base + sms + line;
        const kdvTutar = guncelTutar * (vatRate / 100);
        return (
          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 whitespace-nowrap">
            {formatCurrency(kdvTutar)}
          </span>
        );
      },
    },
    {
      header: t('subscriptions:priceRevision.columns.totalWithVat'),
      accessor: 'total_with_vat',
      align: 'right',
      render: (_, row) => {
        const base = toNum(row.base_price, 0);
        const sms = toNum(row.sms_fee, 0);
        const line = toNum(row.line_fee, 0);
        const vatRate = toNum(row.vat_rate, 20);
        const guncelTutar = base + sms + line;
        const kdvTutar = guncelTutar * (vatRate / 100);
        return (
          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 whitespace-nowrap">
            {formatCurrency(guncelTutar + kdvTutar)}
          </span>
        );
      },
    },
    {
      header: t('subscriptions:priceRevision.zamPercent'),
      accessor: 'zam_percent',
      align: 'center',
      render: (_, row) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Input
            type="number"
            min={0}
            step={0.01}
            placeholder={t('subscriptions:priceRevision.zamPercentPlaceholder')}
            size="sm"
            className="w-20 text-center mx-auto"
            value={row.zam_percent ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              handleZamPercentChange(row.id, val === '' ? '' : Number(val));
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
          />
        </div>
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
      header: t('subscriptions:priceRevision.messageColumn'),
      accessor: 'id',
      render: (_, row) => {
        const original = subscriptions.find((s) => s.id === row.id);
        const message = buildPriceRevisionMessage(original, row, messageMonth, t);
        if (!message) {
          return (
            <span className="text-xs text-neutral-400">
              {t('subscriptions:priceRevision.noPriceChange')}
            </span>
          );
        }
        return (
          <div className="flex items-start gap-2" onClick={(e) => e.stopPropagation()}>
            <div className="max-h-[80px] w-56 overflow-y-auto rounded border border-neutral-200 dark:border-[#262626] bg-neutral-50/50 dark:bg-neutral-900/30 p-2 text-xs text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
              {message}
            </div>
            <Button
              size="sm"
              variant={copiedId === row.id ? 'secondary' : 'outline'}
              className="shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(message);
                setCopiedId(row.id);
                setTimeout(() => setCopiedId(null), 2000);
              }}
              leftIcon={copiedId === row.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            >
              {copiedId === row.id ? t('subscriptions:priceRevision.copied') : t('subscriptions:priceRevision.copyMessage')}
            </Button>
          </div>
        );
      },
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
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleExportExcel}
              disabled={displayRows.length === 0}
              leftIcon={<Download className="w-4 h-4" />}
            >
              {t('subscriptions:priceRevision.exportExcel')}
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveClick}
              disabled={!hasEdits || bulkUpdateMutation.isPending}
              loading={bulkUpdateMutation.isPending}
            >
              {t('subscriptions:priceRevision.saveButton')}
            </Button>
          </div>
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
          <div className="w-full sm:w-auto min-w-[200px]">
            <Select
              label={t('subscriptions:priceRevision.messageAyLabel')}
              options={Array.from({ length: 12 }, (_, i) => ({
                value: String(i + 1),
                label: t(`subscriptions:priceRevision.filters.months.${i + 1}`),
              }))}
              value={String(messageMonth)}
              onChange={(e) => setMessageMonth(Number(e.target.value))}
              size="sm"
            />
          </div>
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
