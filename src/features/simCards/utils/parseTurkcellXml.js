/**
 * Turkcell e-fatura UBL XML parser.
 *
 * Turkcell's signed UBL invoice embeds the same "Fatura Notu" hat breakdown used on the
 * printed PDF verbatim, one record per line, inside individual <cbc:Note> elements:
 *   F2-{hatNo}?{tariff}#{FATURA_TUTARI}${ÖDENECEK_TUTAR}+{KDV}!{ÖİV}
 *
 * Unlike the PDF, header fields (invoice no, dates, grand total) come from real
 * structured UBL tags instead of regex-on-freetext, so they're not subject to
 * pdfjs text-position/joining issues.
 */

import { LINE_REGEX } from './parseTurkcellPdf';
import { parseCurrencySafe } from './parseCurrency';

function firstDirectChild(el, tagName) {
  if (!el) return null;
  return Array.from(el.children).find((c) => c.tagName === tagName) ?? null;
}

function textOf(el) {
  const t = el?.textContent?.trim();
  return t || null;
}

/** UBL dates are ISO (YYYY-MM-DD) — normalize to dd.mm.yyyy to match the PDF/CSV display convention. */
function isoToTrDate(iso) {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

/**
 * @param {File} file - Turkcell UBL invoice XML file
 * @returns {Promise<import('./parseTurkcellPdf').TurkcellParseResult>}
 */
export async function parseTurkcellXml(file) {
  const text = await file.text();
  const doc = new DOMParser().parseFromString(text, 'application/xml');

  if (doc.querySelector('parsererror')) {
    throw new Error('unsupported_format');
  }

  const root = doc.documentElement;
  const parseErrors = [];
  const lines = [];
  const tariffBreakdown = new Map();

  const invoiceNo = textOf(firstDirectChild(root, 'cbc:ID'));
  const invoiceDateRaw = textOf(firstDirectChild(root, 'cbc:IssueDate'));
  const invoiceDate = invoiceDateRaw ? isoToTrDate(invoiceDateRaw) : null;

  const paymentDueEl = doc.getElementsByTagName('cbc:PaymentDueDate')[0];
  const paymentDateRaw = textOf(paymentDueEl);
  const paymentDate = paymentDateRaw ? isoToTrDate(paymentDateRaw) : null;

  const legalMonetaryTotalEl = doc.getElementsByTagName('cac:LegalMonetaryTotal')[0];
  const payableAmountEl = firstDirectChild(legalMonetaryTotalEl, 'cbc:PayableAmount');
  const grandTotal = payableAmountEl ? parseCurrencySafe(textOf(payableAmountEl)) : 0;

  const noteEls = doc.getElementsByTagName('cbc:Note');
  for (const noteEl of noteEls) {
    const noteText = noteEl.textContent ?? '';
    LINE_REGEX.lastIndex = 0;
    const match = LINE_REGEX.exec(noteText);
    if (!match) continue;

    const [, hatNo, tariff, invoiceAmountStr, payableAmountStr, kdvAmountStr, oivAmountStr] = match;

    const invoiceAmount = parseCurrencySafe(invoiceAmountStr);
    const payableAmount = parseCurrencySafe(payableAmountStr);
    const kdvAmount    = parseCurrencySafe(kdvAmountStr);
    const oivAmount    = parseCurrencySafe(oivAmountStr);
    const tariffClean  = tariff.trim();

    lines.push({
      hatNo,
      tariff: tariffClean,
      invoiceAmount,
      payableAmount,
      kdvAmount,
      oivAmount,
    });

    const existing = tariffBreakdown.get(tariffClean) || { count: 0, total: 0 };
    tariffBreakdown.set(tariffClean, {
      count: existing.count + 1,
      total: existing.total + invoiceAmount,
    });
  }

  const totalInvoiceAmount = lines.reduce((sum, l) => sum + l.invoiceAmount, 0);

  // Integrity check — sum of per-line payable amounts should tie out to the
  // structured LegalMonetaryTotal/PayableAmount grand total.
  let parseWarning = false;
  if (grandTotal > 0) {
    const linesPayableTotal = lines.reduce((sum, l) => sum + l.payableAmount, 0);
    const diff = Math.abs(linesPayableTotal - grandTotal);

    if (diff > 1) {
      parseErrors.push(
        `Parse bütünlük hatası: Satır toplamı ${linesPayableTotal.toFixed(2)} TL, fatura toplamı ${grandTotal.toFixed(2)} TL.`
      );
      parseWarning = true;
    }
  }

  return {
    invoiceNo,
    invoiceDate,
    paymentDate,
    grandTotal,
    lines,
    totalInvoiceAmount,
    tariffBreakdown,
    parseErrors,
    parseWarning,
  };
}
