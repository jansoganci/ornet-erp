import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as XLSX from 'xlsx';
import { CreditCard, ArrowLeft, StickyNote, Copy, Check, Download, AlertTriangle } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/layout';
import {
  Button,
  Select,
  Table,
  Badge,
  Card,
  Input,
  Modal,
  EmptyState,
  ErrorState,
  Spinner,
  IconButton,
  TableSkeleton,
} from '../../components/ui';
import {
  formatDate,
  formatCurrency,
  getPriceRevisionNetSubtotal,
  getPriceRevisionVatAmount,
  getPriceRevisionTotalWithVat,
} from '../../lib/utils';
import { useSubscriptions, useCurrentProfile, useBulkUpdateSubscriptionPrices } from './hooks';
import { RevisionNotesModal } from './components/RevisionNotesModal';
import { SERVICE_TYPES } from './schema';

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
  const oldSim = toNum(originalRow.sim_amount, 0);
  const newBase = toNum(displayRow.base_price, 0);
  const newSms = toNum(displayRow.sms_fee, 0);
  const newLine = toNum(displayRow.line_fee, 0);
  const newSim = toNum(displayRow.sim_amount, 0);
  if (oldBase === newBase && oldSms === newSms && oldLine === newLine && oldSim === newSim) {
    return null;
  }
  const serviceLabel = originalRow.service_type
    ? (t(`subscriptions:priceRevision.serviceLabelsForMessage.${originalRow.service_type}`) || 'Abonelik')
    : 'Abonelik';
  const frequencyLabel =
    t(`subscriptions:priceRevision.frequencyLabelsForMessage.${originalRow.billing_frequency || 'monthly'}`) || 'aylık';
  const monthLabel = t(`subscriptions:priceRevision.filters.months.${messageMonth}`);
  const lines = [];
  if (oldBase !== newBase && (oldBase > 0 || newBase > 0)) {
    lines.push(
      `${t('subscriptions:priceRevision.messageTemplate.basePrice')}: ${formatForMessage(oldBase)}'den ${formatForMessage(newBase)}'ye`
    );
  }
  if (oldSms !== newSms && (oldSms > 0 || newSms > 0)) {
    lines.push(
      `${t('subscriptions:priceRevision.messageTemplate.smsFee')}: ${formatForMessage(oldSms)}'den ${formatForMessage(newSms)}'ye`
    );
  }
  if (oldLine !== newLine && (oldLine > 0 || newLine > 0)) {
    lines.push(
      `${t('subscriptions:priceRevision.messageTemplate.lineFee')}: ${formatForMessage(oldLine)}'den ${formatForMessage(newLine)}'ye`
    );
  }
  if (oldSim !== newSim && (oldSim > 0 || newSim > 0)) {
    lines.push(
      `${t('subscriptions:priceRevision.messageTemplate.subscriptionSimAmount')}: ${formatForMessage(oldSim)}'den ${formatForMessage(newSim)}'ye`
    );
  }
  const hasUnchanged =
    (oldBase === newBase && (oldBase > 0 || newBase > 0)) ||
    (oldSms === newSms && (oldSms > 0 || newSms > 0)) ||
    (oldLine === newLine && (oldLine > 0 || newLine > 0)) ||
    (oldSim === newSim && (oldSim > 0 || newSim > 0));
  if (hasUnchanged && lines.length > 0) {
    lines.push(t('subscriptions:priceRevision.messageTemplate.unchangedParts'));
  }
  const oldTotal = getPriceRevisionNetSubtotal(originalRow);
  const newTotal = getPriceRevisionNetSubtotal(displayRow);
  lines.push(
    `${t('subscriptions:priceRevision.messageTemplate.total')}: ${formatForMessage(oldTotal)}'den ${formatForMessage(newTotal)}'ye`
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
  const [confirmModal, setConfirmModal] = useState(false);

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

  const buildPayload = () =>
    Object.keys(editsById).map((id) => {
      const row = subscriptions.find((s) => s.id === id);
      const merged = row ? { ...row, ...editsById[id] } : { ...editsById[id], id };
      return {
        id,
        base_price: toNum(merged.base_price, 0),
        sms_fee: toNum(merged.sms_fee, 0),
        line_fee: toNum(merged.line_fee, 0),
        static_ip_fee: toNum(merged.static_ip_fee, 0),
        sim_amount: toNum(merged.sim_amount, 0),
        vat_rate: toNum(merged.vat_rate, 20),
        cost: toNum(merged.cost, 0),
      };
    });

  // Opens the confirmation modal
  const handleSaveClick = () => {
    if (Object.keys(editsById).length === 0) return;
    setConfirmModal(true);
  };

  // Called when user confirms in the modal
  const handleConfirmedSave = () => {
    const payload = buildPayload();
    if (payload.length === 0) return;
    bulkUpdateMutation.mutate(payload, {
      onSuccess: () => {
        setEditsById({});
        setConfirmModal(false);
      },
    });
  };

  const truncateExportText = (text, max = 500) => {
    if (text == null || text === '') return '';
    const s = String(text);
    return s.length > max ? `${s.slice(0, max)}…` : s;
  };

  const handleExportExcel = () => {
    if (!displayRows.length) return;
    const exportData = displayRows.map((row) => {
      const base = toNum(row.base_price, 0);
      const sms = toNum(row.sms_fee, 0);
      const sim = toNum(row.sim_amount, 0);
      const netSub = getPriceRevisionNetSubtotal(row);
      const vatAmt = getPriceRevisionVatAmount(row);
      const gross = getPriceRevisionTotalWithVat(row);
      const officialLabel =
        row.official_invoice !== false
          ? t('subscriptions:detail.officialInvoiceResmi')
          : t('subscriptions:detail.officialInvoiceGayri');
      return {
        [t('subscriptions:priceRevision.columns.customer')]: row.company_name || '',
        [t('subscriptions:priceRevision.columns.site')]: row.site_name || '',
        [t('subscriptions:priceRevision.columns.accountNo')]: row.account_no || '',
        [t('subscriptions:priceRevision.columns.startDate')]: formatDate(row.start_date),
        [t('subscriptions:priceRevision.columns.serviceType')]: row.service_type ? t(`subscriptions:serviceTypes.${row.service_type}`) : '',
        [t('subscriptions:priceRevision.columns.billingFrequency')]: t(`subscriptions:priceRevision.filters.${row.billing_frequency || 'monthly'}`),
        [t('subscriptions:priceRevision.columns.officialInvoice')]: officialLabel,
        [t('subscriptions:list.columns.monthly')]: base,
        [t('subscriptions:list.columns.simTl')]: sim,
        [t('subscriptions:priceRevision.columns.smsTl')]: sms,
        [t('subscriptions:priceRevision.columns.netSubtotal')]: netSub,
        [t('subscriptions:priceRevision.columns.vatAmount')]: vatAmt,
        [t('subscriptions:priceRevision.columns.totalWithVat')]: gross,
        [t('subscriptions:priceRevision.zamPercent')]: row.zam_percent != null && row.zam_percent !== '' ? Number(row.zam_percent) : '',
        [t('subscriptions:priceRevision.columns.cost')]: toNum(row.cost, 0),
        [t('subscriptions:priceRevision.export.columns.vatRateReadonly')]: toNum(row.vat_rate, 20),
        [t('subscriptions:priceRevision.export.columns.setupNotes')]: truncateExportText(row.setup_notes),
        [t('subscriptions:priceRevision.export.columns.notes')]: truncateExportText(row.notes),
        [t('subscriptions:priceRevision.messageTemplate.total')]: netSub,
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
      <PageContainer maxWidth="full" padding="default">
        <PageHeader title={t('subscriptions:priceRevision.title')} />
        <div className="mt-6">
          <TableSkeleton cols={10} />
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer maxWidth="full" padding="default">
        <PageHeader title={t('subscriptions:priceRevision.title')} />
        <ErrorState message={error.message} onRetry={refetch} />
      </PageContainer>
    );
  }

  if (!isAdmin) {
    return (
      <PageContainer maxWidth="full">
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
    { value: '3_month', label: t('subscriptions:priceRevision.filters.3_month') },
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
        <div className="max-w-[14rem] min-w-0">
          <p className="font-medium text-neutral-900 dark:text-neutral-100 whitespace-normal break-words">
            {value}
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 whitespace-normal break-words mt-0.5">
            {row.site_name}
          </p>
        </div>
      ),
    },
    {
      header: t('subscriptions:priceRevision.columns.startDate'),
      accessor: 'start_date',
      render: (value) => <span className="text-sm whitespace-nowrap">{formatDate(value)}</span>,
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
      header: t('subscriptions:priceRevision.columns.officialInvoice'),
      accessor: 'official_invoice',
      render: (_, row) => (
        <Badge variant={row.official_invoice !== false ? 'info' : 'outline'} size="sm" className="whitespace-nowrap">
          {row.official_invoice !== false
            ? t('subscriptions:detail.officialInvoiceResmi')
            : t('subscriptions:detail.officialInvoiceGayri')}
        </Badge>
      ),
    },
    {
      header: t('subscriptions:priceRevision.columns.amountBreakdown'),
      accessor: 'base_price',
      align: 'right',
      render: (_, row) => {
        const rate = Number(row.vat_rate);
        const vatRate = Number.isFinite(rate) ? rate : 20;
        return (
          <div className="space-y-2 min-w-[140px]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500 dark:text-neutral-400 w-24 shrink-0">
                {t('subscriptions:list.columns.monthly')}
              </span>
              <span className="w-24 text-right text-sm tabular-nums text-neutral-900 dark:text-neutral-100">
                {formatCurrency(toNum(row.base_price, 0))}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500 dark:text-neutral-400 w-24 shrink-0">
                {t('subscriptions:list.columns.simTl')}
              </span>
              <span className="w-24 text-right text-sm tabular-nums text-neutral-900 dark:text-neutral-100">
                {formatCurrency(toNum(row.sim_amount, 0))}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500 dark:text-neutral-400 w-24 shrink-0">
                {t('subscriptions:priceRevision.columns.smsTl')}
              </span>
              <span className="w-24 text-right text-sm tabular-nums text-neutral-900 dark:text-neutral-100">
                {formatCurrency(toNum(row.sms_fee, 0))}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500 dark:text-neutral-400 w-24 shrink-0">
                {t('subscriptions:priceRevision.columns.netSubtotal')}
              </span>
              <span className="w-24 text-right text-sm font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
                {formatCurrency(getPriceRevisionNetSubtotal(row))}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500 dark:text-neutral-400 w-24 shrink-0">
                {t('subscriptions:priceRevision.columns.vatAmount')}
              </span>
              <span className="w-24 text-right text-sm tabular-nums text-neutral-900 dark:text-neutral-100">
                {vatRate <= 0 ? '—' : formatCurrency(getPriceRevisionVatAmount(row))}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500 dark:text-neutral-400 w-24 shrink-0">
                {t('subscriptions:priceRevision.columns.totalWithVat')}
              </span>
              <span className="w-24 text-right text-sm font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
                {formatCurrency(getPriceRevisionTotalWithVat(row))}
              </span>
            </div>
          </div>
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
            <span className="text-xs text-neutral-500 dark:text-neutral-400 w-24 shrink-0">
              {t('subscriptions:list.columns.monthly')}
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
            <span className="text-xs text-neutral-500 dark:text-neutral-400 w-24 shrink-0">
              {t('subscriptions:list.columns.simTl')}
            </span>
            <Input
              type="number"
              min={0}
              step={0.01}
              size="sm"
              className="w-24"
              value={row.sim_amount ?? ''}
              onChange={(e) => updateEdit(row.id, 'sim_amount', e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              onKeyUp={(e) => e.stopPropagation()}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500 dark:text-neutral-400 w-24 shrink-0">
              {t('subscriptions:priceRevision.columns.smsTl')}
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
            <span className="text-xs text-neutral-500 dark:text-neutral-400 w-24 shrink-0">
              {t('subscriptions:priceRevision.columns.pricingTotalLine')}
            </span>
            <Input
              type="text"
              readOnly
              tabIndex={-1}
              size="sm"
              className="w-24 text-right tabular-nums pointer-events-none text-neutral-900 dark:text-neutral-100"
              value={formatCurrency(getPriceRevisionNetSubtotal(row))}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500 dark:text-neutral-400 w-24 shrink-0">
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
            setNotesModalSubscription(row);
          }}
        />
      ),
    },
  ];

  return (
    <PageContainer maxWidth="full" padding="default" className="space-y-6">
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
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-4 max-w-3xl leading-relaxed">
          {t('subscriptions:priceRevision.pricingBlockFootnote')}
        </p>
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

      <Modal
        open={confirmModal}
        onClose={() => setConfirmModal(false)}
        title={t('subscriptions:priceRevision.confirm.title')}
        size="sm"
        footer={
          <div className="flex gap-3 w-full">
            <Button
              variant="ghost"
              onClick={() => setConfirmModal(false)}
              className="flex-1"
              disabled={bulkUpdateMutation.isPending}
            >
              {t('common:actions.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmedSave}
              loading={bulkUpdateMutation.isPending}
              className="flex-1"
            >
              {t('subscriptions:priceRevision.confirm.save')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex gap-3 p-4 rounded-lg bg-warning-50 dark:bg-warning-950/20 border border-warning-200 dark:border-warning-800/40">
            <AlertTriangle className="w-5 h-5 text-warning-600 dark:text-warning-400 shrink-0 mt-0.5" />
            <p className="text-sm text-warning-700 dark:text-warning-300">
              {t('subscriptions:priceRevision.confirm.message', { count: Object.keys(editsById).length })}
            </p>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {t('subscriptions:priceRevision.confirm.warning')}
          </p>
        </div>
      </Modal>
    </PageContainer>
  );
}
