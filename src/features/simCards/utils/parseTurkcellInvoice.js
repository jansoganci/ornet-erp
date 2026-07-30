import { parseTurkcellPdf } from './parseTurkcellPdf';
import { parseTurkcellCsv } from './parseTurkcellCsv';
import { parseTurkcellXml } from './parseTurkcellXml';

/**
 * Parse Turkcell invoice by file extension (.pdf, .csv, or .xml).
 * @param {File} file
 * @returns {Promise<import('./parseTurkcellPdf').TurkcellParseResult & { sourceFormat: 'pdf' | 'csv' | 'xml' }>}
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

  if (name.endsWith('.xml')) {
    const result = await parseTurkcellXml(file);
    return { ...result, sourceFormat: 'xml' };
  }

  throw new Error('unsupported_format');
}
