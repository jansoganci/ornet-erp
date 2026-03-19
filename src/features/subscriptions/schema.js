import { z } from 'zod';
import i18n from '../../lib/i18n';
import { isoDateString, currencyEnum } from '../../lib/zodHelpers';

const isoDateSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  'Geçerli bir tarih giriniz (YYYY-AA-GG)'
);

// Constants
export const SERVICE_TYPES = [
  'A.KIRA.KK', 'A.KIRA.ELDEN', 'A.KIRA.ELDEN.MET', 'A.KIRA.BANKA',
  'A.S.ALMA', 'A.S.ALMA.YILLIK', 'A.S.ALMA.BANKA',
  'INT.AYLIK.KK', 'INT.AYLIK.BANKA', 'INT.YILLIK',
  'K.KIRA.KK', 'K.KIRA.BANKA',
];
export const BILLING_FREQUENCIES = ['monthly', '3_month', '6_month', 'yearly'];
export const SUBSCRIPTION_STATUSES = ['active', 'paused', 'cancelled'];
export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'skipped', 'write_off'];
export const PAYMENT_METHODS = ['card', 'cash', 'bank_transfer'];
export const INVOICE_TYPES = ['e_fatura', 'e_arsiv', 'kagit'];

const toNumber = (val) => (val === '' || val === undefined || val === null ? undefined : Number(val));

// Optional string: accepts string, '', undefined; outputs string | undefined
const optionalString = z.union([z.string(), z.literal('')]).optional().transform((v) => (v === '' ? undefined : v));
// Optional UUID: accepts uuid string, '', undefined; outputs string | undefined
const optionalUuid = z.union([z.string().uuid(), z.literal('')]).optional().transform((v) => (v === '' ? undefined : v));
// Optional enum: accepts enum value, '', undefined; outputs string | undefined
const optionalEnum = (enumValues) => z.union([z.enum(enumValues), z.literal('')]).optional().transform((v) => (v === '' ? undefined : v));

// Subscription form schema
export const subscriptionSchema = z.object({
  site_id: z.string().min(1, i18n.t('errors:validation.required')).uuid(),
  start_date: z.string().min(1, i18n.t('errors:validation.required')).regex(
    /^\d{4}-\d{2}-\d{2}$/,
    'Geçerli bir tarih giriniz (YYYY-AA-GG)'
  ),
  billing_day: z.preprocess(toNumber, z.number().int().min(1).max(28).default(1)),
  base_price: z.preprocess(toNumber, z.number({ invalid_type_error: i18n.t('errors:validation.invalidNumber') }).min(0)),
  sms_fee: z.preprocess(toNumber, z.number().min(0).default(0)),
  line_fee: z.preprocess(toNumber, z.number().min(0).default(0)),
  vat_rate: z.preprocess(toNumber, z.number().min(0).max(100).default(20)),
  cost: z.preprocess(toNumber, z.number().min(0).default(0)),
  static_ip_fee: z.preprocess(toNumber, z.number().min(0).default(0)),
  static_ip_cost: z.preprocess(toNumber, z.number().min(0).default(0)),
  service_type: optionalEnum(SERVICE_TYPES),
  billing_frequency: z.enum(BILLING_FREQUENCIES).default('monthly'),
  cash_collector_id: optionalString,
  official_invoice: z.boolean().default(true),
  card_bank_name: optionalString,
  card_last4: z.union([z.string().max(4), z.literal('')]).optional().transform((v) => (v === '' ? undefined : v)),
  sim_card_id: optionalUuid,
  alarm_center: optionalString,
  alarm_center_account: optionalString,
  subscriber_title: optionalString,
  payment_start_month: z.preprocess(toNumber, z.number().int().min(1).max(12).nullable().optional()),
}).refine(
  (data) => {
    if (['3_month', '6_month', 'yearly'].includes(data.billing_frequency)) {
      return data.payment_start_month != null;
    }
    return true;
  },
  {
    message: i18n.t('subscriptions:validation.paymentStartMonthRequired'),
    path: ['payment_start_month'],
  },
);

export const subscriptionDefaultValues = {
  site_id: '',
  start_date: '',
  billing_day: 1,
  base_price: '',
  sms_fee: '',
  line_fee: '',
  vat_rate: 20,
  cost: '',
  static_ip_fee: '',
  static_ip_cost: '',
  currency: 'TRY',
  payment_method_id: '',
  sold_by: '',
  managed_by: '',
  notes: '',
  setup_notes: '',
  service_type: '',
  billing_frequency: 'monthly',
  cash_collector_id: '',
  official_invoice: true,
  card_bank_name: '',
  card_last4: '',
  sim_card_id: '',
  alarm_center: '',
  alarm_center_account: '',
  subscriber_title: '',
  payment_start_month: null,
};

// Payment record schema
export const paymentRecordSchema = z.object({
  payment_date: isoDateSchema,
  payment_method: z.enum(PAYMENT_METHODS),
  should_invoice: z.boolean().default(true),
  vat_rate: z.preprocess(toNumber, z.number().min(0).max(100).default(20)),
  invoice_no: optionalString,
  invoice_type: optionalEnum(INVOICE_TYPES),
  notes: optionalString,
  reference_no: optionalString,
}).refine((data) => {
  // Card payments must always be invoiced
  if (data.payment_method === 'card' && data.should_invoice === false) {
    return false;
  }
  return true;
}, {
  message: i18n.t('subscriptions:validation.cardPaymentsMustBeInvoiced'),
  path: ['should_invoice'],
});

export const paymentRecordDefaultValues = {
  payment_date: new Date().toISOString().slice(0, 10),
  payment_method: 'card',
  should_invoice: true,
  vat_rate: 20,
  invoice_no: '',
  invoice_type: '',
  notes: '',
  reference_no: '',
};

// Payment method schema
export const paymentMethodSchema = z.object({
  customer_id: z.string().min(1, i18n.t('errors:validation.required')),
  method_type: z.enum(['card', 'bank_transfer', 'cash']),
  card_last4: z.union([z.string().length(4), z.literal('')]).optional().transform((v) => (v === '' ? undefined : v)),
  card_holder: optionalString,
  card_expiry: optionalString,
  card_brand: optionalString,
  bank_name: optionalString,
  iban: z.union([
    z.string().regex(
      /^TR\d{2}[0-9]{22}$/,
      'Geçerli bir IBAN giriniz (TR ile başlayan 26 karakter)'
    ),
    z.literal(''),
  ]).optional().transform((v) => (v === '' ? undefined : v)),
  label: optionalString,
  is_default: z.boolean().default(false),
});

export const paymentMethodDefaultValues = {
  customer_id: '',
  method_type: 'card',
  card_last4: '',
  card_holder: '',
  card_expiry: '',
  card_brand: '',
  bank_name: '',
  iban: '',
  label: '',
  is_default: false,
};
