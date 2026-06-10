/**
 * Turkcell invoice CSV parser (semicolon-separated export).
 * Columns: GSM NO, FATURA TARIHI, FATURA SON ODEME TARIHI, KDV/OIV breakdown, FATURA TOPLAM TUTARI.
 */

import { parseCurrencySafe } from './parseCurrency';

const GSM_HEADER = 'GSM NO';
const INVOICE_DATE_HEADER = 'FATURA TARIHI';
const PAYMENT_DATE_HEADER = 'FATURA SON ODEME TARIHI';
const TOTAL_HEADER = 'FATURA TOPLAM TUTARI';

function normalizeHeader(cell) {
  return String(cell || '').trim().toUpperCase();
}

function isKdvAmountHeader(header) {
  const h = normalizeHeader(header);
  return /^KDV[-\s]/.test(h) && !h.includes('MATRAHI') && !h.includes('0%');
}

function isOivAmountHeader(header) {
  const h = normalizeHeader(header);
  return /^OIV/.test(h) && !h.includes('MATRAHI') && !h.includes('0%');
}

function parseCsvLine(line) {
  return line.split(';').map((cell) => cell.trim());
}

/**
 * @param {File} file
 * @returns {Promise<import('./parseTurkcellPdf').TurkcellParseResult>}
 */
export async function parseTurkcellCsv(file) {
  const text = await file.text();
  const rawLines = text.split(/\r?\n/).filter((line) => line.trim() !== '');

  const parseErrors = [];
  const lines = [];
  const tariffBreakdown = new Map();

  if (rawLines.length < 2) {
    return emptyResult(parseErrors, 'CSV dosyası boş veya geçersiz.');
  }

  const headers = parseCsvLine(rawLines[0]);
  const gsmIdx = headers.findIndex((h) => normalizeHeader(h) === GSM_HEADER);
  const invoiceDateIdx = headers.findIndex((h) => normalizeHeader(h) === INVOICE_DATE_HEADER);
  const paymentDateIdx = headers.findIndex((h) => normalizeHeader(h) === PAYMENT_DATE_HEADER);
  const totalIdx = headers.findIndex((h) => normalizeHeader(h) === TOTAL_HEADER);

  if (gsmIdx === -1 || totalIdx === -1) {
    parseErrors.push('CSV başlık satırı tanınamadı. Turkcell fatura CSV formatı bekleniyor.');
    return emptyResult(parseErrors);
  }

  const kdvIndices = headers.map((h, i) => (isKdvAmountHeader(h) ? i : -1)).filter((i) => i >= 0);
  const oivIndices = headers.map((h, i) => (isOivAmountHeader(h) ? i : -1)).filter((i) => i >= 0);

  let invoiceDate = null;
  let paymentDate = null;
  let grandTotal = 0;

  for (let rowIdx = 1; rowIdx < rawLines.length; rowIdx++) {
    const cells = parseCsvLine(rawLines[rowIdx]);
    const gsmCell = cells[gsmIdx] ?? '';

    if (/^toplam/i.test(gsmCell)) {
      grandTotal = parseCurrencySafe(cells[totalIdx]);
      continue;
    }

    const hatNo = gsmCell.replace(/\D/g, '');
    if (hatNo.length !== 10) {
      continue;
    }

    const invoiceAmount = parseCurrencySafe(cells[totalIdx]);
    const kdvAmount = kdvIndices.reduce((sum, i) => sum + parseCurrencySafe(cells[i]), 0);
    const oivAmount = oivIndices.reduce((sum, i) => sum + parseCurrencySafe(cells[i]), 0);

    if (!invoiceDate && invoiceDateIdx >= 0) {
      invoiceDate = cells[invoiceDateIdx] || null;
    }
    if (!paymentDate && paymentDateIdx >= 0) {
      paymentDate = cells[paymentDateIdx] || null;
    }

    lines.push({
      hatNo,
      tariff: '—',
      invoiceAmount,
      payableAmount: invoiceAmount,
      kdvAmount,
      oivAmount,
    });

    const existing = tariffBreakdown.get('—') || { count: 0, total: 0 };
    tariffBreakdown.set('—', {
      count: existing.count + 1,
      total: existing.total + invoiceAmount,
    });
  }

  const totalInvoiceAmount = lines.reduce((sum, l) => sum + l.invoiceAmount, 0);

  let parseWarning = false;
  if (grandTotal > 0) {
    const diff = Math.abs(totalInvoiceAmount - grandTotal);
    if (diff > 1) {
      parseErrors.push(
        `Parse bütünlük hatası: Satır toplamı ${totalInvoiceAmount.toFixed(2)} TL, CSV toplam satırı ${grandTotal.toFixed(2)} TL.`
      );
      parseWarning = true;
    }
  }

  return {
    invoiceNo: null,
    invoiceDate,
    paymentDate,
    grandTotal: grandTotal || totalInvoiceAmount,
    lines,
    totalInvoiceAmount,
    tariffBreakdown,
    parseErrors,
    parseWarning,
  };
}

function emptyResult(parseErrors, message) {
  if (message) parseErrors.push(message);
  return {
    invoiceNo: null,
    invoiceDate: null,
    paymentDate: null,
    grandTotal: 0,
    lines: [],
    totalInvoiceAmount: 0,
    tariffBreakdown: new Map(),
    parseErrors,
    parseWarning: false,
  };
}
