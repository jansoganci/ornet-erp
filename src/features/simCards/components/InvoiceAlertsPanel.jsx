import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { Card, Button, SearchInput, Table } from '../../../components/ui';
import { cn, formatCurrency } from '../../../lib/utils';
import { toCSV, downloadCSV } from '../../../lib/csvExport';

const PAGE_SIZE = 50;
const SEARCH_THRESHOLD = 20;
const STATUS_ORDER = { active: 0, subscription: 1, available: 2, cancelled: 3 };

function ResultSection({
  title,
  description,
  accentClassName,
  rows,
  columns,
  csvRows,
  csvColumns,
  csvFilename,
  getHatNo,
  emptyMessage,
}) {
  const { t } = useTranslation('invoiceAnalysis');
  const [search, setSearch] = useState('');
  const [shown, setShown] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    const term = search.replace(/\D/g, '');
    if (!term) return rows;
    return rows.filter((row) => getHatNo(row).includes(term));
  }, [rows, search, getHatNo]);

  const visible = filtered.slice(0, shown);
  const remaining = filtered.length - shown;

  const handleDownload = () => {
    downloadCSV(toCSV(csvRows, csvColumns), csvFilename);
  };

  return (
    <Card className="p-5 mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className={cn('text-base font-semibold', accentClassName)}>
            {title} <span className="text-neutral-400 dark:text-neutral-500 font-normal">({rows.length})</span>
          </h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">{description}</p>
        </div>
        {rows.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Download className="w-4 h-4" />}
            onClick={handleDownload}
          >
            {t('filters.downloadCsv')}
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm font-medium text-success-600 dark:text-success-400 py-2">
          {emptyMessage}
        </p>
      ) : (
        <>
          {rows.length > SEARCH_THRESHOLD && (
            <div className="mb-4">
              <SearchInput
                value={search}
                onChange={(v) => { setSearch(v); setShown(PAGE_SIZE); }}
                placeholder={t('filters.searchPlaceholder')}
              />
            </div>
          )}

          <Table columns={columns} data={visible} keyExtractor={(row, i) => `${getHatNo(row)}-${i}`} />

          {remaining > 0 && (
            <div className="mt-3 text-center">
              <button
                onClick={() => setShown((s) => s + PAGE_SIZE)}
                className="text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium"
              >
                {t('filters.showMore', { count: Math.min(remaining, PAGE_SIZE) })}
              </button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

export function InvoiceAlertsPanel({ lossLines, invoiceOnly, inventoryOnly }) {
  const { t } = useTranslation('invoiceAnalysis');

  const sortedLoss = useMemo(
    () => [...lossLines].sort((a, b) => a.profit - b.profit),
    [lossLines]
  );
  const sortedInvoiceOnly = useMemo(
    () => [...invoiceOnly].sort((a, b) => b.invoiceAmount - a.invoiceAmount),
    [invoiceOnly]
  );
  const sortedInventoryOnly = useMemo(
    () => [...inventoryOnly].sort(
      (a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)
    ),
    [inventoryOnly]
  );

  const statusLabel = (status) => t(`status.${status}`, { defaultValue: status });

  const lossColumns = [
    { key: 'hatNo', header: t('table.hatNo') },
    { key: 'tariff', header: t('table.tariff') },
    { key: 'invoiceAmount', header: t('table.invoiceAmount'), align: 'right', render: (v) => formatCurrency(v) },
    { key: 'salePrice', header: t('table.salePrice'), align: 'right', render: (v) => formatCurrency(v) },
    {
      key: 'profit',
      header: t('table.loss'),
      align: 'right',
      render: (v) => (
        <span className="text-error-600 dark:text-error-400 font-semibold">
          {formatCurrency(Math.abs(v))}
        </span>
      ),
    },
  ];

  const invoiceOnlyColumns = [
    { key: 'hatNo', header: t('table.hatNo') },
    { key: 'tariff', header: t('table.tariff') },
    { key: 'invoiceAmount', header: t('table.invoiceAmount'), align: 'right', render: (v) => formatCurrency(v) },
  ];

  const inventoryOnlyColumns = [
    { key: 'phone_number', header: t('table.hatNo') },
    { key: 'status', header: t('table.status'), render: (v) => statusLabel(v) },
  ];

  return (
    <div>
      <ResultSection
        title={t('alerts.loss.title')}
        description={t('alerts.loss.description')}
        accentClassName="text-error-700 dark:text-error-400"
        rows={sortedLoss}
        columns={lossColumns}
        csvRows={sortedLoss.map((r) => ({
          hatNo: r.hatNo,
          tariff: r.tariff,
          invoiceAmount: r.invoiceAmount,
          salePrice: r.salePrice,
          loss: Math.abs(r.profit),
        }))}
        csvColumns={[
          { key: 'hatNo', header: t('table.hatNo') },
          { key: 'tariff', header: t('table.tariff') },
          { key: 'invoiceAmount', header: t('table.invoiceAmount') },
          { key: 'salePrice', header: t('table.salePrice') },
          { key: 'loss', header: t('table.loss') },
        ]}
        csvFilename={t('alerts.loss.csvFilename')}
        getHatNo={(r) => r.hatNo}
        emptyMessage={t('alerts.loss.empty')}
      />

      <ResultSection
        title={t('alerts.invoiceOnly.title')}
        description={t('alerts.invoiceOnly.description')}
        accentClassName="text-warning-700 dark:text-warning-400"
        rows={sortedInvoiceOnly}
        columns={invoiceOnlyColumns}
        csvRows={sortedInvoiceOnly}
        csvColumns={[
          { key: 'hatNo', header: t('table.hatNo') },
          { key: 'tariff', header: t('table.tariff') },
          { key: 'invoiceAmount', header: t('table.invoiceAmount') },
        ]}
        csvFilename={t('alerts.invoiceOnly.csvFilename')}
        getHatNo={(r) => r.hatNo}
        emptyMessage={t('alerts.invoiceOnly.empty')}
      />

      <ResultSection
        title={t('alerts.inventoryOnly.title')}
        description={t('alerts.inventoryOnly.description')}
        accentClassName="text-info-700 dark:text-info-400"
        rows={sortedInventoryOnly}
        columns={inventoryOnlyColumns}
        csvRows={sortedInventoryOnly.map((r) => ({
          hatNo: r.phone_number,
          status: statusLabel(r.status),
        }))}
        csvColumns={[
          { key: 'hatNo', header: t('table.hatNo') },
          { key: 'status', header: t('table.status') },
        ]}
        csvFilename={t('alerts.inventoryOnly.csvFilename')}
        getHatNo={(r) => r.phone_number}
        emptyMessage={t('alerts.inventoryOnly.empty')}
      />
    </div>
  );
}
