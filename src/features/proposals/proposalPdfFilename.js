import { format } from 'date-fns';
import { sanitizeDownloadFileName } from '../../lib/utils';

function segment(s) {
  if (!s || !String(s).trim()) return '';
  return String(s).trim().replace(/\s+/g, '_');
}

/**
 * Default PDF base name: customer_site_dd.MM.yyyy (proposal currency-agnostic).
 * Uses customer_company_name + site_name + today's date; falls back to proposal_no.
 * @param {object} proposal — row from proposals_detail
 * @returns {string} — sanitized base name without .pdf
 */
export function buildDefaultProposalPdfFilename(proposal) {
  const customer = segment(proposal?.customer_company_name);
  const site = segment(proposal?.site_name);
  const dateStr = format(new Date(), 'dd.MM.yyyy');
  const parts = [customer, site, dateStr].filter(Boolean);
  if (parts.length === 0) {
    return sanitizeDownloadFileName(proposal?.proposal_no || 'teklif');
  }
  return sanitizeDownloadFileName(parts.join('_'));
}
