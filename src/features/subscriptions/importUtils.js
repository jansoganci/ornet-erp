import * as XLSX from 'xlsx';
import { SERVICE_TYPES } from './schema';

/**
 * Excel column headers (Turkish) — matches the user's actual Excel format.
 * Ignored columns (safe to have in Excel, just not read):
 *   ADRES, HESAP NO (duplicate of ACC.), KAM.ALR.VAR MI, KDV/total columns.
 */
export const TEMPLATE_HEADERS = [
  'TÜR',
  'MERKEZ',
  'ACC.',
  'MÜŞTERİ',
  'LOKASYON',
  'ABONE UNVANI',
  'BAŞLANGIÇ',
  'KIRALAMA ÜCRETİ',
  'SIM ÜCRETİ',
  'SMS TL',
  'HAT TL',
  'MALIYET',
  'ODEME SIKLIGI',
  'ODEME NOTU',
  'FATURA',
  'KAM. ALR.VAR MI',
  'ACIKLAMA',
  'ONCEKI AYLARIN NOTLARI',
];

const MAX_ROWS = 500;

// ODEME SIKLIGI (billing_frequency) mapping
const BILLING_FREQUENCY_MAP = {
  'aylık':    'monthly',
  'aylik':    'monthly',
  'monthly':  'monthly',
  '3 aylık':  '3_month',
  '3 aylik':  '3_month',
  '3_aylık':  '3_month',
  '3_aylik':  '3_month',
  '3_month':  '3_month',
  '6 aylık':  '6_month',
  '6 aylik':  '6_month',
  '6_aylık':  '6_month',
  '6_aylik':  '6_month',
  '6_month':  '6_month',
  'yıllık':   'yearly',
  'yillik':   'yearly',
  'yearly':   'yearly',
};

// FATURA (official_invoice) mapping
const OFFICIAL_INVOICE_MAP = {
  evet:   true,
  hayır:  false,
  hayir:  false,
  true:   true,
  false:  false,
  '1':    true,
  '0':    false,
};

// ODEME NOTU → payment_start_month (1-12) mapping
const TURKISH_MONTH_MAP = {
  'ocak':     1,  'january':  1,
  'şubat':    2,  'subat':    2,  'february': 2,
  'mart':     3,  'march':    3,
  'nisan':    4,  'april':    4,
  'mayıs':    5,  'mayis':    5,  'may':      5,
  'haziran':  6,  'june':     6,
  'temmuz':   7,  'july':     7,
  'ağustos':  8,  'agustos':  8,  'august':   8,
  'eylül':    9,  'eylul':    9,  'september':9,
  'ekim':    10,  'october': 10,
  'kasım':   11,  'kasim':   11,  'november':11,
  'aralık':  12,  'aralik':  12,  'december':12,
};

function parsePaymentStartMonth(raw) {
  if (!raw) return null;
  const normalized = raw.toString().toLowerCase().trim();
  if (TURKISH_MONTH_MAP[normalized]) return TURKISH_MONTH_MAP[normalized];
  const firstWord = normalized.split(/[\s,\/\-]+/)[0];
  return TURKISH_MONTH_MAP[firstWord] ?? null;
}

function trim(val) {
  if (val == null) return '';
  return String(val).trim();
}

/**
 * Convert Excel serial to UTC date string (YYYY-MM-DD).
 * Excel stores dates as days since 1900-01-01 00:00 UTC. Using UTC methods
 * avoids timezone shift (e.g. midnight UTC becoming previous day in UTC+3).
 */
function excelSerialToDate(serial) {
  const utcMs = (serial - 25569) * 86400 * 1000;
  const date = new Date(utcMs);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDate(val) {
  const s = trim(val);
  if (!s) return null;
  // YYYY-MM-DD (strict or flexible digit count)
  const ymd = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (ymd) {
    const [, y, m, d] = ymd;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY
  const dmy = /^(\d{1,2})[./\-](\d{1,2})[./\-](\d{4})$/.exec(s);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // M/D/YYYY (US format — Excel may produce this)
  const mdy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (mdy) {
    const [, m, d, y] = mdy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Excel serial number (e.g. 44927)
  const serial = Number(s);
  if (Number.isFinite(serial) && serial > 1) {
    const isoDate = excelSerialToDate(serial);
    const year = parseInt(isoDate.slice(0, 4), 10);
    if (year > 1900) return isoDate;
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
  // Normalize headers: trim + replace non-breaking space (Excel bazen \xa0 kullanır)
  // Normalize ALL unicode whitespace (non-breaking, thin, figure, narrow no-break, etc.) to regular space
  const headers = data[0].map((h) => trim(String(h)).replace(/[\u00a0\u2007\u2009\u200a\u200b\u202f\u205f\u3000]/g, ' ').replace(/\s+/g, ' '));
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const arr = data[i];
    // Skip completely empty rows
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
 * Max 500 rows. Customer/site existence is NOT checked here — that happens in importApi.
 * Returns { rows, errors } where errors are { rowIndex, field, message, rowNum }.
 */
export function validateAndMapRows(excelRows) {
  const errors = [];
  const rows = [];

  if (excelRows.length > MAX_ROWS) {
    errors.push({ rowIndex: -1, field: '_limit', message: 'MAX_ROWS' });
  }

  const toProcess = excelRows.slice(0, MAX_ROWS);

  // HAT TL / SIM sütununu bulmak için: key tam eşleşmezse "HAT" veya "SIM" içeren key ara
  const findSimColumn = (raw) => {
    const hatKey = Object.keys(raw).find((k) => /HAT\s*TL|SIM\s*(TL|ÜCRETİ|UCRETI)/i.test(trim(String(k)).replace(/[\u00a0\u2007\u2009\u200a\u200b\u202f\u205f\u3000]/g, ' ')));
    return hatKey ? trim(raw[hatKey] ?? '') : '';
  };

  toProcess.forEach((raw, rowIndex) => {
    const rowNum = rowIndex + 2; // 1-based + header row
    // Lookup with fallback: if exact key miss, try normalizing all keys
    const get = (key) => {
      if (raw[key] != null) return trim(raw[key]);
      // Fallback: find key that matches after whitespace normalization
      const normKey = key.replace(/\s+/g, ' ');
      const found = Object.keys(raw).find(
        (k) => k.replace(/[\u00a0\u2007\u2009\u200a\u200b\u202f\u205f\u3000\s]+/g, ' ').trim() === normKey,
      );
      return found != null ? trim(raw[found]) : '';
    };
    const getMulti = (...keys) => keys.map(get).find((v) => v) ?? '';

    const company_name = getMulti('MÜŞTERİ', 'MUSTERI');
    const site_name    = getMulti('LOKASYON');
    const startRaw     = getMulti('BAŞLANGIÇ', 'BASLANGIC');
    // Kiralama Ücreti (rental) → base_price; TL is fallback for backward compatibility
    const base_priceRaw = getMulti('KIRALAMA ÜCRETİ', 'KIRALAMA UCRETI', 'TL');
    // SIM Ücreti → sim_amount; HAT TL (Excel formatında SIM bedeli) — tam eşleşmezse findSimColumn
    const sim_amountRaw = getMulti('HAT TL', 'SIM ÜCRETİ', 'SIM UCRETI', 'SIM TL') || findSimColumn(raw);

    // Required field validation
    if (!company_name) errors.push({ rowIndex, field: 'MÜŞTERİ',     message: 'required', rowNum });
    if (!site_name)    errors.push({ rowIndex, field: 'LOKASYON',     message: 'required', rowNum });
    if (!startRaw)     errors.push({ rowIndex, field: 'BAŞLANGIÇ',    message: 'required', rowNum });

    const start_date = parseDate(startRaw);
    if (startRaw && !start_date) errors.push({ rowIndex, field: 'BAŞLANGIÇ', message: 'invalid_date', rowNum });

    const base_price = toNum(base_priceRaw, NaN);
    if (base_priceRaw !== '' && !Number.isFinite(base_price))
      errors.push({ rowIndex, field: 'KIRALAMA ÜCRETİ', message: 'invalid_number', rowNum });
    if (Number.isFinite(base_price) && base_price < 0)
      errors.push({ rowIndex, field: 'KIRALAMA ÜCRETİ', message: 'min_zero', rowNum });

    const sim_amount = toNum(sim_amountRaw, NaN);
    if (sim_amountRaw !== '' && !Number.isFinite(sim_amount))
      errors.push({ rowIndex, field: 'SIM ÜCRETİ', message: 'invalid_number', rowNum });
    if (Number.isFinite(sim_amount) && sim_amount < 0)
      errors.push({ rowIndex, field: 'SIM ÜCRETİ', message: 'min_zero', rowNum });

    // TÜR (service_type) — optional; must match one of the 12 allowed codes
    const turRaw = (get('TÜR') || get('TUR') || '').trim();
    const turCanonical = turRaw ? turRaw.toUpperCase().replace(/ı/g, 'I') : '';
    const service_type = turCanonical && SERVICE_TYPES.includes(turCanonical) ? turCanonical : null;
    if (turRaw && !service_type)
      errors.push({ rowIndex, field: 'TÜR', message: 'invalid_service_type', rowNum });

    // Billing frequency — default monthly
    const freqRaw = get('ODEME SIKLIGI').toLowerCase().trim();
    const billing_frequency = BILLING_FREQUENCY_MAP[freqRaw] ?? 'monthly';

    // Payment start month — required for non-monthly
    const paymentNoteRaw = get('ODEME NOTU');
    const payment_start_month = parsePaymentStartMonth(paymentNoteRaw);
    if (billing_frequency !== 'monthly' && payment_start_month === null) {
      errors.push({ rowIndex, field: 'ODEME NOTU', message: 'required_for_non_monthly', rowNum });
    }

    // Official invoice — default true
    const faturaRaw = get('FATURA').toLowerCase().trim();
    const official_invoice = OFFICIAL_INVOICE_MAP[faturaRaw] !== undefined
      ? OFFICIAL_INVOICE_MAP[faturaRaw]
      : true;

    rows.push({
      company_name,
      site_name,
      subscriber_title:      get('ABONE UNVANI') || null,
      alarm_center:          get('MERKEZ') || null,
      alarm_center_account:  get('ACC.') || null,
      start_date:            start_date ?? startRaw,
      base_price:            Number.isFinite(base_price) ? base_price : 0,
      sim_amount:            Number.isFinite(sim_amount) ? sim_amount : 0,
      sms_fee:               toNum(get('SMS TL'), 0),
      line_fee:              0,
      cost:                  toNum(get('MALIYET'), 0),
      vat_rate:              20,
      billing_frequency,
      payment_start_month: billing_frequency !== 'monthly' ? payment_start_month : null,
      service_type,
      official_invoice,
      notes:                 [get('ACIKLAMA'), get('KAM. ALR.VAR MI') ? `KAM. ALR.: ${get('KAM. ALR.VAR MI')}` : ''].filter(Boolean).join(' | ') || null,
      setup_notes:           get('ONCEKI AYLARIN NOTLARI') || null,
    });
  });

  return { rows, errors };
}

/**
 * Build template sheet (headers + one example row) and return as Blob for download.
 */
export function buildTemplateBlob() {
  const exampleRow = [
    'A.KIRA.KK',    // TÜR
    'Güvenlik A.Ş.',// MERKEZ
    'ACC-001',      // ACC.
    'Örnek Firma',  // MÜŞTERİ
    'Merkez Şube',  // LOKASYON
    'Alarm+Kamera Abonesi', // ABONE UNVANI
    '2024-01-01',   // BAŞLANGIÇ
    '450',          // KIRALAMA ÜCRETİ
    '50',           // SIM ÜCRETİ
    '0',            // SMS TL
    '0',            // HAT TL
    '100',          // MALIYET
    'aylık',        // ODEME SIKLIGI
    '',             // ODEME NOTU (e.g. OCAK, TEMMUZ — required for non-monthly)
    'evet',         // FATURA
    'YOK',          // KAM. ALR.VAR MI
    '',             // ACIKLAMA
    '',             // ONCEKI AYLARIN NOTLARI
  ];
  const wsData = [TEMPLATE_HEADERS, exampleRow];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  // Column widths
  ws['!cols'] = TEMPLATE_HEADERS.map(() => ({ wch: 20 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Abonelikler');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export const MAX_IMPORT_ROWS = MAX_ROWS;
