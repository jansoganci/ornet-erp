import { z } from 'zod';
import i18n from '../../lib/i18n';

// Constants
export const DIRECTIONS = ['income', 'expense'];
export const INCOME_TYPES = ['subscription', 'sim_rental', 'sale', 'service', 'installation', 'maintenance', 'other'];
export const PAYMENT_METHODS = ['card', 'cash', 'bank_transfer'];
export const CURRENCIES = ['TRY', 'USD'];
export const VIEW_MODES = ['total', 'official', 'unofficial'];

const toNumber = (val) => (val === '' || val === undefined || val === null ? undefined : Number(val));
const optionalUuid = () => z.union([z.string().uuid(), z.literal('')]).optional();

export const transactionSchema = z
  .object({
    direction: z.enum(DIRECTIONS),
    income_type: z.enum(INCOME_TYPES).optional().or(z.literal('')),
    expense_category_id: optionalUuid(),
    amount_original: z.preprocess(toNumber, z.number({ invalid_type_error: i18n.t('errors:validation.invalidNumber') }).min(0)),
    original_currency: z.enum(CURRENCIES).default('TRY'),
    amount_try: z.preprocess(toNumber, z.number({ invalid_type_error: i18n.t('errors:validation.invalidNumber') }).min(0)),
    exchange_rate: z.preprocess(toNumber, z.number().positive().optional()),
    should_invoice: z.boolean().optional(),
    has_invoice: z.boolean().optional(),
    output_vat: z.preprocess(toNumber, z.number().optional()),
    input_vat: z.preprocess(toNumber, z.number().optional()),
    vat_rate: z.preprocess(toNumber, z.number().min(0).max(100).default(20)),
    cogs_try: z.preprocess(toNumber, z.number().min(0).optional()),
    transaction_date: z.string().min(1, i18n.t('errors:validation.required')),
    customer_id: optionalUuid(),
    site_id: optionalUuid(),
    description: z.string().optional().or(z.literal('')),
    payment_method: z.enum(PAYMENT_METHODS).optional(),
    work_order_id: optionalUuid(),
    proposal_id: optionalUuid(),
  })
  .refine(
    (data) => {
      if (data.direction === 'income') {
        return data.has_invoice === undefined || data.has_invoice === null;
      }
      return true;
    },
    { message: i18n.t('errors:validation.invalidForTransactionType'), path: ['has_invoice'] }
  )
  .refine(
    (data) => {
      if (data.direction === 'expense') {
        return data.should_invoice === undefined || data.should_invoice === null;
      }
      return true;
    },
    { message: i18n.t('errors:validation.invalidForTransactionType'), path: ['should_invoice'] }
  );

export const transactionDefaultValues = {
  direction: 'income',
  income_type: 'other',
  expense_category_id: '',
  amount_original: 0,
  amount_try: 0,
  original_currency: 'TRY',
  exchange_rate: undefined,
  should_invoice: true,
  has_invoice: undefined,
  output_vat: undefined,
  input_vat: undefined,
  vat_rate: 20,
  cogs_try: undefined,
  transaction_date: '',
  customer_id: '',
  site_id: '',
  description: '',
  payment_method: 'bank_transfer',
  work_order_id: '',
  proposal_id: '',
};

export const categorySchema = z.object({
  code: z.string().min(1, i18n.t('errors:validation.required')),
  name_tr: z.string().min(1, i18n.t('errors:validation.required')),
  name_en: z.string().min(1, i18n.t('errors:validation.required')),
  icon: z.string().optional().or(z.literal('')),
  is_system: z.boolean().default(false),
  is_active: z.boolean().default(true),
  sort_order: z.preprocess(toNumber, z.number().int().min(0).default(0)),
});

export const categoryDefaultValues = {
  code: '',
  name_tr: '',
  name_en: '',
  icon: '',
  is_system: false,
  is_active: true,
  sort_order: 0,
};

export const rateSchema = z.object({
  currency: z.string().default('USD'),
  buy_rate: z.preprocess(toNumber, z.number().positive().optional()),
  sell_rate: z.preprocess(toNumber, z.number().positive().optional()),
  effective_rate: z.preprocess(toNumber, z.number({ invalid_type_error: i18n.t('errors:validation.invalidNumber') }).positive()),
  rate_date: z.string().min(1, i18n.t('errors:validation.required')),
  source: z.string().default('TCMB'),
});

export const rateDefaultValues = {
  currency: 'USD',
  buy_rate: undefined,
  sell_rate: undefined,
  effective_rate: undefined,
  rate_date: '',
  source: 'TCMB',
};

// Expense quick-entry form (subset of transaction)
export const expenseSchema = z.object({
  expense_category_id: z.string().min(1, i18n.t('errors:validation.required')).uuid(),
  amount_try: z.preprocess(toNumber, z.number({ invalid_type_error: i18n.t('errors:validation.invalidNumber') }).min(0)),
  transaction_date: z.string().min(1, i18n.t('errors:validation.required')),
  payment_method: z.enum(PAYMENT_METHODS),
  has_invoice: z.boolean().default(true),
  description: z.string().optional().or(z.literal('')),
  vat_rate: z.preprocess(toNumber, z.number().min(0).max(100).default(20)),
});

export const expenseDefaultValues = {
  expense_category_id: '',
  amount_try: 0,
  transaction_date: '',
  payment_method: 'bank_transfer',
  has_invoice: true,
  description: '',
  vat_rate: 20,
};

// Income quick-entry form (subset of transaction)
export const incomeSchema = z
  .object({
    amount_original: z.preprocess(toNumber, z.number({ invalid_type_error: i18n.t('errors:validation.invalidNumber') }).min(0)),
    original_currency: z.enum(CURRENCIES).default('TRY'),
    amount_try: z.preprocess(toNumber, z.number({ invalid_type_error: i18n.t('errors:validation.invalidNumber') }).min(0)),
    exchange_rate: z.preprocess(toNumber, z.number().positive().optional()),
    transaction_date: z.string().min(1, i18n.t('errors:validation.required')),
    income_type: z.enum(INCOME_TYPES),
    customer_id: optionalUuid(),
    site_id: optionalUuid(),
    payment_method: z.enum(PAYMENT_METHODS),
    should_invoice: z.boolean().default(true),
    vat_rate: z.preprocess(toNumber, z.number().min(0).max(100).default(20)),
    cogs_try: z.preprocess(toNumber, z.number().min(0).optional()),
    description: z.string().optional().or(z.literal('')),
    proposal_id: optionalUuid(),
    work_order_id: optionalUuid(),
  })
  .refine(
    (data) => {
      if (data.original_currency === 'USD') {
        return data.exchange_rate != null && Number(data.exchange_rate) > 0;
      }
      return true;
    },
    { message: i18n.t('errors:validation.required'), path: ['exchange_rate'] }
  );

export const incomeDefaultValues = {
  amount_original: 0,
  amount_try: 0,
  original_currency: 'TRY',
  exchange_rate: undefined,
  transaction_date: '',
  income_type: 'other',
  customer_id: '',
  site_id: '',
  payment_method: 'bank_transfer',
  should_invoice: true,
  vat_rate: 20,
  cogs_try: undefined,
  description: '',
  proposal_id: '',
  work_order_id: '',
};
