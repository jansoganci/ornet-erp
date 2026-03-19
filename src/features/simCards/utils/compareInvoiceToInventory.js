/**
 * Compare parsed Turkcell invoice lines against sim_cards inventory.
 * Returns categorized results and a summary object.
 */

/** TRY overage threshold: invoice amount must exceed cost + this to flag as overage. */
export const OVERAGE_THRESHOLD = 20;

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
 * Overage threshold: both conditions must be true to avoid false positives.
 * @param {number} invoiceAmount
 * @param {number} costPrice
 */
function isOverage(invoiceAmount, costPrice) {
  if (!costPrice || costPrice <= 0) return false;
  return invoiceAmount > costPrice * 1.5 && invoiceAmount > costPrice + OVERAGE_THRESHOLD;
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
      const hasOverage = hasUnknownCost ? false : isOverage(line.invoiceAmount, costPrice);

      matched.push({
        ...line,
        simCard,
        costPrice,
        salePrice,
        priceDiff,
        profit,
        isLoss,
        isOverage: hasOverage,
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
  const overageCount = matched.filter((m) => m.isOverage).length;
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
    overageCount,
    lossCount,
    unknownCostCount,
  };

  return { matched, invoiceOnly, inventoryOnly, summary, duplicateHatNos, unresolvableCards };
}
