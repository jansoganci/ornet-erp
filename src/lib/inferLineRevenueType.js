import { normalizeForSearch } from './normalizeForSearch';

/** Turkish/English hints that a line is labor/service revenue (including catalog service SKUs). */
const LABOR_SERVICE_KEYWORDS = [
  'hizmet',
  'servis',
  'iscilik',
  'montaj',
  'devreye',
  'devreye alma',
  'devreye alim',
  'kurulum',
  'bakim',
  'destek',
  'izleme',
  'danismanlik',
  'kesif',
  'bedel',
  'bedeli',
  'labor',
  'service',
  'installation',
  'commissioning',
];

function descriptionSuggestsLaborService(description) {
  const normalized = normalizeForSearch(description);
  if (!normalized.trim()) return false;
  return LABOR_SERVICE_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

/**
 * Infer line revenue_type from description + optional catalog link.
 * Description keywords win over material_id — service SKUs in materials catalog
 * should still classify as labor_service for internal reporting.
 */
export function inferLineRevenueType({ description, materialId, revenueType } = {}) {
  if (descriptionSuggestsLaborService(description)) {
    return 'labor_service';
  }

  if (materialId) return 'material';

  const valid = ['material', 'labor_service', 'other'];
  if (valid.includes(revenueType) && revenueType !== 'material') {
    return revenueType;
  }

  const normalized = normalizeForSearch(description);
  if (!normalized.trim()) return 'other';

  return 'other';
}

/** @deprecated Use inferLineRevenueType — kept for existing proposal imports */
export function inferProposalRevenueType(args) {
  return inferLineRevenueType(args);
}
