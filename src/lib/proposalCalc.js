/**
 * Shared calculation engine for Proposals.
 * All amounts are VAT-exclusive (KDV hariç).
 * Used by: ProposalItemsEditor, ProposalAnnualFixedCostsEditor, ProposalDetailPage,
 * ProposalPdf, ProposalLivePreview.
 *
 * proposal_items (and work_order_materials with the same split) store amounts in two columns:
 * `unit_price` / `unit_price_usd` — only the column matching the parent row's `currency` is filled;
 * the other is set to 0. Using `??` is wrong because 0 is a valid stored value.
 */

/**
 * Resolve a dual-currency field (local vs USD columns) for the parent's currency.
 * @param {Record<string, unknown>} item
 * @param {string} [parentCurrency]
 * @param {string} localKey
 * @param {string} usdKey
 * @returns {number}
 */
function resolveDualCurrencyAmount(item, parentCurrency, localKey, usdKey) {
  const cur = (parentCurrency || 'USD').toUpperCase();
  const localVal = item[localKey];
  const usdVal = item[usdKey];
  if (cur === 'USD') {
    const u = Number(usdVal);
    if (Number.isFinite(u)) return u;
    const l = Number(localVal);
    return Number.isFinite(l) ? l : 0;
  }
  const l = Number(localVal);
  if (Number.isFinite(l)) return l;
  const u = Number(usdVal);
  return Number.isFinite(u) ? u : 0;
}

/**
 * Unit price in the proposal/work order's currency (handles `unit_price` + `unit_price_usd` split).
 * @param {object} item — proposal line or work_order_materials row
 * @param {string} [targetCurrency] — same as proposals.currency / work_orders.currency (e.g. TRY, USD)
 * @returns {number}
 */
export function resolveProposalItemUnitPrice(item, targetCurrency = 'USD') {
  return resolveDualCurrencyAmount(item, targetCurrency, 'unit_price', 'unit_price_usd');
}

/**
 * Internal per-unit cost in the parent's currency (`cost` + `cost_usd` split).
 * @param {object} item
 * @param {string} [targetCurrency]
 * @returns {number}
 */
export function resolveProposalItemCost(item, targetCurrency = 'USD') {
  return resolveDualCurrencyAmount(item, targetCurrency, 'cost', 'cost_usd');
}

/**
 * Line total for a stored proposal item (prefers generated `line_total` / `total_usd` when valid).
 * @param {object} item
 * @param {string} [proposalCurrency]
 * @returns {number}
 */
export function resolveProposalItemLineTotal(item, proposalCurrency = 'USD') {
  const cur = (proposalCurrency || 'USD').toUpperCase();
  if (cur === 'USD') {
    const totalUsd = Number(item.total_usd);
    if (Number.isFinite(totalUsd)) return totalUsd;
    return calcItemLineTotal(item.quantity, resolveProposalItemUnitPrice(item, 'USD'));
  }
  const lineTotal = Number(item.line_total);
  if (Number.isFinite(lineTotal)) return lineTotal;
  return calcItemLineTotal(item.quantity, resolveProposalItemUnitPrice(item, cur));
}

/**
 * Calculate a single line item total.
 * @param {number} quantity
 * @param {number} unitPrice
 * @returns {number}
 */
export function calcItemLineTotal(quantity, unitPrice) {
  return (Number(quantity) || 0) * (Number(unitPrice) || 0);
}

/**
 * Calculate proposal totals from items and discount.
 * @param {Array<object>} items
 * @param {number} [discountPercent=0]
 * @param {string} [proposalCurrency] — must match proposals.currency for correct line totals from DB
 * @returns {{ subtotal: number, discountAmount: number, grandTotal: number }}
 */
export function calcProposalTotals(items = [], discountPercent = 0, proposalCurrency = 'USD') {
  const subtotal = items.reduce((sum, item) => {
    return sum + resolveProposalItemLineTotal(item, proposalCurrency);
  }, 0);

  const pct = Math.min(Math.max(Number(discountPercent) || 0, 0), 100);
  const discountAmount = Math.round((subtotal * pct / 100) * 100) / 100;
  const grandTotal = subtotal - discountAmount;

  return { subtotal, discountAmount, grandTotal };
}

export function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/**
 * Calculate subtotal, discount amount, and net total for a single section's items.
 * @param {Array<object>} items — items belonging to this section
 * @param {number} [discountPercent=0]
 * @param {string} [proposalCurrency]
 * @returns {{ subtotal: number, discountAmount: number, sectionTotal: number }}
 */
export function calcSectionTotal(items = [], discountPercent = 0, proposalCurrency = 'USD') {
  const subtotal = items.reduce((sum, item) => {
    return sum + resolveProposalItemLineTotal(item, proposalCurrency);
  }, 0);
  const pct = Math.min(Math.max(Number(discountPercent) || 0, 0), 100);
  const discountAmount = round2(subtotal * pct / 100);
  const sectionTotal = round2(subtotal - discountAmount);
  return { subtotal, discountAmount, sectionTotal };
}

/**
 * VAT + Tevkifat summary for a net amount.
 * @param {number} netAmount
 * @param {number} vatRate
 * @param {boolean} hasTevkifat
 * @param {number} tevkifatNumerator
 * @param {number} tevkifatDenominator
 * @returns {{ vatAmount: number, totalWithVat: number, withheldVat: number, totalPayable: number }}
 */
export function calcVatTevkifatSummary(
  netAmount,
  vatRate = 0,
  hasTevkifat = false,
  tevkifatNumerator = 9,
  tevkifatDenominator = 10,
) {
  const base = Number(netAmount) || 0;
  const rate = Math.max(Number(vatRate) || 0, 0);
  const vatAmount = round2(base * rate / 100);
  const totalWithVat = round2(base + vatAmount);

  const n = Math.max(Number(tevkifatNumerator) || 0, 0);
  const dRaw = Number(tevkifatDenominator);
  const d = Number.isFinite(dRaw) && dRaw > 0 ? dRaw : 1;
  const withheldVat = hasTevkifat ? round2(vatAmount * n / d) : 0;
  const totalPayable = round2(totalWithVat - withheldVat);

  return { vatAmount, totalWithVat, withheldVat, totalPayable };
}

/**
 * Calculate total internal costs from items.
 * @param {Array<object>} items
 * @param {string} [proposalCurrency]
 * @returns {number}
 */
export function calcTotalCosts(items = [], proposalCurrency = 'USD') {
  return items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    const cost = resolveProposalItemCost(item, proposalCurrency);
    if (!Number.isNaN(cost) && cost > 0) return sum + cost * qty;

    const breakdown =
      (Number(item.product_cost) || 0) +
      (Number(item.labor_cost) || 0) +
      (Number(item.shipping_cost) || 0) +
      (Number(item.material_cost) || 0) +
      (Number(item.misc_cost) || 0);
    return sum + breakdown * qty;
  }, 0);
}

/** Annual fixed-cost line (informational; per-row currency). */
export function calcAnnualFixedLineTotal(quantity, unitPrice) {
  return calcItemLineTotal(quantity, unitPrice);
}

const ANNUAL_FIXED_CURRENCY_ORDER = ['TRY', 'USD', 'EUR'];

/**
 * Sum annual fixed rows by currency (non-zero totals only).
 * @param {Array<{ quantity?: unknown, unit_price?: unknown, currency?: string }>} rows
 * @returns {Record<string, number>}
 */
export function sumAnnualFixedCostsByCurrency(rows = []) {
  const sums = {};
  for (const row of rows) {
    const cur = (row.currency || 'TRY').toUpperCase();
    const line = calcAnnualFixedLineTotal(row.quantity, row.unit_price);
    if (!Number.isFinite(line) || line === 0) continue;
    sums[cur] = (sums[cur] || 0) + line;
  }
  const ordered = ANNUAL_FIXED_CURRENCY_ORDER.filter(
    (c) => sums[c] != null && sums[c] !== 0,
  ).map((c) => [c, sums[c]]);
  const extras = Object.entries(sums).filter(
    ([c, v]) => !ANNUAL_FIXED_CURRENCY_ORDER.includes(c) && v != null && v !== 0,
  );
  return Object.fromEntries([...ordered, ...extras]);
}
