/**
 * Compare parsed Turkcell invoice lines against sim_cards inventory.
 * Returns categorized results and a summary object.
 */

/** TRY cost increase threshold: invoice exceeds stored cost_price by this amount or more. */
export const COST_INCREASE_THRESHOLD = 1;

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

/**
 * Cost increase check: invoice amount >= stored cost_price + threshold (1 TL).
 * @param {number} invoiceAmount - from Turkcell PDF
 * @param {number} costPrice - stored in sim_cards table
 */
function isCostIncrease(invoiceAmount, costPrice) {
  if (!costPrice || costPrice <= 0) return false;
  return invoiceAmount >= costPrice + COST_INCREASE_THRESHOLD;
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
      const profit = salePrice - line.invoiceAmount;
      const isLoss = profit < 0;
      const hasCostIncrease = hasUnknownCost ? false : isCostIncrease(line.invoiceAmount, costPrice);

      matched.push({
        ...line,
        simCard,
        costPrice,
        salePrice,
        priceDiff,
        profit,
        isLoss,
        isCostIncrease: hasCostIncrease,
        hasUnknownCost,
        buyer: simCard.buyer?.company_name || null,
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
  const costIncreaseCount = matched.filter((m) => m.isCostIncrease).length;
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
    lossCount,
    unknownCostCount,
  };

  return { matched, invoiceOnly, inventoryOnly, summary, duplicateHatNos, unresolvableCards };
}
