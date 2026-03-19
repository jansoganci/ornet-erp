import * as XLSX from 'xlsx';

/**
 * Excel column headers for site_assets bulk import.
 */
export const TEMPLATE_HEADERS = ['MÜŞTERİ', 'ACC', 'EKİPMAN', 'ADET', 'KURULUM TARİHİ'];

const MAX_ROWS = 1000;

function trim(val) {
  if (val == null) return '';
  return String(val).trim();
}

function sanitizeCell(val) {
  if (val == null) return '';
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return '';
    return Number.isInteger(val) ? String(val) : String(Math.round(val));
  }
  return String(val).split(/[\r\n]/)[0].trim();
}

/**
 * Convert Excel serial to UTC date string (YYYY-MM-DD).
 */
function excelSerialToDate(serial) {
  const utcMs = (serial - 25569) * 86400 * 1000;
  const date = new Date(utcMs);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseInstallationDate(val) {
  const s = trim(val);
  if (!s) return null;
  if (/^(\d{4})-(\d{2})-(\d{2})$/.test(s)) return s;
  const dmy = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(s);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const excelSerial = Number(s);
  if (!Number.isNaN(excelSerial) && excelSerial > 1) {
    const isoDate = excelSerialToDate(excelSerial);
    const year = parseInt(isoDate.slice(0, 4), 10);
    if (year <= 1900) return null;
    return isoDate;
  }
  return null;
}

/**
 * Parse .xlsx file buffer into array of row objects.
 */
export function parseXlsxFile(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const firstSheet = wb.SheetNames[0];
  if (!firstSheet) return [];
  const ws = wb.Sheets[firstSheet];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (!data.length) return [];
  const headers = data[0].map((h) => trim(h));
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const arr = data[i];
    if (arr.every((v) => v === '' || v == null)) continue;
    const obj = {};
    headers.forEach((h, j) => {
      obj[h] = arr[j] != null ? arr[j] : '';
    });
    rows.push(obj);
  }
  return rows;
}

/**
 * Validate and map Excel rows to internal payload objects.
 * Returns { rows, errors }. Rows have account_no (for later site resolution), equipment_name, quantity, installation_date.
 */
export function validateAndMapRows(excelRows) {
  const errors = [];
  const rows = [];

  if (excelRows.length > MAX_ROWS) {
    errors.push({ rowNum: 0, field: '_limit', message: 'MAX_ROWS', rowIndex: -1 });
    return { rows: [], errors };
  }

  excelRows.forEach((raw, rowIndex) => {
    const rowNum = rowIndex + 2;
    const get = (key) => trim(raw[key] ?? '');

    const company_name = get('MÜŞTERİ');
    const account_no = sanitizeCell(raw['ACC']);
    const equipment_name = get('EKİPMAN');
    const quantity_raw = get('ADET');
    const installation_date_raw = get('KURULUM TARİHİ');

    if (!account_no) errors.push({ rowNum, field: 'ACC', message: 'required', rowIndex });
    if (!equipment_name) errors.push({ rowNum, field: 'EKİPMAN', message: 'required', rowIndex });

    let quantity = 1;
    if (quantity_raw) {
      const q = parseInt(quantity_raw, 10);
      if (Number.isNaN(q) || q < 1) {
        errors.push({ rowNum, field: 'ADET', message: 'invalid_quantity', rowIndex });
      } else {
        quantity = Math.min(q, 999);
      }
    }

    let installation_date = null;
    if (installation_date_raw) {
      installation_date = parseInstallationDate(installation_date_raw);
      if (!installation_date) {
        errors.push({ rowNum, field: 'KURULUM TARİHİ', message: 'invalid_date', rowIndex });
      }
    }

    rows.push({
      company_name: company_name || null,
      account_no: account_no || null,
      equipment_name: equipment_name?.trim() || null,
      quantity,
      installation_date,
    });
  });

  return { rows, errors };
}

/**
 * Build template sheet and return as Blob for download.
 */
export function buildTemplateBlob() {
  const exampleRow = ['Örnek Firma A.Ş.', 'ACC-001', 'Alarm Paneli', '2', '2024-01-15'];
  const wsData = [TEMPLATE_HEADERS, exampleRow];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = TEMPLATE_HEADERS.map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Varlıklar');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export const MAX_IMPORT_ROWS = MAX_ROWS;
