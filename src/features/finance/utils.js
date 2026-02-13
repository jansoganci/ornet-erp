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
