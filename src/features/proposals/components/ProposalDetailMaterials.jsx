import { useTranslation } from 'react-i18next';
import { Card } from '../../../components/ui';
import { cn, formatCurrency } from '../../../lib/utils';
import {
  calcSectionTotal,
  calcVatTevkifatSummary,
  resolveProposalItemLineTotal,
  resolveProposalItemUnitPrice,
} from '../../../lib/proposalCalc';
import { buildProposalSectionGroups, findSectionById } from '../proposalSectionGroups';
import { ProposalRevenueTypeSubtotals } from './ProposalRevenueTypeSubtotals';

const DESKTOP_ROW_GRID =
  'grid-cols-[32px_minmax(0,1fr)_52px_56px_96px_96px]';

function SectionSummaryRow({ label, value, emphasis, negative }) {
  return (
    <div className="flex items-center justify-end gap-6 py-1 text-sm">
      <span className={cn(
        'text-neutral-500 dark:text-neutral-400 text-right',
        emphasis && 'font-semibold text-neutral-800 dark:text-neutral-100',
      )}>
        {label}
      </span>
      <span className={cn(
        'w-28 text-right tabular-nums shrink-0',
        emphasis ? 'font-bold text-neutral-900 dark:text-neutral-100' : 'font-medium text-neutral-800 dark:text-neutral-200',
        negative && 'text-error-600 dark:text-error-400',
      )}>
        {value}
      </span>
    </div>
  );
}

function MaterialRow({ item, index, currency }) {
  const { t } = useTranslation('proposals');
  const lineTotal = resolveProposalItemLineTotal(item, currency);
  const unitPrice = resolveProposalItemUnitPrice(item, currency);
  const qty = Number(item.quantity) || 0;
  const unit = item.unit || t('items.units.adet');

  return (
    <>
      {/* Desktop table row */}
      <div className={cn('hidden md:grid', DESKTOP_ROW_GRID, 'gap-3 items-center py-2.5 border-b border-neutral-100 dark:border-[#1a1a1a] text-sm')}>
        <span className="text-center text-neutral-500 dark:text-neutral-400 tabular-nums">{index}</span>
        <span className="text-neutral-900 dark:text-neutral-100 leading-snug">{item.description}</span>
        <span className="text-center tabular-nums text-neutral-700 dark:text-neutral-300">{qty}</span>
        <span className="text-center text-neutral-600 dark:text-neutral-400">{unit}</span>
        <span className="text-right tabular-nums text-neutral-700 dark:text-neutral-300">{formatCurrency(unitPrice, currency)}</span>
        <span className="text-right tabular-nums font-semibold text-neutral-900 dark:text-neutral-100">{formatCurrency(lineTotal, currency)}</span>
      </div>
      {/* Mobile row */}
      <div className="md:hidden flex items-start justify-between gap-3 py-2.5 border-b border-neutral-100 dark:border-[#1a1a1a]">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-neutral-900 dark:text-neutral-100 leading-snug">
            <span className="font-mono text-neutral-400 mr-1.5">{index}.</span>
            {item.description}
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            {qty} {unit} · {formatCurrency(unitPrice, currency)} / {t('items.unit')}
          </p>
        </div>
        <span className="text-sm font-semibold tabular-nums text-neutral-900 dark:text-neutral-100 shrink-0">
          {formatCurrency(lineTotal, currency)}
        </span>
      </div>
    </>
  );
}

export function ProposalDetailMaterials({
  items = [],
  sections = [],
  currency = 'USD',
  vatRate = 0,
  hasTevkifat = false,
  tevkifatNumerator = 9,
  tevkifatDenominator = 10,
}) {
  const { t } = useTranslation(['proposals', 'common']);

  const hasSections = sections.length > 0;
  const sectionGroups = buildProposalSectionGroups(items, sections);

  const sectionFinancials = sections.map((section) => {
    const sectionItems = items.filter((item) => item.section_id === section.id);
    return calcSectionTotal(sectionItems, section.discount_percent, currency);
  });
  const flatTotal = items.reduce(
    (sum, item) => sum + resolveProposalItemLineTotal(item, currency),
    0,
  );
  const grossSubtotal = hasSections
    ? sectionFinancials.reduce((sum, row) => sum + row.subtotal, 0)
    : flatTotal;
  const totalDiscountAmount = hasSections
    ? sectionFinancials.reduce((sum, row) => sum + row.discountAmount, 0)
    : 0;
  const grandTotal = hasSections
    ? sectionFinancials.reduce((sum, row) => sum + row.sectionTotal, 0)
    : flatTotal;

  const { vatAmount, withheldVat, totalPayable } = calcVatTevkifatSummary(
    grandTotal,
    vatRate,
    hasTevkifat,
    tevkifatNumerator,
    tevkifatDenominator,
  );
  const vatRateLabel = (Number(vatRate) || 0).toLocaleString('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  const renderFlatList = () => (
    <div>
      <div className={cn('hidden md:grid', DESKTOP_ROW_GRID, 'gap-3 pb-2 border-b border-neutral-200 dark:border-[#262626]')}>
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 text-center">{t('proposals:items.sequence')}</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">{t('proposals:items.material')}</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 text-center">{t('proposals:items.quantity')}</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 text-center">{t('proposals:items.unit')}</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 text-right">{t('proposals:items.unitPrice')}</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 text-right">{t('proposals:items.total')}</span>
      </div>
      {items.map((item, index) => (
        <MaterialRow key={item.id || index} item={item} index={index + 1} currency={currency} />
      ))}
    </div>
  );

  const renderSectionedList = () => (
    <div className="space-y-6">
      <div className={cn('hidden md:grid', DESKTOP_ROW_GRID, 'gap-3 pb-2 border-b border-neutral-200 dark:border-[#262626]')}>
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 text-center">{t('proposals:items.sequence')}</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">{t('proposals:items.material')}</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 text-center">{t('proposals:items.quantity')}</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 text-center">{t('proposals:items.unit')}</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 text-right">{t('proposals:items.unitPrice')}</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 text-right">{t('proposals:items.total')}</span>
      </div>

      {sectionGroups.map(({ sectionId, title, items: groupItems }) => {
        if (groupItems.length === 0 && title) return null;

        const section = findSectionById(sections, sectionId);
        const discountPct = Number(section?.discount_percent) || 0;
        const { subtotal, discountAmount, sectionTotal } = calcSectionTotal(groupItems, discountPct, currency);

        return (
          <div key={sectionId || '__ungrouped__'}>
            {title ? (
              <div className="bg-neutral-100 dark:bg-[#1f1f1f] px-4 py-2.5 mb-0 border-y border-neutral-200 dark:border-[#262626]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-200">
                  {title}
                </h4>
              </div>
            ) : null}

            {groupItems.length === 0 ? (
              <p className="text-sm text-neutral-400 italic px-1 py-3">{t('proposals:sections.emptySection')}</p>
            ) : (
              groupItems.map((item, localIndex) => (
                <MaterialRow
                  key={item.id || localIndex}
                  item={item}
                  index={localIndex + 1}
                  currency={currency}
                />
              ))
            )}

            {groupItems.length > 0 && (
              <div className="mt-2 pt-2 border-t border-neutral-200 dark:border-[#333] space-y-0.5">
                <SectionSummaryRow
                  label={
                    title
                      ? t('proposals:sections.sectionSubtotalNamed', { title })
                      : t('proposals:sections.sectionSubtotal')
                  }
                  value={formatCurrency(subtotal, currency)}
                />
                {discountPct > 0 && (
                  <SectionSummaryRow
                    label={`${t('proposals:sections.discount')} %${discountPct}`}
                    value={`−${formatCurrency(discountAmount, currency)}`}
                    negative
                  />
                )}
                <SectionSummaryRow
                  label={t('proposals:sections.sectionTotal')}
                  value={formatCurrency(sectionTotal, currency)}
                  emphasis
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <Card className="overflow-hidden">
      <div className="bg-neutral-50 dark:bg-[#1a1a1a] px-6 py-4 border-b border-neutral-200 dark:border-[#262626]">
        <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-xs">
          {t('proposals:detail.items')}
        </h3>
      </div>
      <div className="p-6">
        {items.length === 0 ? (
          <p className="text-sm text-neutral-500">{t('common:empty.noItems')}</p>
        ) : (
          <div className="space-y-6">
            {hasSections ? renderSectionedList() : renderFlatList()}

            <div className="flex flex-col items-end gap-4 pt-4 border-t border-neutral-200 dark:border-[#262626]">
              <ProposalRevenueTypeSubtotals
                items={items}
                sections={sections}
                currency={currency}
                className="w-full md:w-[min(100%,320px)]"
              />
              <div className="w-full md:w-[min(100%,320px)] rounded-lg border border-neutral-200 dark:border-[#333] bg-neutral-50/80 dark:bg-[#1a1a1a]/80 px-4 py-3 space-y-1.5">
                {totalDiscountAmount > 0 && (
                  <>
                    <SectionSummaryRow
                      label={t('proposals:pdf.grossSubtotal')}
                      value={formatCurrency(grossSubtotal, currency)}
                    />
                    <SectionSummaryRow
                      label={t('proposals:pdf.totalDiscount')}
                      value={`−${formatCurrency(totalDiscountAmount, currency)}`}
                      negative
                    />
                  </>
                )}
                <SectionSummaryRow
                  label={t('proposals:detail.pricingNetExclVat')}
                  value={formatCurrency(grandTotal, currency)}
                  emphasis={totalDiscountAmount <= 0}
                />
                {vatRate > 0 && (
                  <SectionSummaryRow
                    label={t('proposals:detail.pricingVatAtRate', { rate: vatRateLabel })}
                    value={formatCurrency(vatAmount, currency)}
                  />
                )}
                {hasTevkifat && vatRate > 0 && (
                  <SectionSummaryRow
                    label={t('proposals:detail.pricingWithholdingDeduction')}
                    value={`−${formatCurrency(withheldVat, currency)}`}
                    negative
                  />
                )}
                <div className="pt-2 mt-1 border-t-2 border-neutral-800 dark:border-neutral-200">
                  <SectionSummaryRow
                    label={t('proposals:detail.pricingGrandTotalPayable')}
                    value={formatCurrency(totalPayable, currency)}
                    emphasis
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
