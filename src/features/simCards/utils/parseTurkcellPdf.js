/**
 * Turkcell PDF invoice parser using pdfjs-dist.
 * Extracts hat (line) data from the "Fatura Notu" section.
 *
 * Each line in the PDF follows the pattern:
 *   F2-{hatNo}?{tariff}#{invoiceAmount}${kdv}+{oiv}!{total}
 */

import * as pdfjsLib from 'pdfjs-dist';

// Configure worker — Vite 7 handles asset URLs natively
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

/**
 * Line regex: F2-{10 digits}?{tariff}#{amount}${kdv}+{oiv}!{total}
 * Captures: hatNo, tariff, invoiceAmount, kdv, oiv, total
 */
const LINE_REGEX = /F2-(\d{10})\?([^#]*)#([\d.]+)\$([\d.]+)\+([\d.]+)!([\d.]+)/g;

/**
 * Parse a Turkcell invoice PDF file.
 * @param {File} file - PDF file selected by user
 * @returns {Promise<{
 *   lines: Array,
 *   totalInvoiceAmount: number,
 *   tariffBreakdown: Map<string, {count: number, total: number}>,
 *   parseErrors: string[]
 * }>}
 */
export async function parseTurkcellPdf(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const lines = [];
  const parseErrors = [];
  const tariffBreakdown = new Map();

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    try {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Join all text items on this page with a space
      const pageText = textContent.items.map((item) => item.str).join(' ');

      // Apply regex globally to find all hat lines
      let match;
      LINE_REGEX.lastIndex = 0;
      while ((match = LINE_REGEX.exec(pageText)) !== null) {
        const [, hatNo, tariff, invoiceAmountStr, kdvStr, oivStr, totalStr] = match;

        const invoiceAmount = parseFloat(invoiceAmountStr) || 0;
        const kdv = parseFloat(kdvStr) || 0;
        const oiv = parseFloat(oivStr) || 0;
        const total = parseFloat(totalStr) || 0;
        const tariffClean = tariff.trim();

        lines.push({
          hatNo,
          tariff: tariffClean,
          invoiceAmount,
          kdv,
          oiv,
          total,
        });

        // Accumulate tariff breakdown
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

  // Total invoice amount = sum of all invoiceAmount fields
  const totalInvoiceAmount = lines.reduce((sum, l) => sum + l.invoiceAmount, 0);

  return {
    lines,
    totalInvoiceAmount,
    tariffBreakdown,
    parseErrors,
  };
}
