import { useTranslation } from 'react-i18next';
import { FileText } from 'lucide-react';
import { cn, formatCurrency } from '../../../lib/utils';
import {
  calcProposalTotals,
  resolveProposalItemLineTotal,
  resolveProposalItemUnitPrice,
} from '../../../lib/proposalCalc';

function formatPreviewDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function ProposalLivePreview({
  watchedValues = {},
  customerCompanyName = '',
  className,
}) {
  const { t } = useTranslation('proposals');

  const {
    title = '',
    proposal_date = '',
    survey_date = '',
    authorized_person = '',
    customer_representative = '',
    scope_of_work = '',
    items = [],
    discount_percent = 0,
    vat_rate = 0,
    currency = 'USD',
  } = watchedValues;

  const { subtotal, discountAmount, grandTotal } = calcProposalTotals(items, discount_percent, currency);
  const vatAmount = Math.round(grandTotal * (Number(vat_rate) || 0) / 100 * 100) / 100;
  const totalWithVat = grandTotal + vatAmount;
  const discountPct = Number(discount_percent) || 0;

  const fmt = (amount) => formatCurrency(amount, currency);

  return (
    <div className={cn('sticky top-6', className)}>
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4 text-primary-600" />
        <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
          {t('form.preview.title')}
        </h3>
      </div>

      {/* Preview card — mimics PDF layout */}
      <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm overflow-hidden text-[11px] leading-relaxed">
        {/* Header */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-start justify-between mb-3">
            <div className="text-base font-bold text-neutral-900 dark:text-neutral-50">
              Ornet Güvenlik
            </div>
            <div className="text-[10px] text-neutral-400 dark:text-neutral-500 text-right">
              TEKLİF
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
            {customerCompanyName && (
              <>
                <span className="text-neutral-400 dark:text-neutral-500">
                  {t('form.preview.companyLabel')}
                </span>
                <span className="text-neutral-800 dark:text-neutral-200 font-medium truncate">
                  {customerCompanyName}
                </span>
              </>
            )}
            {title && (
              <>
                <span className="text-neutral-400 dark:text-neutral-500">
                  {t('form.preview.projectLabel')}
                </span>
                <span className="text-neutral-800 dark:text-neutral-200 font-medium truncate">{title}</span>
              </>
            )}
            {proposal_date && (
              <>
                <span className="text-neutral-400 dark:text-neutral-500">
                  {t('form.fields.proposalDate')}
                </span>
                <span className="text-neutral-800 dark:text-neutral-200">{formatPreviewDate(proposal_date)}</span>
              </>
            )}
            {survey_date && (
              <>
                <span className="text-neutral-400 dark:text-neutral-500">
                  {t('form.fields.surveyDate')}
                </span>
                <span className="text-neutral-800 dark:text-neutral-200">{formatPreviewDate(survey_date)}</span>
              </>
            )}
            {authorized_person && (
              <>
                <span className="text-neutral-400 dark:text-neutral-500">
                  {t('form.fields.authorizedPerson')}
                </span>
                <span className="text-neutral-800 dark:text-neutral-200 truncate">{authorized_person}</span>
              </>
            )}
            {customer_representative && (
              <>
                <span className="text-neutral-400 dark:text-neutral-500">
                  {t('form.fields.customerRepresentative')}
                </span>
                <span className="text-neutral-800 dark:text-neutral-200 truncate">{customer_representative}</span>
              </>
            )}
          </div>
        </div>

        {/* Scope */}
        {scope_of_work && (
          <div className="px-5 py-2 border-t border-neutral-100 dark:border-neutral-800">
            <p className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-1">
              {t('pdf.scopeOfWork')}
            </p>
            <p className="text-[10px] text-neutral-600 dark:text-neutral-400 line-clamp-3">{scope_of_work}</p>
          </div>
        )}

        {/* Items table */}
        <div className="px-5 py-3 border-t border-neutral-100 dark:border-neutral-800">
          {items.length === 0 ? (
            <p className="text-center text-neutral-400 dark:text-neutral-500 py-4 text-[10px]">
              {t('form.preview.noItems')}
            </p>
          ) : (
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-700">
                  <th className="text-left py-1 font-semibold text-neutral-500 dark:text-neutral-400 w-5">#</th>
                  <th className="text-left py-1 font-semibold text-neutral-500 dark:text-neutral-400">
                    {t('items.material')}
                  </th>
                  <th className="text-center py-1 font-semibold text-neutral-500 dark:text-neutral-400 w-8">
                    {t('items.quantity')}
                  </th>
                  <th className="text-right py-1 font-semibold text-neutral-500 dark:text-neutral-400 w-16">
                    {t('items.unitPrice')}
                  </th>
                  <th className="text-right py-1 font-semibold text-neutral-500 dark:text-neutral-400 w-16">
                    {t('items.total')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => {
                  const qty = Number(item.quantity) || 0;
                  const price = resolveProposalItemUnitPrice(item, currency);
                  const lineTotal = resolveProposalItemLineTotal(item, currency);
                  return (
                    <tr key={i} className="border-b border-neutral-50 dark:border-neutral-800/50">
                      <td className="py-1 text-neutral-400">{i + 1}</td>
                      <td className="py-1 text-neutral-800 dark:text-neutral-200 truncate max-w-[120px]">
                        {item.description || '—'}
                      </td>
                      <td className="py-1 text-center text-neutral-600 dark:text-neutral-400">{qty}</td>
                      <td className="py-1 text-right text-neutral-600 dark:text-neutral-400">{fmt(price)}</td>
                      <td className="py-1 text-right font-medium text-neutral-800 dark:text-neutral-200">{fmt(lineTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Totals */}
        {items.length > 0 && (
          <div className="px-5 py-3 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/30">
            <div className="flex justify-end">
              <div className="w-48 space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-neutral-500 dark:text-neutral-400">{t('form.preview.subtotal')}</span>
                  <span className="text-neutral-800 dark:text-neutral-200">{fmt(subtotal)}</span>
                </div>
                {discountPct > 0 && (
                  <div className="flex justify-between text-amber-600 dark:text-amber-400">
                    <span>{t('form.preview.discount')} (%{discountPct})</span>
                    <span>-{fmt(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-[11px] pt-1 border-t border-neutral-200 dark:border-neutral-700">
                  <span className="text-neutral-900 dark:text-neutral-50">{t('form.preview.grandTotal')}</span>
                  <span className="text-neutral-900 dark:text-neutral-50">{fmt(grandTotal)}</span>
                </div>
                {Number(vat_rate) > 0 && (
                  <>
                    <div className="flex justify-between text-neutral-500 dark:text-neutral-400">
                      <span>{t('form.preview.vat')} (%{Number(vat_rate)})</span>
                      <span>{fmt(vatAmount)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-[11px]">
                      <span className="text-neutral-900 dark:text-neutral-50">{t('form.preview.totalWithVat')}</span>
                      <span className="text-primary-600 dark:text-primary-400">{fmt(totalWithVat)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-neutral-100 dark:border-neutral-800 text-center">
          <p className="text-[9px] text-neutral-400 dark:text-neutral-500">
            Ornet Güvenlik Sistemleri
          </p>
        </div>
      </div>
    </div>
  );
}
