import { z } from 'zod';
import i18n from '../../lib/i18n';

// Constants
export const SUBSCRIPTION_TYPES = ['recurring_card', 'manual_cash', 'manual_bank'];
export const SERVICE_TYPES = ['alarm_only', 'camera_only', 'internet_only'];
export const BILLING_FREQUENCIES = ['monthly', '6_month', 'yearly'];
export const SUBSCRIPTION_STATUSES = ['active', 'paused', 'cancelled'];
export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'skipped', 'write_off'];
export const PAYMENT_METHODS = ['card', 'cash', 'bank_transfer'];
export const INVOICE_TYPES = ['e_fatura', 'e_arsiv', 'kagit'];

const toNumber = (val) => (val === '' || val === undefined || val === null ? undefined : Number(val));

// Subscription form schema
export const subscriptionSchema = z.object({
  site_id: z.string().min(1, i18n.t('errors:validation.required')),
  subscription_type: z.enum(SUBSCRIPTION_TYPES),
  start_date: z.string().min(1, i18n.t('errors:validation.required')),
  billing_day: z.preprocess(toNumber, z.number().int().min(1).max(28).default(1)),
  base_price: z.preprocess(toNumber, z.number({ invalid_type_error: i18n.t('errors:validation.invalidNumber') }).min(0)),
  sms_fee: z.preprocess(toNumber, z.number().min(0).default(0)),
  line_fee: z.preprocess(toNumber, z.number().min(0).default(0)),
  vat_rate: z.preprocess(toNumber, z.number().min(0).max(100).default(20)),
  cost: z.preprocess(toNumber, z.number().min(0).default(0)),
  static_ip_fee: z.preprocess(toNumber, z.number().min(0).default(0)),
  static_ip_cost: z.preprocess(toNumber, z.number().min(0).default(0)),
  currency: z.string().default('TRY'),
  payment_method_id: z.string().optional().or(z.literal('')),
  sold_by: z.string().optional().or(z.literal('')),
  managed_by: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  setup_notes: z.string().optional().or(z.literal('')),
  service_type: z.enum(SERVICE_TYPES).optional().or(z.literal('')),
  billing_frequency: z.enum(BILLING_FREQUENCIES).default('monthly'),
  cash_collector_id: z.string().optional().or(z.literal('')),
  official_invoice: z.boolean().default(true),
  card_bank_name: z.string().optional().or(z.literal('')),
  card_last4: z.string().max(4).optional().or(z.literal('')),
  sim_card_id: z.string().uuid().nullable().optional().or(z.literal('')),
}).refine((data) => {
  if (data.subscription_type === 'recurring_card') {
    const hasPaymentMethod = data.payment_method_id && String(data.payment_method_id).trim();
    const hasInlineCard = data.card_bank_name && data.card_last4 && String(data.card_last4).length === 4;
    return !!hasPaymentMethod || !!hasInlineCard;
  }
  return true;
}, {
  message: i18n.t('subscriptions:validation.paymentMethodRequired'),
  path: ['payment_method_id'],
}).refine((data) => {
  if (data.subscription_type === 'manual_cash') {
    return !!(data.cash_collector_id && String(data.cash_collector_id).trim());
  }
  return true;
}, {
  message: i18n.t('errors:validation.required'),
  path: ['cash_collector_id'],
});

export const subscriptionDefaultValues = {
  site_id: '',
  subscription_type: 'recurring_card',
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
};

// Payment record schema
export const paymentRecordSchema = z.object({
  payment_date: z.string().min(1, i18n.t('errors:validation.required')),
  payment_method: z.enum(PAYMENT_METHODS),
  should_invoice: z.boolean().default(true),
  vat_rate: z.preprocess(toNumber, z.number().min(0).max(100).default(20)),
  invoice_no: z.string().optional().or(z.literal('')),
  invoice_type: z.enum(INVOICE_TYPES).optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  reference_no: z.string().optional().or(z.literal('')),
}).refine((data) => {
  // Card payments must always be invoiced
  if (data.payment_method === 'card' && data.should_invoice === false) {
    return false;
  }
  return true;
}, {
  message: 'Kart ödemeleri faturalanmalıdır',
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
  card_last4: z.string().length(4).optional().or(z.literal('')),
  card_holder: z.string().optional().or(z.literal('')),
  card_expiry: z.string().optional().or(z.literal('')),
  card_brand: z.string().optional().or(z.literal('')),
  bank_name: z.string().optional().or(z.literal('')),
  iban: z.string().optional().or(z.literal('')),
  label: z.string().optional().or(z.literal('')),
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
