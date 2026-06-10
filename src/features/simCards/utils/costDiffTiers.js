/** fark < 1 TL → ignore */
export const COST_DIFF_MIN = 1;

/** 1 ≤ fark < 10 → low */
export const COST_DIFF_LOW_MAX = 10;

/** 10 ≤ fark < 25 → medium */
export const COST_DIFF_MEDIUM_MAX = 25;

/** @typedef {'none' | 'low' | 'medium' | 'high'} CostDiffTier */

/**
 * Classify invoiceAmount − cost_price difference.
 * @param {number|null|undefined} diff
 * @returns {CostDiffTier}
 */
export function getCostDiffTier(diff) {
  if (diff == null || diff < COST_DIFF_MIN) return 'none';
  if (diff < COST_DIFF_LOW_MAX) return 'low';
  if (diff < COST_DIFF_MEDIUM_MAX) return 'medium';
  return 'high';
}
