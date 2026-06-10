/**
 * Compare parsed Turkcell invoice lines against sim_cards inventory.
 * Returns categorized results and a summary object.
 */

import { getCostDiffTier, COST_DIFF_MIN } from './costDiffTiers';

/** @deprecated Use costDiffTier tiers; kept for filter compatibility */
export const COST_INCREASE_THRESHOLD = COST_DIFF_MIN;

/**
 * Normalize a phone number to bare 10-digit format.
 * Handles: +90XXXXXXXXXX, 0XXXXXXXXXX, XXXXXXXXXX
 * Returns null for numbers that cannot be resolved to exactly 10 digits.
 */
function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('90')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  if (digits.length === 10) return digits;
  return null; // unrecognised format — do not guess
}

function isCostIncrease(costDiffTier) {
  return costDiffTier !== 'none';
}

/**
 * Compare invoice lines vs Turkcell sim_cards inventory.
 *
 * @param {Array} invoiceLines - From parseTurkcellPdf()
 * @param {Array} simCards - From fetchAllTurkcellSimCards() (Turkcell only)
 * @returns {{
 *   matched: Array,
 *   invoiceOnly: Array,
 *   inventoryOnly: Array,
 *   summary: Object
 * }}
 */
export function compareInvoiceToInventory(invoiceLines, simCards) {
  // Build invoice map: hatNo → line (warn on duplicates)
  const invoiceMap = new Map();
  const duplicateHatNos = [];
  for (const line of invoiceLines) {
    if (invoiceMap.has(line.hatNo)) {
      duplicateHatNos.push(line.hatNo);
    }
    invoiceMap.set(line.hatNo, line);
  }

  // Build inventory map: normalized phone → simCard
  // Cards whose phone_number cannot be resolved to 10 digits are skipped.
  const inventoryMap = new Map();
  const unresolvableCards = [];
  for (const card of simCards) {
    const normalized = normalizePhone(card.phone_number);
    if (normalized === null) {
      unresolvableCards.push(card.phone_number);
    } else {
      inventoryMap.set(normalized, card);
    }
  }

  const matched = [];
  const invoiceOnly = [];
  const inventoryOnly = [];

  // Process invoice lines
  for (const [hatNo, line] of invoiceMap) {
    const simCard = inventoryMap.get(hatNo);

    if (simCard) {
      const hasUnknownCost = simCard.cost_price == null || simCard.cost_price === undefined;
      const costPrice = hasUnknownCost ? null : (simCard.cost_price || 0);
      const salePrice = simCard.sale_price || 0;
      const priceDiff = hasUnknownCost ? null : line.invoiceAmount - costPrice;
      const costDiffTier = hasUnknownCost ? 'none' : getCostDiffTier(priceDiff);
      const profit = salePrice - line.invoiceAmount;
      const isLoss = profit < 0;
      const hasCostIncrease = isCostIncrease(costDiffTier);

      matched.push({
        ...line,
        simCard,
        costPrice,
        salePrice,
        priceDiff,
        costDiffTier,
        profit,
        isLoss,
        isCostIncrease: hasCostIncrease,
        hasUnknownCost,
        buyer: simCard.buyer?.company_name || simCard.customers?.company_name || null,
      });
    } else {
      invoiceOnly.push(line);
    }
  }

  // Find inventory-only (in DB but not in invoice)
  for (const [normalizedPhone, simCard] of inventoryMap) {
    if (!invoiceMap.has(normalizedPhone)) {
      inventoryOnly.push(simCard);
    }
  }

  // Compute summary
  const totalInvoiceAmount = invoiceLines.reduce((s, l) => s + l.invoiceAmount, 0);
  const matchedInvoiceTotal = matched.reduce((s, m) => s + m.invoiceAmount, 0);
  const totalProfit = matched.reduce((s, m) => s + m.profit, 0);
  const costDiffHighCount = matched.filter((m) => m.costDiffTier === 'high').length;
  const costDiffMediumCount = matched.filter((m) => m.costDiffTier === 'medium').length;
  const costDiffLowCount = matched.filter((m) => m.costDiffTier === 'low').length;
  const costIncreaseCount = costDiffHighCount + costDiffMediumCount + costDiffLowCount;
  const lossCount = matched.filter((m) => m.isLoss).length;
  const unknownCostCount = matched.filter((m) => m.hasUnknownCost).length;
  const invoiceOnlyTotal = invoiceOnly.reduce((s, l) => s + l.invoiceAmount, 0);

  const summary = {
    totalLines: invoiceLines.length,
    matchedCount: matched.length,
    invoiceOnlyCount: invoiceOnly.length,
    inventoryOnlyCount: inventoryOnly.length,
    totalInvoiceAmount,
    matchedInvoiceTotal,
    invoiceOnlyTotal,
    totalProfit,
    costIncreaseCount,
    costDiffHighCount,
    costDiffMediumCount,
    costDiffLowCount,
    lossCount,
    unknownCostCount,
  };

  const byDiffDesc = (a, b) => (b.priceDiff ?? 0) - (a.priceDiff ?? 0);
  const costDiffHigh = matched.filter((m) => m.costDiffTier === 'high').sort(byDiffDesc);
  const costDiffMedium = matched.filter((m) => m.costDiffTier === 'medium').sort(byDiffDesc);
  const costDiffLow = matched.filter((m) => m.costDiffTier === 'low').sort(byDiffDesc);

  return {
    matched,
    invoiceOnly,
    inventoryOnly,
    costDiffHigh,
    costDiffMedium,
    costDiffLow,
    summary,
    duplicateHatNos,
    unresolvableCards,
  };
}
