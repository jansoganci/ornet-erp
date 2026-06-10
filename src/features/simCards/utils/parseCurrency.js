/**
 * Parse currency string, handling Turkish format (1.234,56) and US format (1,234.56).
 * Returns 0 on parse failure instead of NaN.
 */
export function parseCurrencySafe(str) {
  if (str == null || str === '') return 0;
  let s = String(str).trim().replace(/\s/g, '');
  if (/^\d{1,3}(\.\d{3})*,\d+$/.test(s) || /^\d+,\d+$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',') && s.includes('.')) {
    s = s.replace(/,/g, '');
  } else if (/^\d{1,3}(,\d{3})*\.\d+$/.test(s) || /^\d+\.\d+$/.test(s)) {
    s = s.replace(/,/g, '');
  } else if (s.includes(',')) {
    s = s.replace(/,/g, '.');
  }
  const n = parseFloat(s.replace(/[^\d.-]/g, ''));
  return Number.isNaN(n) ? 0 : n;
}
