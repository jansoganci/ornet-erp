/**
 * Finance export utilities - source type to Turkish label mapping
 */

/**
 * Get translated label for source_type (category/kaynak).
 * Uses finance:expenseCategories for expense, finance:income.incomeTypes for income.
 * @param {string} sourceType - Raw source_type from v_profit_and_loss
 * @param {string} direction - 'income' or 'expense'
 * @param {Function} t - i18n t function
 * @returns {string} - Translated label or raw key if no translation
 */
export function getSourceLabel(sourceType, direction, t) {
  if (!sourceType) return '';

  const key =
    direction === 'income'
      ? `finance:income.incomeTypes.${sourceType}`
      : `finance:expenseCategories.${sourceType}`;

  const translated = t(key);
  return translated === key ? sourceType : translated;
}
