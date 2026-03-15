import * as XLSX from 'xlsx';

/**
 * Excel column headers for customer + site bulk import.
 */
export const TEMPLATE_HEADERS = [
  'MÜŞTERİ',
  'ABONE ÜNVANI',
  'MERKEZ',
  'ACC.',
  'LOKASYON',
  'İL',
  'İLÇE',
  'BAĞLANTI TARİHİ',
];

const MAX_ROWS = 500;

function trim(val) {
  if (val == null) return '';
  return String(val).trim();
}

function excelSerialToDate(serial) {
  const utcMs = (serial - 25569) * 86400 * 1000;
  const date = new Date(utcMs);
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(utcMs + offsetMs);
}

function parseConnectionDate(val) {
  const s = trim(val);
  if (!s) return null;
  // YYYY-MM-DD
  if (/^(\d{4})-(\d{2})-(\d{2})$/.test(s)) return s;
  // DD.MM.YYYY
  const dmy = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(s);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Excel serial number
  const excelSerial = Number(s);
  if (!Number.isNaN(excelSerial) && excelSerial > 1) {
    const d = excelSerialToDate(excelSerial);
    if (Number.isNaN(d.getTime()) || d.getFullYear() <= 1900) return null;
    return d.toISOString().slice(0, 10);
  }
  return null;
}

/**
 * Parse .xlsx file buffer into array of row objects (keys = first row headers)
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
 * Returns { rows, errors } where errors are { rowIndex, field, message, rowNum }.
 */
export function validateAndMapRows(excelRows) {
  const errors = [];
  const rows = [];

  if (excelRows.length > MAX_ROWS) {
    errors.push({ rowIndex: -1, field: '_limit', message: 'MAX_ROWS', rowNum: 0 });
    return { rows: [], errors };
  }

  const toProcess = excelRows.slice(0, MAX_ROWS);

  toProcess.forEach((raw, rowIndex) => {
    const rowNum = rowIndex + 2;
    const get = (key) => trim(raw[key] ?? '');

    const company_name = get('MÜŞTERİ');
    const subscriber_title = get('ABONE ÜNVANI');
    const alarm_center = get('MERKEZ');
    const account_no = get('ACC.');
    const site_name = get('LOKASYON');
    const city = get('İL');
    const district = get('İLÇE');
    const connection_date_raw = get('BAĞLANTI TARİHİ');

    // Required field validation (MERKEZ, ACC., İL, İLÇE, BAĞLANTI TARİHİ are optional)
    if (!company_name) errors.push({ rowIndex, field: 'MÜŞTERİ', message: 'required', rowNum });
    if (!subscriber_title) errors.push({ rowIndex, field: 'ABONE ÜNVANI', message: 'required', rowNum });
    if (!site_name) errors.push({ rowIndex, field: 'LOKASYON', message: 'required', rowNum });

    const connection_date = parseConnectionDate(connection_date_raw);
    if (connection_date_raw && !connection_date) {
      errors.push({ rowIndex, field: 'BAĞLANTI TARİHİ', message: 'invalid_date', rowNum });
    }

    rows.push({
      company_name: company_name || null,
      subscriber_title: subscriber_title || null,
      alarm_center: alarm_center || null,
      account_no: account_no || null,
      site_name: site_name || null,
      city: city || null,
      district: district || null,
      connection_date: connection_date || null,
    });
  });

  return { rows, errors };
}

/**
 * Build template sheet (headers + one example row) and return as Blob for download.
 */
export function buildTemplateBlob() {
  const exampleRow = [
    'Örnek Firma A.Ş.',
    'Alarm + Kamera Abonesi',
    'Güvenlik Merkezi',
    'ACC-001',
    'Merkez Şube',
    'İstanbul',
    'Kadıköy',
    '2024-01-15',
  ];
  const wsData = [TEMPLATE_HEADERS, exampleRow];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = TEMPLATE_HEADERS.map(() => ({ wch: 20 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Müşteriler');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export const MAX_IMPORT_ROWS = MAX_ROWS;
