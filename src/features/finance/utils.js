/** Gross collectible total: net + output VAT. */
export function grossCollectibleTotal(amountTry, outputVat) {
  return (Number(amountTry) || 0) + (Number(outputVat) || 0);
}

/** Format finance period `YYYY-MM` as Turkish month label (e.g. "Mart 2026"). */
export function formatFinancePeriodLabel(period, t) {
  if (!period || typeof period !== 'string') return null;
  const [year, month] = period.split('-');
  const monthIdx = Number(month) - 1;
  if (!year || Number.isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11) return period;
  return `${t(`common:monthsFull.${monthIdx}`)} ${year}`;
}

/**
 * Best available "work done" date for a receivable row.
 * Prefers work-order / proposal completion, then scheduled date, then ledger date.
 */
export function getReceivableWorkDate(row) {
  return (
    row?.work_orders?.completed_at ||
    row?.proposals?.completed_at ||
    row?.work_orders?.scheduled_date ||
    row?.transaction_date ||
    null
  );
}

/** Remaining gross collectible after payments. */
export function grossRemainingCollectible(amountTry, outputVat, totalCollected) {
  return Math.max(0, grossCollectibleTotal(amountTry, outputVat) - (Number(totalCollected) || 0));
}

export function isPartialPaymentStatus(status) {
  return status === 'partial' || status === 'partially_paid';
}

/** True when the finance period is before the current calendar month. */
export function isReceivablePeriodOverdue(period) {
  if (!period || typeof period !== 'string') return false;
  const now = new Date();
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return period < current;
}

export function getReceivableRowAmounts(row) {
  const documentTotal = grossCollectibleTotal(row?.amount_try, row?.output_vat);
  const collected = Number(row?.total_collected) || 0;
  const remaining = grossRemainingCollectible(row?.amount_try, row?.output_vat, collected);
  return { documentTotal, collected, remaining };
}

export function summarizeReceivableRows(rows = []) {
  let totalOutstanding = 0;
  let partialCount = 0;
  let overdueCount = 0;

  for (const row of rows) {
    const { remaining } = getReceivableRowAmounts(row);
    totalOutstanding += remaining;
    if (isPartialPaymentStatus(row.payment_status)) partialCount += 1;
    if (isReceivablePeriodOverdue(row.period)) overdueCount += 1;
  }

  return {
    totalOutstanding,
    documentCount: rows.length,
    partialCount,
    overdueCount,
  };
}

/**
 * Compute total COGS in USD from proposal items.
 * Per spec: IF any of (product_cost_usd, labor_cost_usd, material_cost_usd, shipping_cost_usd, misc_cost_usd) filled:
 *   Total = SUM(those 5) * quantity
 * ELSE:
 *   Total = cost_usd * quantity
 * @param {Array} items - proposal_items from fetchProposalItems
 * @returns {number} Total COGS in USD
 */
export function computeProposalCogsUsd(items = []) {
  return items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 1;
    const productCost = item.product_cost ?? item.product_cost_usd;
    const laborCost = item.labor_cost ?? item.labor_cost_usd;
    const materialCost = item.material_cost ?? item.material_cost_usd;
    const shippingCost = item.shipping_cost ?? item.shipping_cost_usd;
    const miscCost = item.misc_cost ?? item.misc_cost_usd;
    const costVal = item.cost ?? item.cost_usd;
    const hasDetail =
      (productCost != null && productCost !== 0) ||
      (laborCost != null && laborCost !== 0) ||
      (materialCost != null && materialCost !== 0) ||
      (shippingCost != null && shippingCost !== 0) ||
      (miscCost != null && miscCost !== 0);

    let itemCogs;
    if (hasDetail) {
      itemCogs =
        (Number(productCost) || 0) +
        (Number(laborCost) || 0) +
        (Number(materialCost) || 0) +
        (Number(shippingCost) || 0) +
        (Number(miscCost) || 0);
    } else {
      itemCogs = Number(costVal) || 0;
    }
    return sum + itemCogs * qty;
  }, 0);
}
