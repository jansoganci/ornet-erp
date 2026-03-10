/**
 * CSV export utilities - lightweight, dependency-free
 */

/**
 * Escape a value for CSV (wrap in quotes if contains comma, quote, or newline)
 * @param {string|number} value - Cell value
 * @returns {string} - Escaped value
 */
function escapeCSVValue(value) {
  if (value == null) return '';
  const str = String(value);
  if (/[,"\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convert array of objects to CSV string. Escapes commas and quotes.
 * @param {Array<Object>} rows - Data rows
 * @param {Array<{key: string, header: string}>} columns - Column definitions
 * @returns {string} - CSV content
 */
export function toCSV(rows, columns) {
  if (!rows?.length || !columns?.length) return '';

  const headerRow = columns.map((col) => escapeCSVValue(col.header)).join(',');
  const dataRows = rows.map((row) =>
    columns.map((col) => escapeCSVValue(row[col.key])).join(',')
  );

  return [headerRow, ...dataRows].join('\n');
}

/**
 * Trigger browser download of a CSV file.
 * @param {string} csvContent - CSV string
 * @param {string} filename - e.g. "KDV_Raporu_2025-03.csv"
 */
export function downloadCSV(csvContent, filename) {
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
