/* global console, process */

import fs from 'fs';
import path from 'path';

const DEFAULT_CSV_PATH = 'imports/haziran-gelir.csv';
const OUTPUT_DIR = 'imports/generated';
const DEFAULT_BATCH_MARKER = 'june-historical-import-2026-06-v1';
const DEFAULT_SQL_PATH = `${OUTPUT_DIR}/june-finance-import-2026-06.sql`;
const DEFAULT_SUMMARY_PATH = `${OUTPUT_DIR}/june-finance-import-2026-06-summary.json`;
const IMPORT_NOTE = 'June historical import';
const TARGET_PERIOD = '2026-06';

const INCOME_TYPE_MAP = {
  MONTAJ: 'installation',
  SERVIS: 'service',
  SATIS: 'sale',
};

const SERVICE_CATEGORY_MAP = {
  MONTAJ: 'montaj',
  SERVIS: 'servis',
  SATIS: 'satis',
};

const EXCLUDED_DESCRIPTIONS = new Map([
  [
    'BEKIR YEKELER - DECO EKLEME, K.SUZ CIHAZ PIL DEGISIMLERI VE SISTEM TOPARLAMASI',
    'SATIS = 0 and the record is not ready yet',
  ],
]);

function parseArgs(argv) {
  const args = {
    csvPath: DEFAULT_CSV_PATH,
    dryRun: true,
    writeSql: false,
    batchMarker: DEFAULT_BATCH_MARKER,
    sqlPath: DEFAULT_SQL_PATH,
    summaryPath: DEFAULT_SUMMARY_PATH,
    createdBy: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--csv') args.csvPath = argv[++i];
    else if (arg === '--batch-marker') args.batchMarker = argv[++i];
    else if (arg === '--sql-path') args.sqlPath = argv[++i];
    else if (arg === '--summary-path') args.summaryPath = argv[++i];
    else if (arg === '--created-by') args.createdBy = argv[++i];
    else if (arg === '--write-sql') args.writeSql = true;
    else if (arg === '--apply') {
      throw new Error(
        'Direct apply is intentionally disabled in this script. Generate the SQL and run it manually after approval.'
      );
    } else if (arg === '--help') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`
Usage:
  node scripts/june-finance-import.mjs [--csv <path>] [--write-sql]
                                       [--batch-marker <marker>]
                                       [--sql-path <path>]
                                       [--summary-path <path>]
                                       [--created-by <uuid>]

Behavior:
  - Always performs a dry-run parse and validation.
  - Optionally generates a transactional SQL import file with --write-sql.
  - Does not execute database inserts directly.
`);
}

function parseTurkishNumber(value) {
  const input = String(value ?? '').trim();
  if (!input) return 0;

  const normalized = input.replace(/\./g, '').replace(/,/g, '.');
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric value: ${value}`);
  }

  return round2(parsed);
}

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toIsoDate(ddmmyy) {
  const match = /^(\d{2})\.(\d{2})\.(\d{2})$/.exec(String(ddmmyy || '').trim());
  if (!match) {
    throw new Error(`Invalid date format: ${ddmmyy}`);
  }

  const [, dd, mm, yy] = match;
  return `20${yy}-${mm}-${dd}`;
}

function deriveVatRate(amountTry, vatAmount) {
  if (!amountTry || amountTry <= 0 || !vatAmount || vatAmount <= 0) return 0;
  return round2((vatAmount / amountTry) * 100);
}

function deriveProportionalInputVat(rawCost, rawInputVat, materialCostTry) {
  if (materialCostTry <= 0 || rawCost <= 0 || rawInputVat <= 0) return 0;
  return round2(rawInputVat * (materialCostTry / rawCost));
}

function deriveExpenseVatRate(materialCostTry, postedInputVat) {
  if (materialCostTry <= 0 || postedInputVat <= 0) return 0;
  return round2((postedInputVat / materialCostTry) * 100);
}

function sqlLiteral(value) {
  if (value == null) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlNumber(value) {
  if (value == null) return 'NULL';
  return Number(value).toFixed(2);
}

function sqlBoolean(value) {
  if (value == null) return 'NULL';
  return value ? 'TRUE' : 'FALSE';
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function buildReferenceNo(batchMarker, kind, csvLine) {
  return `${batchMarker}:${kind}:csv-line-${csvLine}`;
}

function parseCsv(csvPath) {
  const content = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '');
  const records = [];
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ';') {
      row.push(field);
      field = '';
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && nextChar === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [headerRow, ...dataRows] = rows;
  if (!headerRow) return [];

  dataRows.forEach((dataRow) => {
    if (dataRow.every((value) => String(value || '').trim() === '')) return;
    const record = {};
    headerRow.forEach((header, index) => {
      record[String(header || '').trim()] = String(dataRow[index] ?? '').trim();
    });
    records.push(record);
  });

  return records;
}

function transformRows(rows, batchMarker) {
  const excludedRows = [];
  const invalidRows = [];
  const importRows = [];

  const summary = {
    rawRowCount: rows.length,
    excludedRowCount: 0,
    includedRowCount: 0,
    totalNetSales: 0,
    totalOutputVat: 0,
    totalGrossSales: 0,
    totalRawCost: 0,
    totalEstimatedLaborCost: 0,
    totalMaterialEquipmentCost: 0,
    paidCount: 0,
    unpaidCount: 0,
    paidGrossCollectionTotal: 0,
    expenseRowCandidateCount: 0,
    noExpenseRowCount: 0,
  };

  rows.forEach((row, index) => {
    const csvLine = index + 2;
    const description = String(row['İŞ'] || '').trim();
    const excludedReason = EXCLUDED_DESCRIPTIONS.get(description);

    if (excludedReason) {
      excludedRows.push({
        csvLine,
        date: String(row['TARİH'] || '').trim(),
        description,
        reason: excludedReason,
      });
      summary.excludedRowCount += 1;
      return;
    }

    const problems = [];
    const typeCode = String(row['TÜR'] || '').trim().toUpperCase();
    const paymentRaw = String(row['TAHSİLAT'] || '').trim().toUpperCase();

    let transactionDate = null;
    let amountTry = 0;
    let outputVat = 0;
    let grossSales = 0;
    let rawCost = 0;
    let inputVat = 0;
    let laborCost = 0;

    try {
      transactionDate = toIsoDate(row['TARİH']);
    } catch (error) {
      problems.push(error.message);
    }

    try {
      amountTry = parseTurkishNumber(row['SATIS']);
      outputVat = parseTurkishNumber(row['SATIS KDV']);
      grossSales = parseTurkishNumber(row['TOPLAM SATIS']);
      rawCost = parseTurkishNumber(row['MALİYET']);
      inputVat = parseTurkishNumber(row['MALİYET KDV']);
      laborCost = parseTurkishNumber(row['İŞÇİLİK TUTARI']);
    } catch (error) {
      problems.push(error.message);
    }

    const materialCostTry = round2(rawCost - laborCost);
    const postedInputVat = deriveProportionalInputVat(rawCost, inputVat, materialCostTry);
    const expenseVatRate = deriveExpenseVatRate(materialCostTry, postedInputVat);
    const grossExpected = round2(amountTry + outputVat);
    const incomeType = INCOME_TYPE_MAP[typeCode];
    const serviceCategory = SERVICE_CATEGORY_MAP[typeCode];
    const paymentStatus = paymentRaw === 'YAPIDI' ? 'paid' : paymentRaw === '' ? 'unpaid' : null;
    const vatRate = deriveVatRate(amountTry, outputVat);

    if (!incomeType) problems.push(`Unsupported TÜR: ${typeCode || '(empty)'}`);
    if (!description) problems.push('Description is empty');
    if (!transactionDate?.startsWith(`${TARGET_PERIOD}-`)) {
      problems.push(`Date is outside target period ${TARGET_PERIOD}`);
    }
    if (amountTry <= 0) problems.push(`SATIS must be positive, got ${amountTry.toFixed(2)}`);
    if (grossSales !== grossExpected) {
      problems.push(`TOPLAM SATIS mismatch: csv=${grossSales.toFixed(2)} expected=${grossExpected.toFixed(2)}`);
    }
    if (materialCostTry < 0) {
      problems.push(`material_cost_try cannot be negative, got ${materialCostTry.toFixed(2)}`);
    }
    if (!paymentStatus) problems.push(`Unexpected TAHSİLAT value: ${paymentRaw}`);

    summary.includedRowCount += 1;
    summary.totalNetSales = round2(summary.totalNetSales + amountTry);
    summary.totalOutputVat = round2(summary.totalOutputVat + outputVat);
    summary.totalGrossSales = round2(summary.totalGrossSales + grossSales);
    summary.totalRawCost = round2(summary.totalRawCost + rawCost);
    summary.totalEstimatedLaborCost = round2(summary.totalEstimatedLaborCost + laborCost);
    summary.totalMaterialEquipmentCost = round2(summary.totalMaterialEquipmentCost + materialCostTry);

    if (paymentStatus === 'paid') summary.paidCount += 1;
    if (paymentStatus === 'unpaid') summary.unpaidCount += 1;
    if (paymentStatus === 'paid') {
      summary.paidGrossCollectionTotal = round2(summary.paidGrossCollectionTotal + grossSales);
    }

    if (materialCostTry > 0) summary.expenseRowCandidateCount += 1;
    else summary.noExpenseRowCount += 1;

    const importRow = {
      csvLine,
      transactionDate,
      description,
      typeCode,
      incomeType,
      serviceCategory,
      amountTry,
      outputVat,
      grossSales,
      rawCost,
      inputVat,
      laborCost,
      materialCostTry,
      postedInputVat,
      expenseVatRate,
      vatRate,
      paymentStatus,
      incomeReferenceNo: buildReferenceNo(batchMarker, 'income', csvLine),
      expenseReferenceNo: materialCostTry > 0 ? buildReferenceNo(batchMarker, 'expense', csvLine) : null,
    };

    if (problems.length > 0) {
      invalidRows.push({
        csvLine,
        transactionDate,
        description,
        typeCode,
        problems,
      });
    }

    importRows.push(importRow);
  });

  return { summary, excludedRows, invalidRows, importRows };
}

function buildIncomeSqlRow(row, createdBy) {
  const description = `${row.description} [${IMPORT_NOTE}]`;

  return `(
  'income',
  ${sqlLiteral(row.incomeType)},
  ${sqlNumber(row.amountTry)},
  'TRY',
  ${sqlNumber(row.amountTry)},
  NULL,
  TRUE,
  NULL,
  ${sqlNumber(row.outputVat)},
  NULL,
  ${sqlNumber(row.vatRate)},
  ${row.materialCostTry > 0 ? sqlNumber(row.materialCostTry) : 'NULL'},
  ${sqlLiteral(row.transactionDate)},
  ${sqlLiteral(description)},
  'bank_transfer',
  ${sqlLiteral(row.incomeReferenceNo)},
  NULL,
  NULL,
  ${sqlLiteral(createdBy)},
  'confirmed',
  ${sqlLiteral(row.serviceCategory)}::public.service_category_enum,
  ${sqlLiteral(row.paymentStatus)}
)`;
}

function buildExpenseSqlRow(row, createdBy) {
  const description = `${IMPORT_NOTE} material/equipment cost - ${row.description}`;

  return `(
  'expense',
  NULL,
  ${sqlNumber(row.materialCostTry)},
  'TRY',
  ${sqlNumber(row.materialCostTry)},
  NULL,
  NULL,
  TRUE,
  NULL,
  ${sqlNumber(row.postedInputVat)},
  ${sqlNumber(row.expenseVatRate)},
  NULL,
  ${sqlLiteral(row.transactionDate)},
  ${sqlLiteral(description)},
  'bank_transfer',
  ${sqlLiteral(row.expenseReferenceNo)},
  NULL,
  ${sqlLiteral(createdBy)},
  'confirmed',
  NULL,
  'paid'
)`;
}

function generateImportSql({ batchMarker, createdBy, importRows, csvPath }) {
  const incomeRows = importRows.map((row) => buildIncomeSqlRow(row, createdBy)).join(',\n');
  const expenseRows = importRows
    .filter((row) => row.materialCostTry > 0)
    .map((row) => buildExpenseSqlRow(row, createdBy))
    .join(',\n');

  const expenseInsert = expenseRows
    ? `
WITH material_category AS (
  SELECT id
  FROM public.expense_categories
  WHERE code = 'material'
  LIMIT 1
)
INSERT INTO public.financial_transactions (
  direction,
  income_type,
  amount_original,
  original_currency,
  amount_try,
  exchange_rate,
  should_invoice,
  has_invoice,
  output_vat,
  input_vat,
  vat_rate,
  cogs_try,
  transaction_date,
  description,
  payment_method,
  reference_no,
  expense_category_id,
  site_id,
  created_by,
  status,
  service_category,
  payment_status
)
SELECT
  typed_expense_rows.direction,
  typed_expense_rows.income_type,
  typed_expense_rows.amount_original,
  typed_expense_rows.original_currency,
  typed_expense_rows.amount_try,
  typed_expense_rows.exchange_rate,
  typed_expense_rows.should_invoice,
  typed_expense_rows.has_invoice,
  typed_expense_rows.output_vat,
  typed_expense_rows.input_vat,
  typed_expense_rows.vat_rate,
  typed_expense_rows.cogs_try,
  typed_expense_rows.transaction_date,
  typed_expense_rows.description,
  typed_expense_rows.payment_method,
  typed_expense_rows.reference_no,
  material_category.id,
  typed_expense_rows.site_id,
  typed_expense_rows.created_by,
  typed_expense_rows.status,
  typed_expense_rows.service_category,
  typed_expense_rows.payment_status
FROM (
  VALUES
${expenseRows}
) AS expense_rows (
  direction,
  income_type,
  amount_original,
  original_currency,
  amount_try,
  exchange_rate,
  should_invoice,
  has_invoice,
  output_vat,
  input_vat,
  vat_rate,
  cogs_try,
  transaction_date,
  description,
  payment_method,
  reference_no,
  site_id,
  created_by,
  status,
  service_category,
  payment_status
)
CROSS JOIN LATERAL (
  SELECT
    expense_rows.direction::text AS direction,
    NULLIF(expense_rows.income_type, '')::text AS income_type,
    expense_rows.amount_original::numeric AS amount_original,
    expense_rows.original_currency::text AS original_currency,
    expense_rows.amount_try::numeric AS amount_try,
    expense_rows.exchange_rate::numeric AS exchange_rate,
    expense_rows.should_invoice::boolean AS should_invoice,
    expense_rows.has_invoice::boolean AS has_invoice,
    expense_rows.output_vat::numeric AS output_vat,
    expense_rows.input_vat::numeric AS input_vat,
    expense_rows.vat_rate::numeric AS vat_rate,
    expense_rows.cogs_try::numeric AS cogs_try,
    expense_rows.transaction_date::date AS transaction_date,
    expense_rows.description::text AS description,
    expense_rows.payment_method::text AS payment_method,
    expense_rows.reference_no::text AS reference_no,
    expense_rows.site_id::uuid AS site_id,
    expense_rows.created_by::uuid AS created_by,
    expense_rows.status::text AS status,
    expense_rows.service_category::public.service_category_enum AS service_category,
    expense_rows.payment_status::text AS payment_status
) typed_expense_rows
CROSS JOIN material_category;
`
    : '\n-- No material/equipment expense rows to insert for this batch.\n';

  const paymentInsert = `
INSERT INTO public.financial_transaction_payments (
  transaction_id,
  amount,
  paid_date,
  payment_method,
  notes,
  created_by
)
SELECT
  ft.id,
  ROUND(ft.amount_try + COALESCE(ft.output_vat, 0), 2),
  ft.transaction_date,
  COALESCE(ft.payment_method, 'bank_transfer'),
  'Collected via ${IMPORT_NOTE} batch ' || ${sqlLiteral(batchMarker)},
  ft.created_by
FROM public.financial_transactions ft
WHERE ft.reference_no LIKE ${sqlLiteral(`${batchMarker}:income:%`)}
  AND ft.deleted_at IS NULL
  AND ft.payment_status = 'paid';
`;

  return `-- Generated by scripts/june-finance-import.mjs
-- Source CSV: ${csvPath}
-- Batch marker: ${batchMarker}
-- Period: ${TARGET_PERIOD}
-- Note: ${IMPORT_NOTE}
-- period is a generated column on financial_transactions and cannot be inserted directly.
-- This script enforces period=${TARGET_PERIOD} by validating transaction_date-derived period.

BEGIN;

DO $$
DECLARE
  existing_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO existing_count
  FROM public.financial_transactions
  WHERE reference_no LIKE ${sqlLiteral(`${batchMarker}:%`)}
    AND deleted_at IS NULL;

  IF existing_count > 0 THEN
    RAISE EXCEPTION 'June historical import batch % already exists (% rows found). Aborting.',
      ${sqlLiteral(batchMarker)},
      existing_count;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e
      ON e.enumtypid = t.oid
    WHERE t.typname = 'service_category_enum'
      AND e.enumlabel IN ('montaj', 'servis', 'satis')
    GROUP BY t.typname
    HAVING COUNT(DISTINCT e.enumlabel) = 3
  ) THEN
    RAISE EXCEPTION 'service_category_enum must contain montaj, servis, satis. Aborting import.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.expense_categories
    WHERE code = 'material'
  ) THEN
    RAISE EXCEPTION 'Required expense category code=material was not found. Aborting import.';
  END IF;
END $$;

INSERT INTO public.financial_transactions (
  direction,
  income_type,
  amount_original,
  original_currency,
  amount_try,
  exchange_rate,
  should_invoice,
  has_invoice,
  output_vat,
  input_vat,
  vat_rate,
  cogs_try,
  transaction_date,
  description,
  payment_method,
  reference_no,
  expense_category_id,
  site_id,
  created_by,
  status,
  service_category,
  payment_status
)
SELECT
  income_rows.direction,
  income_rows.income_type,
  income_rows.amount_original,
  income_rows.original_currency,
  income_rows.amount_try,
  income_rows.exchange_rate,
  income_rows.should_invoice,
  income_rows.has_invoice,
  income_rows.output_vat,
  income_rows.input_vat,
  income_rows.vat_rate,
  income_rows.cogs_try,
  income_rows.transaction_date,
  income_rows.description,
  income_rows.payment_method,
  income_rows.reference_no,
  income_rows.expense_category_id,
  income_rows.site_id,
  income_rows.created_by,
  income_rows.status,
  income_rows.service_category,
  income_rows.payment_status
FROM (
  VALUES
${incomeRows}
) AS income_rows (
  direction,
  income_type,
  amount_original,
  original_currency,
  amount_try,
  exchange_rate,
  should_invoice,
  has_invoice,
  output_vat,
  input_vat,
  vat_rate,
  cogs_try,
  transaction_date,
  description,
  payment_method,
  reference_no,
  expense_category_id,
  site_id,
  created_by,
  status,
  service_category,
  payment_status
)
CROSS JOIN LATERAL (
  SELECT
    income_rows.direction::text AS direction,
    NULLIF(income_rows.income_type, '')::text AS income_type,
    income_rows.amount_original::numeric AS amount_original,
    income_rows.original_currency::text AS original_currency,
    income_rows.amount_try::numeric AS amount_try,
    income_rows.exchange_rate::numeric AS exchange_rate,
    income_rows.should_invoice::boolean AS should_invoice,
    income_rows.has_invoice::boolean AS has_invoice,
    income_rows.output_vat::numeric AS output_vat,
    income_rows.input_vat::numeric AS input_vat,
    income_rows.vat_rate::numeric AS vat_rate,
    income_rows.cogs_try::numeric AS cogs_try,
    income_rows.transaction_date::date AS transaction_date,
    income_rows.description::text AS description,
    income_rows.payment_method::text AS payment_method,
    income_rows.reference_no::text AS reference_no,
    income_rows.expense_category_id::uuid AS expense_category_id,
    income_rows.site_id::uuid AS site_id,
    income_rows.created_by::uuid AS created_by,
    income_rows.status::text AS status,
    income_rows.service_category::public.service_category_enum AS service_category,
    income_rows.payment_status::text AS payment_status
) typed_income_rows;
${expenseInsert}
${paymentInsert}

DO $$
DECLARE
  bad_period_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO bad_period_count
  FROM public.financial_transactions
  WHERE reference_no LIKE ${sqlLiteral(`${batchMarker}:%`)}
    AND deleted_at IS NULL
    AND period <> ${sqlLiteral(TARGET_PERIOD)};

  IF bad_period_count > 0 THEN
    RAISE EXCEPTION 'Imported batch % produced % rows outside period %. Aborting.',
      ${sqlLiteral(batchMarker)},
      bad_period_count,
      ${sqlLiteral(TARGET_PERIOD)};
  END IF;
END $$;

COMMIT;
`;
}

function writeSummary(summaryPath, payload) {
  ensureDir(summaryPath);
  fs.writeFileSync(summaryPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function printSummary({ args, summary, excludedRows, invalidRows }) {
  console.log('June Finance Import Dry-Run');
  console.log(`CSV path: ${args.csvPath}`);
  console.log(`Batch marker: ${args.batchMarker}`);
  console.log(`Raw row count: ${summary.rawRowCount}`);
  console.log(`Excluded row count: ${summary.excludedRowCount}`);
  console.log(`Included row count: ${summary.includedRowCount}`);
  console.log(`Total net sales: ${summary.totalNetSales.toFixed(2)} TRY`);
  console.log(`Total output VAT: ${summary.totalOutputVat.toFixed(2)} TRY`);
  console.log(`Total gross sales: ${summary.totalGrossSales.toFixed(2)} TRY`);
  console.log(`Total raw cost: ${summary.totalRawCost.toFixed(2)} TRY`);
  console.log(`Total estimated labor cost: ${summary.totalEstimatedLaborCost.toFixed(2)} TRY`);
  console.log(`Total material/equipment cost: ${summary.totalMaterialEquipmentCost.toFixed(2)} TRY`);
  console.log(`Paid count: ${summary.paidCount}`);
  console.log(`Unpaid count: ${summary.unpaidCount}`);
  console.log(`Paid gross collection total: ${summary.paidGrossCollectionTotal.toFixed(2)} TRY`);
  console.log(`Expense row candidates: ${summary.expenseRowCandidateCount}`);
  console.log(`No expense row count: ${summary.noExpenseRowCount}`);
  console.log(`Invalid row count: ${invalidRows.length}`);

  if (excludedRows.length > 0) {
    console.log('\nExcluded rows:');
    excludedRows.forEach((row) => {
      console.log(`- line ${row.csvLine}: ${row.description} (${row.reason})`);
    });
  }

  if (invalidRows.length > 0) {
    console.log('\nInvalid rows:');
    invalidRows.forEach((row) => {
      console.log(`- line ${row.csvLine}: ${row.description}`);
      row.problems.forEach((problem) => {
        console.log(`  * ${problem}`);
      });
    });
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const rows = parseCsv(args.csvPath);
  const { summary, excludedRows, invalidRows, importRows } = transformRows(rows, args.batchMarker);

  printSummary({ args, summary, excludedRows, invalidRows });

  const summaryPayload = {
    csvPath: args.csvPath,
    batchMarker: args.batchMarker,
    period: TARGET_PERIOD,
    importNote: IMPORT_NOTE,
    createdBy: args.createdBy,
    summary,
    excludedRows,
    invalidRows,
    incomeRowCount: importRows.length,
    expenseRowCount: importRows.filter((row) => row.materialCostTry > 0).length,
  };

  writeSummary(args.summaryPath, summaryPayload);
  console.log(`\nSummary JSON written to ${args.summaryPath}`);

  if (invalidRows.length > 0) {
    process.exitCode = 1;
    return;
  }

  if (args.writeSql) {
    const sql = generateImportSql({
      batchMarker: args.batchMarker,
      createdBy: args.createdBy,
      importRows,
      csvPath: args.csvPath,
    });

    ensureDir(args.sqlPath);
    fs.writeFileSync(args.sqlPath, sql, 'utf8');
    console.log(`SQL import file written to ${args.sqlPath}`);
  }
}

try {
  main();
} catch (error) {
  console.error(`Import script failed: ${error.message}`);
  process.exit(1);
}
