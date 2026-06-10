import { parseTurkcellPdf } from './parseTurkcellPdf';
import { parseTurkcellCsv } from './parseTurkcellCsv';

/**
 * Parse Turkcell invoice by file extension (.pdf or .csv).
 * @param {File} file
 * @returns {Promise<import('./parseTurkcellPdf').TurkcellParseResult & { sourceFormat: 'pdf' | 'csv' }>}
 */
export async function parseTurkcellInvoice(file) {
  const name = file.name.toLowerCase();

  if (name.endsWith('.csv')) {
    const result = await parseTurkcellCsv(file);
    return { ...result, sourceFormat: 'csv' };
  }

  if (name.endsWith('.pdf')) {
    const result = await parseTurkcellPdf(file);
    return { ...result, sourceFormat: 'pdf' };
  }

  throw new Error('unsupported_format');
}
