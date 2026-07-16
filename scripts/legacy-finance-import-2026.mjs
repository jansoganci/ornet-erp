/* global console, process */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_FINANCE_CSV = 'imports/Import_2026_Final.csv';
const DEFAULT_MAPPING_CSV = 'imports/Export_CustomerMapping.csv';
const DEFAULT_IMPORT_KEY = 'legacy-finance-2026-v1';
const BATCH_SIZE = 100;

const FINANCE_HEADERS = [
  'source_row',
  'transaction_date',
  'customer_raw',
  'income_type',
  'service_category',
  'amount_try',
  'cogs_try',
  'input_vat',
  'output_vat',
  'collection_status',
  'payment_method',
  'payment_date',
  'source_note',
  'donem_raw',
  'isin_cinsi_raw',
  'toplam_raw',
  'kar_raw',
  'kdv_raw',
];

const MAPPING_HEADERS = [
  'customer_raw',
  'matched_customer_name',
  'match_status',
  'match_note',
];

const TURKISH_MONTHS = {
  OCAK: '01',
  SUBAT: '02',
  MART: '03',
  NISAN: '04',
  MAYIS: '05',
  HAZIRAN: '06',
  TEMMUZ: '07',
  AGUSTOS: '08',
  EYLUL: '09',
  EKIM: '10',
  KASIM: '11',
  ARALIK: '12',
};

const INCOME_TYPES = new Set(['subscription', 'service', 'installation', 'sale']);
const SERVICE_CATEGORIES = new Set(['kira', 'merkez', 'montaj', 'servis', 'satis', 'mal_gonderme']);
const COLLECTION_STATUSES = new Set(['collected', 'unknown']);
const PAYMENT_METHODS = new Set(['bank_transfer', 'cash', 'card']);

function parseArgs(argv) {
  const args = {
    financePath: DEFAULT_FINANCE_CSV,
    mappingPath: DEFAULT_MAPPING_CSV,
    importKey: DEFAULT_IMPORT_KEY,
    createdBy: null,
    stage: false,
    postExisting: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--finance') args.financePath = argv[++index];
    else if (arg === '--mapping') args.mappingPath = argv[++index];
    else if (arg === '--import-key') args.importKey = argv[++index];
    else if (arg === '--created-by') args.createdBy = argv[++index];
    else if (arg === '--stage') args.stage = true;
    else if (arg === '--post') {
      throw new Error('--post is intentionally disabled. Review the staged batch, then use --post-existing.');
    }
    else if (arg === '--post-existing') args.postExisting = true;
    else if (arg === '--help') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (args.stage && args.postExisting) {
    throw new Error('--stage and --post-existing cannot be used together.');
  }

  return args;
}

function printHelp() {
  console.log(`
Usage:
  node scripts/legacy-finance-import-2026.mjs [options]

Options:
  --finance <path>       Finance CSV (default: ${DEFAULT_FINANCE_CSV})
  --mapping <path>       Customer mapping CSV (default: ${DEFAULT_MAPPING_CSV})
  --import-key <key>     Idempotent batch key (default: ${DEFAULT_IMPORT_KEY})
  --created-by <uuid>    Optional profile UUID recorded on staged/posted rows
  --stage                Stage validated rows using SUPABASE_SERVICE_ROLE_KEY
  --post-existing        Post an already-reviewed batch after checksum validation

Without --stage the script only parses and validates both files. It never posts
financial data by default.
`);
}

function parseDelimitedCsv(content, delimiter = ';') {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    const next = content[index + 1];

    if (quoted) {
      if (character === '"') {
        if (next === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === delimiter) {
      row.push(field);
      field = '';
    } else if (character === '\r' || character === '\n') {
      if (character === '\r' && next === '\n') index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error('CSV has an unterminated quoted field.');
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [headerRow, ...dataRows] = rows;
  if (!headerRow) throw new Error('CSV is empty.');

  const headers = headerRow.map((header) => header.replace(/^\uFEFF/, ''));
  const records = [];
  for (let index = 0; index < dataRows.length; index += 1) {
    const dataRow = dataRows[index];
    if (dataRow.every((value) => value === '')) continue;
    if (dataRow.length !== headers.length) {
      throw new Error(
        `CSV row ${index + 2} has ${dataRow.length} fields; expected ${headers.length}.`
      );
    }
    records.push({
      logicalRow: index + 2,
      values: Object.fromEntries(headers.map((header, headerIndex) => [header, dataRow[headerIndex]])),
    });
  }

  return { headers, records };
}

function assertExactHeaders(headers, expected, label) {
  const missing = expected.filter((header) => !headers.includes(header));
  const unexpected = headers.filter((header) => !expected.includes(header));

  if (missing.length > 0 || unexpected.length > 0 || headers.length !== expected.length) {
    throw new Error(
      `${label} headers do not match. Missing: ${missing.join(', ') || 'none'}. ` +
      `Unexpected: ${unexpected.join(', ') || 'none'}.`
    );
  }
}

function readCsv(filePath, expectedHeaders, label) {
  const content = fs.readFileSync(filePath, 'utf8');
  const parsed = parseDelimitedCsv(content);
  assertExactHeaders(parsed.headers, expectedHeaders, label);
  return { ...parsed, checksum: sha256(content) };
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function parseTurkishCents(value, fieldName, sourceRow) {
  const input = String(value ?? '').trim();
  if (!input) throw new Error(`source_row ${sourceRow}: ${fieldName} is empty.`);

  if (!/^-?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?$/.test(input)) {
    throw new Error(`source_row ${sourceRow}: ${fieldName} is not a valid Turkish TRY amount: ${value}`);
  }

  const normalized = input.replace(/\./g, '').replace(',', '.');
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) throw new Error(`source_row ${sourceRow}: ${fieldName} is not a valid TRY amount: ${value}`);

  const [, sign, whole, decimal = ''] = match;
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
  return sign === '-' ? -cents : cents;
}

function centsToNumber(cents) {
  return Number((cents / 100).toFixed(2));
}

function parseIsoDate(value, fieldName, sourceRow) {
  const input = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    throw new Error(`source_row ${sourceRow}: ${fieldName} must be ISO YYYY-MM-DD.`);
  }

  const date = new Date(`${input}T00:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== input) {
    throw new Error(`source_row ${sourceRow}: ${fieldName} is not a real date.`);
  }

  return input;
}

function normalizeForSearch(value) {
  const replacements = {
    'ğ': 'g', 'Ğ': 'G', 'ş': 's', 'Ş': 'S', 'ı': 'i', 'İ': 'I',
    'ö': 'o', 'Ö': 'O', 'ü': 'u', 'Ü': 'U', 'ç': 'c', 'Ç': 'C',
  };

  return [...String(value ?? '')]
    .map((character) => replacements[character] ?? character)
    .join('')
    .toLowerCase();
}

function validateMappings(mappingRecords) {
  const byRawCustomer = new Map();

  for (const record of mappingRecords) {
    const row = record.values;
    const customerRaw = row.customer_raw;
    const matchedName = row.matched_customer_name;

    if (!customerRaw) throw new Error(`mapping row ${record.logicalRow}: customer_raw is empty.`);
    if (!matchedName) throw new Error(`mapping row ${record.logicalRow}: matched_customer_name is empty.`);
    if (row.match_status !== 'matched') {
      throw new Error(`mapping row ${record.logicalRow}: match_status must be matched.`);
    }
    if (/^[ \t]|[ \t]$|[\r\n\t]|\u00a0| {2,}/.test(matchedName)) {
      throw new Error(`mapping row ${record.logicalRow}: matched_customer_name contains unsafe whitespace.`);
    }
    if (byRawCustomer.has(customerRaw)) {
      throw new Error(`mapping row ${record.logicalRow}: duplicate customer_raw: ${customerRaw}`);
    }

    byRawCustomer.set(customerRaw, {
      customerRaw,
      matchedCustomerName: matchedName,
      matchStatus: row.match_status,
      matchNote: row.match_note || null,
      logicalRow: record.logicalRow,
    });
  }

  return byRawCustomer;
}

function validateFinanceRows(financeRecords, mappings) {
  const sourceRows = new Set();
  const customerRawValues = new Set();
  const rows = [];
  const summary = {
    row_count: 0,
    customer_count: 0,
    collected_count: 0,
    unknown_count: 0,
    net_total_try: 0,
    output_vat_total_try: 0,
    input_vat_total_try: 0,
    cogs_total_try: 0,
    gross_total_try: 0,
    collected_gross_total_try: 0,
    cogs_transaction_count: 0,
    payment_row_count: 0,
    zero_gross_collected_count: 0,
  };

  for (const record of financeRecords) {
    const raw = record.values;
    const sourceRow = Number(raw.source_row);
    if (!Number.isInteger(sourceRow) || sourceRow <= 0) {
      throw new Error(`finance row ${record.logicalRow}: source_row must be a positive integer.`);
    }
    if (sourceRows.has(sourceRow)) throw new Error(`source_row ${sourceRow} appears more than once.`);
    sourceRows.add(sourceRow);

    const transactionDate = parseIsoDate(raw.transaction_date, 'transaction_date', sourceRow);
    if (!transactionDate.startsWith('2026-')) {
      throw new Error(`source_row ${sourceRow}: transaction_date must be in 2026.`);
    }

    const [periodMonth, periodYear] = String(raw.donem_raw || '').split('.');
    if (periodYear !== '2026' || TURKISH_MONTHS[periodMonth] !== transactionDate.slice(5, 7)) {
      throw new Error(`source_row ${sourceRow}: donem_raw does not match transaction_date.`);
    }

    const mapping = mappings.get(raw.customer_raw);
    if (!mapping) throw new Error(`source_row ${sourceRow}: customer_raw has no mapping.`);
    customerRawValues.add(raw.customer_raw);

    if (!INCOME_TYPES.has(raw.income_type)) {
      throw new Error(`source_row ${sourceRow}: unsupported income_type ${raw.income_type}.`);
    }
    if (!SERVICE_CATEGORIES.has(raw.service_category)) {
      throw new Error(`source_row ${sourceRow}: unsupported service_category ${raw.service_category}.`);
    }
    if (!COLLECTION_STATUSES.has(raw.collection_status)) {
      throw new Error(`source_row ${sourceRow}: unsupported collection_status ${raw.collection_status}.`);
    }
    if (!PAYMENT_METHODS.has(raw.payment_method)) {
      throw new Error(`source_row ${sourceRow}: unsupported payment_method ${raw.payment_method}.`);
    }

    const amountCents = parseTurkishCents(raw.amount_try, 'amount_try', sourceRow);
    const cogsCents = parseTurkishCents(raw.cogs_try, 'cogs_try', sourceRow);
    const inputVatCents = parseTurkishCents(raw.input_vat, 'input_vat', sourceRow);
    const outputVatCents = parseTurkishCents(raw.output_vat, 'output_vat', sourceRow);
    const totalCents = parseTurkishCents(raw.toplam_raw, 'toplam_raw', sourceRow);
    const profitCents = parseTurkishCents(raw.kar_raw, 'kar_raw', sourceRow);
    const vatCents = parseTurkishCents(raw.kdv_raw, 'kdv_raw', sourceRow);

    if ([amountCents, cogsCents, inputVatCents, outputVatCents].some((amount) => amount < 0)) {
      throw new Error(`source_row ${sourceRow}: net, cost, and VAT amounts cannot be negative.`);
    }
    if (
      Math.abs(amountCents + outputVatCents - totalCents) > 1 ||
      Math.abs(amountCents - cogsCents - profitCents) > 1 ||
      Math.abs(outputVatCents - inputVatCents - vatCents) > 1
    ) {
      throw new Error(`source_row ${sourceRow}: financial reconciliation exceeds one kuruş.`);
    }

    const paymentDate = raw.payment_date ? parseIsoDate(raw.payment_date, 'payment_date', sourceRow) : null;
    if (raw.collection_status === 'collected' && !paymentDate) {
      throw new Error(`source_row ${sourceRow}: collected row has no payment_date.`);
    }
    if (raw.collection_status === 'unknown' && paymentDate) {
      throw new Error(`source_row ${sourceRow}: unknown row must not have a payment_date.`);
    }

    const amountTry = centsToNumber(amountCents);
    const outputVat = centsToNumber(outputVatCents);
    const grossTry = centsToNumber(amountCents + outputVatCents);

    rows.push({
      source_row: sourceRow,
      transaction_date: transactionDate,
      customer_raw: raw.customer_raw,
      matched_customer_name: mapping.matchedCustomerName,
      income_type: raw.income_type,
      service_category: raw.service_category,
      amount_try: amountTry,
      cogs_try: centsToNumber(cogsCents),
      input_vat: centsToNumber(inputVatCents),
      output_vat: outputVat,
      collection_status: raw.collection_status,
      payment_method: raw.payment_method,
      payment_date: paymentDate,
      source_note: raw.source_note || null,
      donem_raw: raw.donem_raw,
      isin_cinsi_raw: raw.isin_cinsi_raw,
      toplam_raw: centsToNumber(totalCents),
      kar_raw: centsToNumber(profitCents),
      kdv_raw: centsToNumber(vatCents),
      raw_payload: raw,
      validation_errors: [],
      row_status: 'staged',
    });

    summary.row_count += 1;
    summary.net_total_try += amountTry;
    summary.output_vat_total_try += outputVat;
    summary.input_vat_total_try += centsToNumber(inputVatCents);
    summary.cogs_total_try += centsToNumber(cogsCents);
    summary.gross_total_try += grossTry;
    if (cogsCents > 0) summary.cogs_transaction_count += 1;
    if (raw.collection_status === 'collected') {
      summary.collected_count += 1;
      summary.collected_gross_total_try += grossTry;
      if (grossTry > 0) summary.payment_row_count += 1;
      else summary.zero_gross_collected_count += 1;
    } else {
      summary.unknown_count += 1;
    }
  }

  if (mappings.size !== customerRawValues.size) {
    throw new Error(`Mapping/customer coverage mismatch: mappings=${mappings.size}, finance customers=${customerRawValues.size}.`);
  }

  for (const rawCustomer of mappings.keys()) {
    if (!customerRawValues.has(rawCustomer)) {
      throw new Error(`Mapping has no finance rows for customer_raw: ${rawCustomer}`);
    }
  }

  summary.customer_count = customerRawValues.size;

  return {
    rows,
    summary: Object.fromEntries(Object.entries(summary).map(([key, value]) => [
      key,
      typeof value === 'number' ? Number(value.toFixed(2)) : value,
    ])),
  };
}

async function fetchCustomerIds(supabase, mappings) {
  const { data, error } = await supabase
    .from('customers')
    .select('id, company_name, company_name_search')
    .is('deleted_at', null);

  if (error) throw error;

  const customersBySearchName = new Map();
  for (const customer of data || []) {
    const key = customer.company_name_search || normalizeForSearch(customer.company_name);
    const candidates = customersBySearchName.get(key) || [];
    candidates.push(customer);
    customersBySearchName.set(key, candidates);
  }

  const resolved = new Map();
  for (const mapping of mappings.values()) {
    const candidates = customersBySearchName.get(normalizeForSearch(mapping.matchedCustomerName)) || [];
    if (candidates.length !== 1) {
      throw new Error(
        `Exact customer resolution failed for "${mapping.matchedCustomerName}": ${candidates.length} active candidates.`
      );
    }
    resolved.set(mapping.customerRaw, candidates[0].id);
  }

  return resolved;
}

function requireServiceRoleClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required for --stage.');
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function insertInChunks(supabase, table, records) {
  for (let offset = 0; offset < records.length; offset += BATCH_SIZE) {
    const chunk = records.slice(offset, offset + BATCH_SIZE);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) throw error;
  }
}

async function stageAndMaybePost({ args, financeCsv, mappingCsv, mappings, validated }) {
  const supabase = requireServiceRoleClient();
  const { data: existing, error: existingError } = await supabase
    .from('finance_import_batches')
    .select('id, status, source_checksum, mapping_checksum')
    .eq('import_key', args.importKey)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) {
    throw new Error(
      `Import key ${args.importKey} already exists with status ${existing.status}. ` +
      'Use a new import key instead of overwriting an audit batch.'
    );
  }

  const { data: batch, error: batchError } = await supabase
    .from('finance_import_batches')
    .insert({
      import_key: args.importKey,
      source_file_name: path.basename(args.financePath),
      mapping_file_name: path.basename(args.mappingPath),
      source_checksum: financeCsv.checksum,
      mapping_checksum: mappingCsv.checksum,
      source_row_count: validated.summary.row_count,
      validation_summary: validated.summary,
      notes: '2026 legacy finance import staged from validated CSV files.',
      created_by: args.createdBy,
    })
    .select('id, status')
    .single();

  if (batchError) throw batchError;

  let reviewed = false;

  try {
    const customerIds = await fetchCustomerIds(supabase, mappings);
    const mappingRows = [...mappings.values()].map((mapping) => ({
      batch_id: batch.id,
      customer_raw: mapping.customerRaw,
      matched_customer_name: mapping.matchedCustomerName,
      customer_id: customerIds.get(mapping.customerRaw),
      match_status: mapping.matchStatus,
      match_note: mapping.matchNote,
    }));
    const importRows = validated.rows.map((row) => ({
      ...row,
      batch_id: batch.id,
      customer_id: customerIds.get(row.customer_raw),
    }));

    await insertInChunks(supabase, 'customer_import_mappings', mappingRows);
    await insertInChunks(supabase, 'finance_import_rows', importRows);

    const reviewedAt = new Date().toISOString();
    const { data: reviewedRows, error: rowReviewError } = await supabase
      .from('finance_import_rows')
      .update({ row_status: 'reviewed', updated_at: reviewedAt })
      .eq('batch_id', batch.id)
      .eq('row_status', 'staged')
      .select('id');
    if (rowReviewError) throw rowReviewError;
    if ((reviewedRows || []).length !== validated.summary.row_count) {
      throw new Error(
        `Reviewed row count mismatch: expected ${validated.summary.row_count}, updated ${(reviewedRows || []).length}.`
      );
    }

    const { error: reviewError } = await supabase
      .from('finance_import_batches')
      .update({ status: 'reviewed', reviewed_at: reviewedAt })
      .eq('id', batch.id);
    if (reviewError) throw reviewError;
    reviewed = true;

    console.log(`Staged and reviewed batch ${batch.id}.`);
  } catch (error) {
    if (!reviewed) {
      await supabase
        .from('finance_import_batches')
        .update({ status: 'failed', notes: `Staging failed: ${error.message}` })
        .eq('id', batch.id)
        .eq('status', 'staged');
    }
    throw error;
  }
}

async function postExistingBatch({ args, financeCsv, mappingCsv }) {
  const supabase = requireServiceRoleClient();
  const { data: batch, error: batchError } = await supabase
    .from('finance_import_batches')
    .select('id, status, source_checksum, mapping_checksum')
    .eq('import_key', args.importKey)
    .maybeSingle();

  if (batchError) throw batchError;
  if (!batch) throw new Error(`Import key ${args.importKey} does not exist.`);
  if (batch.source_checksum !== financeCsv.checksum || batch.mapping_checksum !== mappingCsv.checksum) {
    throw new Error(`Import key ${args.importKey} does not match the supplied CSV checksums.`);
  }
  if (!['reviewed', 'posted'].includes(batch.status)) {
    throw new Error(`Import key ${args.importKey} is ${batch.status}; only reviewed batches can be posted.`);
  }

  const { data: posted, error: postError } = await supabase.rpc('post_finance_import_batch', {
    p_batch_id: batch.id,
  });
  if (postError) throw postError;
  console.log(JSON.stringify(posted, null, 2));
}

function printSummary({ args, financeCsv, mappingCsv, validated }) {
  console.log('Legacy Finance Import 2026 Validation');
  console.log(`Finance CSV: ${args.financePath}`);
  console.log(`Mapping CSV: ${args.mappingPath}`);
  console.log(`Import key: ${args.importKey}`);
  console.log(`Finance rows: ${financeCsv.records.length}`);
  console.log(`Mapping rows: ${mappingCsv.records.length}`);
  console.log(`Unique customers: ${new Set(validated.rows.map((row) => row.customer_raw)).size}`);
  console.log(`Collected rows: ${validated.summary.collected_count}`);
  console.log(`Unknown rows: ${validated.summary.unknown_count}`);
  console.log(`Net total TRY: ${validated.summary.net_total_try.toFixed(2)}`);
  console.log(`Output VAT TRY: ${validated.summary.output_vat_total_try.toFixed(2)}`);
  console.log(`Input VAT TRY: ${validated.summary.input_vat_total_try.toFixed(2)}`);
  console.log(`COGS TRY: ${validated.summary.cogs_total_try.toFixed(2)}`);
  console.log(`COGS expense rows: ${validated.summary.cogs_transaction_count}`);
  console.log(`Gross total TRY: ${validated.summary.gross_total_try.toFixed(2)}`);
  console.log(`Collected gross TRY: ${validated.summary.collected_gross_total_try.toFixed(2)}`);
  console.log(`Payment rows: ${validated.summary.payment_row_count}`);
  console.log(`Zero-gross collected rows: ${validated.summary.zero_gross_collected_count}`);
  console.log(args.stage ? 'Write mode: staging enabled.' : args.postExisting ? 'Write mode: post existing batch.' : 'Write mode: dry run only.');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const financeCsv = readCsv(args.financePath, FINANCE_HEADERS, 'Finance CSV');
  const mappingCsv = readCsv(args.mappingPath, MAPPING_HEADERS, 'Mapping CSV');
  const mappings = validateMappings(mappingCsv.records);
  const validated = validateFinanceRows(financeCsv.records, mappings);

  printSummary({ args, financeCsv, mappingCsv, validated });

  if (args.stage) {
    await stageAndMaybePost({ args, financeCsv, mappingCsv, mappings, validated });
  } else if (args.postExisting) {
    await postExistingBatch({ args, financeCsv, mappingCsv });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
