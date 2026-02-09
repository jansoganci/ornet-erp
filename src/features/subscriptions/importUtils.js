import * as XLSX from 'xlsx';
import { SUBSCRIPTION_TYPES, SERVICE_TYPES } from './schema';

/** Excel column headers (Turkish) - order for template */
export const TEMPLATE_HEADERS = [
  'Müşteri',
  'Lokasyon',
  'Adres',
  'Hesap No',
  'Başlangıç',
  'Baz Fiyat',
  'SMS Ücreti',
  'Hat Ücreti',
  'KDV',
  'Ödeme Sıklığı',
  'Abonelik Tipi',
  'Banka Adı',
  'Son 4',
  'Tahsil Eden',
  'Resmi Fatura',
  'Hizmet Türü',
  'Fatura Günü',
];

const MAX_ROWS = 500;

const SUBSCRIPTION_TYPE_MAP = {
  kart: 'recurring_card',
  nakit: 'manual_cash',
  havale: 'manual_bank',
};

const BILLING_FREQUENCY_MAP = {
  aylık: 'monthly',
  aylik: 'monthly',
  yıllık: 'yearly',
  yillik: 'yearly',
  monthly: 'monthly',
  yearly: 'yearly',
};

const OFFICIAL_INVOICE_MAP = {
  evet: true,
  hayır: false,
  hayir: false,
  true: true,
  false: false,
  '1': true,
  '0': false,
};

const SERVICE_TYPE_MAP = {
  'sadece alarm': 'alarm_only',
  'sadece kamera': 'camera_only',
  'sadece internet': 'internet_only',
  'alarm + kamera': 'alarm_camera',
  'alarm + kamera + internet': 'alarm_camera_internet',
  alarm_only: 'alarm_only',
  camera_only: 'camera_only',
  internet_only: 'internet_only',
  alarm_camera: 'alarm_camera',
  alarm_camera_internet: 'alarm_camera_internet',
};

function trim(val) {
  if (val == null) return '';
  return String(val).trim();
}

function parseDate(val) {
  const s = trim(val);
  if (!s) return null;
  // YYYY-MM-DD
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) return s;
  // DD.MM.YYYY
  const dmy = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

function toNum(val, defaultVal = 0) {
  if (val == null || trim(String(val)) === '') return defaultVal;
  const n = Number(String(val).replace(',', '.'));
  return Number.isFinite(n) ? n : defaultVal;
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
    const obj = {};
    headers.forEach((h, j) => {
      obj[h] = arr[j] != null ? arr[j] : '';
    });
    rows.push(obj);
  }
  return rows;
}

/**
 * Validate and map Excel rows to internal payload. Max 500 rows.
 * Returns { rows, errors } where errors are { rowIndex, field, message }.
 */
export function validateAndMapRows(excelRows) {
  const errors = [];
  const rows = [];

  if (excelRows.length > MAX_ROWS) {
    errors.push({ rowIndex: -1, field: '_limit', message: 'MAX_ROWS' });
  }

  const toProcess = excelRows.slice(0, MAX_ROWS);

  toProcess.forEach((raw, rowIndex) => {
    const rowNum = rowIndex + 2; // 1-based + header
    const get = (key) => trim(raw[key] ?? raw[TEMPLATE_HEADERS.find((h) => h === key)] ?? '');

    const company_name = get('Müşteri');
    const site_name = get('Lokasyon');
    const address = get('Adres');
    const account_no = get('Hesap No') || null;
    const startRaw = get('Başlangıç');
    const base_priceRaw = get('Baz Fiyat');
    const subscriptionTypeRaw = get('Abonelik Tipi');

    // Required
    if (!company_name) errors.push({ rowIndex, field: 'Müşteri', message: 'required', rowNum });
    if (!site_name) errors.push({ rowIndex, field: 'Lokasyon', message: 'required', rowNum });
    if (!address) errors.push({ rowIndex, field: 'Adres', message: 'required', rowNum });
    const start_date = parseDate(startRaw);
    if (!start_date) errors.push({ rowIndex, field: 'Başlangıç', message: 'invalid_date', rowNum });
    const base_price = toNum(base_priceRaw, NaN);
    if (base_priceRaw !== '' && !Number.isFinite(base_price)) errors.push({ rowIndex, field: 'Baz Fiyat', message: 'invalid_number', rowNum });
    if (base_price < 0) errors.push({ rowIndex, field: 'Baz Fiyat', message: 'min_zero', rowNum });

    const subTypeLower = subscriptionTypeRaw.toLowerCase();
    const subscription_type = SUBSCRIPTION_TYPE_MAP[subTypeLower] || (SUBSCRIPTION_TYPES.includes(subscriptionTypeRaw) ? subscriptionTypeRaw : null);
    if (!subscription_type) errors.push({ rowIndex, field: 'Abonelik Tipi', message: 'invalid_type', rowNum });

    if (subscription_type === 'recurring_card') {
      const card_bank = get('Banka Adı');
      const card_last4 = get('Son 4');
      if (!card_bank || !card_last4 || String(card_last4).length !== 4) {
        errors.push({ rowIndex, field: 'Kart', message: 'card_required', rowNum });
      }
    }

    const billingFreqRaw = get('Ödeme Sıklığı').toLowerCase();
    const billing_frequency = BILLING_FREQUENCY_MAP[billingFreqRaw] || 'monthly';

    const officialRaw = get('Resmi Fatura').toLowerCase();
    const official_invoice = OFFICIAL_INVOICE_MAP[officialRaw] !== undefined ? OFFICIAL_INVOICE_MAP[officialRaw] : true;

    const serviceTypeRaw = get('Hizmet Türü').toLowerCase().replace(/\s+/g, ' ');
    const service_type = SERVICE_TYPE_MAP[serviceTypeRaw] || (SERVICE_TYPES.includes(trim(raw['Hizmet Türü'])) ? trim(raw['Hizmet Türü']) : null) || null;

    let billing_day = toNum(get('Fatura Günü'), 1);
    if (billing_day < 1 || billing_day > 28) billing_day = 1;

    const payload = {
      company_name,
      site_name,
      address,
      account_no,
      start_date,
      base_price: Number.isFinite(base_price) ? base_price : 0,
      sms_fee: toNum(get('SMS Ücreti'), 0),
      line_fee: toNum(get('Hat Ücreti'), 0),
      vat_rate: toNum(get('KDV'), 20),
      billing_frequency,
      subscription_type,
      card_bank_name: subscription_type === 'recurring_card' ? get('Banka Adı') : null,
      card_last4: subscription_type === 'recurring_card' ? String(get('Son 4')).slice(0, 4) : null,
      cash_collector_name: subscription_type === 'manual_cash' ? get('Tahsil Eden') || null : null,
      official_invoice,
      service_type,
      billing_day,
    };

    rows.push(payload);
  });

  return { rows, errors };
}

/**
 * Build template sheet (headers + one empty row) and return as blob for download
 */
export function buildTemplateBlob() {
  const wsData = [TEMPLATE_HEADERS, TEMPLATE_HEADERS.map(() => '')];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Abonelikler');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export const MAX_IMPORT_ROWS = MAX_ROWS;
