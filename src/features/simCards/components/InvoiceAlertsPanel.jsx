import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Card, Badge } from '../../../components/ui';
import { cn } from '../../../lib/utils';
import { formatCurrency } from '../../../lib/utils';

const SEVERITY_BAR = {
  error:   'bg-error-500',
  warning: 'bg-warning-400',
  info:    'bg-info-400',
};

function AlertSection({ severity = 'info', title, description, count, defaultOpen, children }) {
  const [open, setOpen] = useState(defaultOpen);

  if (count === 0) return null;

  return (
    <Card className="overflow-hidden border-neutral-200/60 dark:border-neutral-800/60">
      <button
        className="w-full flex items-center justify-between p-4 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-start gap-3 min-w-0">
          {/* Severity indicator bar */}
          <div className={cn('w-1 self-stretch rounded-full flex-shrink-0 mt-0.5', SEVERITY_BAR[severity])} />
          <div className="min-w-0">
            <p className="font-semibold text-neutral-900 dark:text-neutral-50 flex items-center gap-2 flex-wrap">
              {title}
              <Badge size="sm" variant="default">{count}</Badge>
            </p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">{description}</p>
          </div>
        </div>
        {open ? (
          <ChevronUp className="w-5 h-5 text-neutral-400 shrink-0 ml-2" />
        ) : (
          <ChevronDown className="w-5 h-5 text-neutral-400 shrink-0 ml-2" />
        )}
      </button>

      {open && (
        <div className="border-t border-neutral-200 dark:border-neutral-800">
          {children}
        </div>
      )}
    </Card>
  );
}

function AlertTable({ rows, columns }) {
  return (
    <div className="overflow-x-auto max-h-64 overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 dark:bg-neutral-800/50 sticky top-0">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-2 text-left font-medium text-neutral-600 dark:text-neutral-400 whitespace-nowrap"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/20">
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-2 text-neutral-800 dark:text-neutral-200">
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function InvoiceAlertsPanel({ invoiceOnly, costIncreaseLines, lossLines, inventoryOnly }) {
  const { t } = useTranslation('invoiceAnalysis');

  const invoiceOnlyColumns = [
    { key: 'hatNo', label: t('table.hatNo') },
    { key: 'tariff', label: t('table.tariff') },
    {
      key: 'invoiceAmount',
      label: t('table.invoiceAmount'),
      render: (row) => formatCurrency(row.invoiceAmount),
    },
  ];

  const costIncreaseColumns = [
    { key: 'hatNo', label: t('table.hatNo') },
    { key: 'tariff', label: t('table.tariff') },
    {
      key: 'invoiceAmount',
      label: t('table.invoiceAmount'),
      render: (row) => formatCurrency(row.invoiceAmount),
    },
    {
      key: 'costPrice',
      label: t('table.costPrice'),
      render: (row) => row.hasUnknownCost ? (
        <Badge variant="warning" size="sm">{t('table.unknownCost')}</Badge>
      ) : (
        formatCurrency(row.costPrice)
      ),
    },
    {
      key: 'priceDiff',
      label: t('table.diff'),
      render: (row) => row.hasUnknownCost ? (
        <span className="text-neutral-400 dark:text-neutral-500">—</span>
      ) : (
        <span className="text-warning-600 dark:text-warning-400 font-medium">
          +{formatCurrency(row.priceDiff)}
        </span>
      ),
    },
    { key: 'buyer', label: t('table.buyer'), render: (row) => row.buyer || '—' },
  ];

  const lossColumns = [
    { key: 'hatNo', label: t('table.hatNo') },
    { key: 'tariff', label: t('table.tariff') },
    {
      key: 'invoiceAmount',
      label: t('table.invoiceAmount'),
      render: (row) => formatCurrency(row.invoiceAmount),
    },
    {
      key: 'costPrice',
      label: t('table.costPrice'),
      render: (row) => row.hasUnknownCost ? (
        <Badge variant="warning" size="sm">{t('table.unknownCost')}</Badge>
      ) : (
        formatCurrency(row.costPrice)
      ),
    },
    {
      key: 'salePrice',
      label: t('table.salePrice'),
      render: (row) => formatCurrency(row.salePrice),
    },
    {
      key: 'profit',
      label: t('table.profitLoss'),
      render: (row) => (
        <span className="text-error-600 dark:text-error-400 font-medium">
          {formatCurrency(row.profit)}
        </span>
      ),
    },
    { key: 'buyer', label: t('table.buyer'), render: (row) => row.buyer || '—' },
  ];

  const inventoryOnlyColumns = [
    {
      key: 'phone_number',
      label: t('table.hatNo'),
      render: (row) => row.phone_number,
    },
    {
      key: 'buyer',
      label: t('table.buyer'),
      render: (row) => row.buyer?.company_name || '—',
    },
    {
      key: 'cost_price',
      label: t('table.costPrice'),
      render: (row) => formatCurrency(row.cost_price || 0),
    },
  ];

  return (
    <div className="space-y-2 mb-6">
      <AlertSection
        severity="error"
        title={t('alerts.invoiceOnly.title')}
        description={t('alerts.invoiceOnly.description')}
        count={invoiceOnly.length}
        defaultOpen={true}
      >
        <AlertTable rows={invoiceOnly} columns={invoiceOnlyColumns} />
      </AlertSection>

      <AlertSection
        severity="warning"
        title={t('alerts.costIncrease.title')}
        description={t('alerts.costIncrease.description')}
        count={costIncreaseLines.length}
        defaultOpen={true}
      >
        <AlertTable rows={costIncreaseLines} columns={costIncreaseColumns} />
      </AlertSection>

      <AlertSection
        severity="error"
        title={t('alerts.loss.title')}
        description={t('alerts.loss.description')}
        count={lossLines.length}
        defaultOpen={false}
      >
        <AlertTable rows={lossLines} columns={lossColumns} />
      </AlertSection>

      <AlertSection
        severity="info"
        title={t('alerts.inventoryOnly.title')}
        description={t('alerts.inventoryOnly.description')}
        count={inventoryOnly.length}
        defaultOpen={false}
      >
        <AlertTable rows={inventoryOnly} columns={inventoryOnlyColumns} />
      </AlertSection>
    </div>
  );
}
