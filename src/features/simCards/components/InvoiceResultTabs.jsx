import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Badge } from '../../../components/ui';
import { formatCurrency } from '../../../lib/utils';

const PAGE_SIZE = 50;

function TabButton({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        active
          ? 'bg-primary-600 text-white'
          : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
      }`}
    >
      {label}{' '}
      <span
        className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${
          active ? 'bg-white/20' : 'bg-neutral-200 dark:bg-neutral-700'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function ShowMoreButton({ remaining, onShow }) {
  const { t } = useTranslation('invoiceAnalysis');
  if (remaining <= 0) return null;
  return (
    <div className="p-4 text-center border-t border-neutral-200 dark:border-neutral-800">
      <button
        onClick={onShow}
        className="text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium"
      >
        {t('filters.showMore', { count: Math.min(remaining, PAGE_SIZE) })}
      </button>
    </div>
  );
}

// ─── Matched ────────────────────────────────────────────────────────────────

function MatchedTable({ rows }) {
  const { t } = useTranslation('invoiceAnalysis');
  const [showCostIncreaseOnly, setShowCostIncreaseOnly] = useState(false);
  const [shown, setShown] = useState(PAGE_SIZE);

  const filtered = showCostIncreaseOnly ? rows.filter((r) => r.isCostIncrease) : rows;
  const visible = filtered.slice(0, shown);
  const remaining = filtered.length - shown;

  const rowBg = (row) =>
    row.isLoss ? 'bg-red-50/60 dark:bg-red-900/10' : row.profit > 0 ? 'bg-green-50/40 dark:bg-green-900/10' : '';

  return (
    <div>
      {/* Filter bar */}
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showCostIncreaseOnly}
            onChange={(e) => { setShowCostIncreaseOnly(e.target.checked); setShown(PAGE_SIZE); }}
            className="rounded border-neutral-300"
          />
          <span className="text-neutral-700 dark:text-neutral-300">{t('filters.costIncreaseOnly')}</span>
        </label>
        <span className="text-xs text-neutral-400">{filtered.length} {t('table.lineUnit')}</span>
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-800/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">{t('table.hatNo')}</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">{t('table.tariff')}</th>
              <th className="px-4 py-3 text-right font-medium text-neutral-600 dark:text-neutral-400">{t('table.invoiceAmount')}</th>
              <th className="px-4 py-3 text-right font-medium text-neutral-600 dark:text-neutral-400">{t('table.costPrice')}</th>
              <th className="px-4 py-3 text-right font-medium text-neutral-600 dark:text-neutral-400">{t('table.salePrice')}</th>
              <th className="px-4 py-3 text-right font-medium text-neutral-600 dark:text-neutral-400">{t('table.profitLoss')}</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">{t('table.buyer')}</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">{t('table.costIncrease')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {visible.map((row, i) => (
              <tr key={i} className={rowBg(row)}>
                <td className="px-4 py-2 font-mono text-xs text-neutral-700 dark:text-neutral-300">{row.hatNo}</td>
                <td className="px-4 py-2 text-neutral-800 dark:text-neutral-200 max-w-[160px] truncate">{row.tariff}</td>
                <td className="px-4 py-2 text-right text-neutral-800 dark:text-neutral-200">{formatCurrency(row.invoiceAmount)}</td>
                <td className="px-4 py-2 text-right text-neutral-500 dark:text-neutral-400">
                  {row.hasUnknownCost ? (
                    <Badge variant="warning" size="sm">{t('table.unknownCost')}</Badge>
                  ) : (
                    formatCurrency(row.costPrice)
                  )}
                </td>
                <td className="px-4 py-2 text-right text-neutral-500 dark:text-neutral-400">{formatCurrency(row.salePrice)}</td>
                <td className={`px-4 py-2 text-right font-medium ${row.isLoss ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                  {formatCurrency(row.profit)}
                </td>
                <td className="px-4 py-2 text-neutral-700 dark:text-neutral-300 max-w-[140px] truncate">{row.buyer || '—'}</td>
                <td className="px-4 py-2 space-x-1">
                  {row.isCostIncrease && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400">
                      {t('table.costIncrease')}
                    </span>
                  )}
                  {row.hasUnknownCost && (
                    <Badge variant="warning" size="sm">{t('table.unknownCost')}</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="sm:hidden divide-y divide-neutral-100 dark:divide-neutral-800">
        {visible.map((row, i) => (
          <div key={i} className={`px-4 py-3 space-y-1.5 ${rowBg(row)}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-semibold text-neutral-700 dark:text-neutral-300">{row.hatNo}</span>
              <span className="flex gap-1">
                {row.isCostIncrease && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400">
                    {t('table.costIncrease')}
                  </span>
                )}
                {row.hasUnknownCost && (
                  <Badge variant="warning" size="sm">{t('table.unknownCost')}</Badge>
                )}
              </span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{row.tariff}</p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-600 dark:text-neutral-400">{t('table.invoiceAmount')}</span>
              <span className="font-medium text-neutral-900 dark:text-neutral-50">{formatCurrency(row.invoiceAmount)}</span>
            </div>
            {!row.hasUnknownCost && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-600 dark:text-neutral-400">{t('table.costPrice')}</span>
                <span className="text-neutral-800 dark:text-neutral-200">{formatCurrency(row.costPrice)}</span>
              </div>
            )}
            {row.hasUnknownCost && (
              <div className="flex items-center justify-between text-sm">
                <Badge variant="warning" size="sm">{t('table.unknownCost')}</Badge>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-600 dark:text-neutral-400">{t('table.profitLoss')}</span>
              <span className={`font-semibold ${row.isLoss ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                {formatCurrency(row.profit)}
              </span>
            </div>
            {row.buyer && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400">{row.buyer}</p>
            )}
          </div>
        ))}
      </div>

      <ShowMoreButton remaining={remaining} onShow={() => setShown((s) => s + PAGE_SIZE)} />
    </div>
  );
}

// ─── Invoice Only ────────────────────────────────────────────────────────────

function InvoiceOnlyTable({ rows }) {
  const { t } = useTranslation('invoiceAnalysis');
  const [shown, setShown] = useState(PAGE_SIZE);
  const visible = rows.slice(0, shown);
  const remaining = rows.length - shown;

  return (
    <div>
      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-800/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">{t('table.hatNo')}</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">{t('table.tariff')}</th>
              <th className="px-4 py-3 text-right font-medium text-neutral-600 dark:text-neutral-400">{t('table.invoiceAmount')}</th>
              <th className="px-4 py-3 text-right font-medium text-neutral-600 dark:text-neutral-400">{t('table.kdv')}</th>
              <th className="px-4 py-3 text-right font-medium text-neutral-600 dark:text-neutral-400">{t('table.oiv')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {visible.map((row, i) => (
              <tr key={i} className="bg-red-50/40 dark:bg-red-900/10">
                <td className="px-4 py-2 font-mono text-xs text-neutral-700 dark:text-neutral-300">{row.hatNo}</td>
                <td className="px-4 py-2 text-neutral-800 dark:text-neutral-200 max-w-[200px] truncate">{row.tariff}</td>
                <td className="px-4 py-2 text-right text-neutral-800 dark:text-neutral-200">{formatCurrency(row.invoiceAmount)}</td>
                <td className="px-4 py-2 text-right text-neutral-500">{formatCurrency(row.kdv)}</td>
                <td className="px-4 py-2 text-right text-neutral-500">{formatCurrency(row.oiv)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="sm:hidden divide-y divide-neutral-100 dark:divide-neutral-800">
        {visible.map((row, i) => (
          <div key={i} className="px-4 py-3 space-y-1.5 bg-red-50/40 dark:bg-red-900/10">
            <span className="font-mono text-xs font-semibold text-neutral-700 dark:text-neutral-300">{row.hatNo}</span>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{row.tariff}</p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-600 dark:text-neutral-400">{t('table.invoiceAmount')}</span>
              <span className="font-semibold text-red-600 dark:text-red-400">{formatCurrency(row.invoiceAmount)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>{t('table.kdv')}: {formatCurrency(row.kdv)}</span>
              <span>{t('table.oiv')}: {formatCurrency(row.oiv)}</span>
            </div>
          </div>
        ))}
      </div>

      <ShowMoreButton remaining={remaining} onShow={() => setShown((s) => s + PAGE_SIZE)} />
    </div>
  );
}

// ─── Inventory Only ──────────────────────────────────────────────────────────

function InventoryOnlyTable({ rows }) {
  const { t } = useTranslation('invoiceAnalysis');
  const [shown, setShown] = useState(PAGE_SIZE);
  const visible = rows.slice(0, shown);
  const remaining = rows.length - shown;

  return (
    <div>
      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-800/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">{t('table.hatNo')}</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">{t('table.buyer')}</th>
              <th className="px-4 py-3 text-right font-medium text-neutral-600 dark:text-neutral-400">{t('table.costPrice')}</th>
              <th className="px-4 py-3 text-right font-medium text-neutral-600 dark:text-neutral-400">{t('table.salePrice')}</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">{t('table.status')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {visible.map((row, i) => (
              <tr key={i} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/20">
                <td className="px-4 py-2 font-mono text-xs text-neutral-700 dark:text-neutral-300">{row.phone_number}</td>
                <td className="px-4 py-2 text-neutral-800 dark:text-neutral-200">{row.buyer?.company_name || '—'}</td>
                <td className="px-4 py-2 text-right text-neutral-500">{formatCurrency(row.cost_price || 0)}</td>
                <td className="px-4 py-2 text-right text-neutral-500">{formatCurrency(row.sale_price || 0)}</td>
                <td className="px-4 py-2 text-neutral-600 dark:text-neutral-400">{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="sm:hidden divide-y divide-neutral-100 dark:divide-neutral-800">
        {visible.map((row, i) => (
          <div key={i} className="px-4 py-3 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-semibold text-neutral-700 dark:text-neutral-300">{row.phone_number}</span>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">{row.status}</span>
            </div>
            {row.buyer?.company_name && (
              <p className="text-xs text-neutral-600 dark:text-neutral-400">{row.buyer.company_name}</p>
            )}
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>{t('table.costPrice')}: {formatCurrency(row.cost_price || 0)}</span>
              <span>{t('table.salePrice')}: {formatCurrency(row.sale_price || 0)}</span>
            </div>
          </div>
        ))}
      </div>

      <ShowMoreButton remaining={remaining} onShow={() => setShown((s) => s + PAGE_SIZE)} />
    </div>
  );
}

// ─── Tabs container ──────────────────────────────────────────────────────────

export function InvoiceResultTabs({ matched, invoiceOnly, inventoryOnly }) {
  const { t } = useTranslation('invoiceAnalysis');
  const [activeTab, setActiveTab] = useState('matched');

  const tabs = [
    { id: 'matched', label: t('tabs.matched'), count: matched.length },
    { id: 'invoiceOnly', label: t('tabs.invoiceOnly'), count: invoiceOnly.length },
    { id: 'inventoryOnly', label: t('tabs.inventoryOnly'), count: inventoryOnly.length },
  ];

  return (
    <Card className="overflow-hidden border-neutral-200/60 dark:border-neutral-800/60">
      <div className="flex gap-2 p-3 border-b border-neutral-200 dark:border-neutral-800 flex-wrap">
        {tabs.map((tab) => (
          <TabButton
            key={tab.id}
            label={tab.label}
            count={tab.count}
            active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          />
        ))}
      </div>

      {activeTab === 'matched' && <MatchedTable rows={matched} />}
      {activeTab === 'invoiceOnly' && <InvoiceOnlyTable rows={invoiceOnly} />}
      {activeTab === 'inventoryOnly' && <InventoryOnlyTable rows={inventoryOnly} />}
    </Card>
  );
}
