/**
 * Turkcell PDF invoice parser using pdfjs-dist.
 * Extracts hat (line) data from the "Fatura Notu" section.
 *
 * Each line in the PDF follows the pattern:
 *   F2-{hatNo}?{tariff}#{FATURA_TUTARI}${ÖDENECEK_TUTAR}+{KDV}!{ÖİV}
 *
 * Field mapping:
 *   # → invoiceAmount   (FATURA TUTARI — total per-line charge, basis for cost comparison)
 *   $ → payableAmount   (ÖDENECEK TUTAR — same as invoiceAmount; informational duplicate)
 *   + → kdvAmount       (KDV per line — portion already included in invoiceAmount)
 *   ! → oivAmount       (ÖİV per line — portion already included in invoiceAmount)
 */

import * as pdfjsLib from 'pdfjs-dist';

// Configure worker — Vite 7 handles asset URLs natively
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

/**
 * Line regex: F2-{10 digits}?{tariff}#{invoiceAmount}${payableAmount}+{kdvAmount}!{oivAmount}
 */
const LINE_REGEX = /F2-(\d{10})\?([^#]*)#([\d.,]+)\$([\d.,]+)\+([\d.,]+)!([\d.,]+)/g;

/**
 * Parse currency string, handling Turkish format (1.234,56) and US format (1,234.56).
 * Returns 0 on parse failure instead of NaN.
 */
function parseCurrencySafe(str) {
  if (str == null || str === '') return 0;
  let s = String(str).trim().replace(/\s/g, '');
  // Turkish: 1.234,56 → remove dots (thousands), replace comma (decimal)
  if (/^\d{1,3}(\.\d{3})*,\d+$/.test(s) || /^\d+,\d+$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  // US: 1,234.56 or mixed
  else if (s.includes(',') && s.includes('.')) {
    s = s.replace(/,/g, '');
  } else if (/^\d{1,3}(,\d{3})*\.\d+$/.test(s) || /^\d+\.\d+$/.test(s)) {
    s = s.replace(/,/g, '');
  } else if (s.includes(',')) {
    s = s.replace(/,/g, '.');
  }
  const n = parseFloat(s.replace(/[^\d.-]/g, ''));
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Parse a Turkcell invoice PDF file.
 * @param {File} file - PDF file selected by user
 * @returns {Promise<{
 *   invoiceNo: string|null,
 *   invoiceDate: string|null,
 *   paymentDate: string|null,
 *   grandTotal: number,
 *   lines: Array,
 *   totalInvoiceAmount: number,
 *   tariffBreakdown: Map<string, {count: number, total: number}>,
 *   parseErrors: string[],
 *   parseWarning: boolean
 * }>}
 */
export async function parseTurkcellPdf(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const lines = [];
  const parseErrors = [];
  const tariffBreakdown = new Map();
  let fullText = '';

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    try {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Join all text items on this page with a space
      const pageText = textContent.items.map((item) => item.str).join(' ');
      fullText += ' ' + pageText;

      // Apply regex globally to find all hat lines on this page
      let match;
      LINE_REGEX.lastIndex = 0;
      while ((match = LINE_REGEX.exec(pageText)) !== null) {
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

        // Accumulate tariff breakdown by invoiceAmount (cost comparison basis)
        const existing = tariffBreakdown.get(tariffClean) || { count: 0, total: 0 };
        tariffBreakdown.set(tariffClean, {
          count: existing.count + 1,
          total: existing.total + invoiceAmount,
        });
      }
    } catch (err) {
      parseErrors.push(`Sayfa ${pageNum} okunamadı: ${err.message}`);
    }
  }

  // ── Fix 2: Extract invoice header fields from full text ──────────────────

  const invoiceNoMatch    = fullText.match(/Fatura No[:\s]+([\d]{10,20})/);
  const invoiceDateMatch  = fullText.match(/Fatura Tarihi[:\s]+(\d{2}\.\d{2}\.\d{4})/);
  const paymentDateMatch  = fullText.match(/Ödeme Tarihi[:\s]+(\d{2}\.\d{2}\.\d{4})/);
  const grandTotalMatch   = fullText.match(/Ödenecek Tutar[:\s]+([\d.,]+)/);

  const invoiceNo   = invoiceNoMatch   ? invoiceNoMatch[1]   : null;
  const invoiceDate = invoiceDateMatch ? invoiceDateMatch[1] : null;
  const paymentDate = paymentDateMatch ? paymentDateMatch[1] : null;
  const grandTotal  = grandTotalMatch  ? parseCurrencySafe(grandTotalMatch[1]) : 0;

  // Total invoice amount = sum of all per-line invoiceAmount fields
  const totalInvoiceAmount = lines.reduce((sum, l) => sum + l.invoiceAmount, 0);

  // ── Fix 3: Parse integrity check ────────────────────────────────────────
  // Sum of per-line payableAmounts should approximate the cover-page grand total.
  // A discrepancy > 1 TL indicates missed pages or a parsing failure.

  let parseWarning = false;

  if (grandTotal > 0) {
    const linesPayableTotal = lines.reduce((sum, l) => sum + l.payableAmount, 0);
    const diff = Math.abs(linesPayableTotal - grandTotal);

    if (diff > 1) {
      parseErrors.push(
        `Parse bütünlük hatası: Satır toplamı ${linesPayableTotal.toFixed(2)} TL, fatura toplamı ${grandTotal.toFixed(2)} TL. Bazı sayfalar okunamıyor olabilir.`
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
