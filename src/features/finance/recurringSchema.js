import { z } from 'zod';
import i18n from '../../lib/i18n';

const toNumber = (val) => (val === '' || val === undefined || val === null ? undefined : Number(val));

export const PAYMENT_METHODS = ['card', 'cash', 'bank_transfer'];

export const templateSchema = z.object({
  name: z.string().min(1, i18n.t('errors:validation.required')),
  expense_category_id: z.string().min(1, i18n.t('errors:validation.required')).uuid(),
  is_variable: z.boolean().default(false),
  amount: z.preprocess(toNumber, z.number({ invalid_type_error: i18n.t('errors:validation.invalidNumber') }).min(0)),
  day_of_month: z.preprocess(toNumber, z.number({ invalid_type_error: i18n.t('errors:validation.invalidNumber') }).int().min(1).max(31)),
  is_active: z.boolean().default(true),
  payment_method: z.enum(PAYMENT_METHODS),
  has_invoice: z.boolean().default(true),
  vat_rate: z.preprocess(toNumber, z.number().min(0).max(100).default(20)),
  description_template: z.string().optional().or(z.literal('')),
});

export const templateDefaultValues = {
  name: '',
  expense_category_id: '',
  is_variable: false,
  amount: 0,
  day_of_month: 1,
  is_active: true,
  payment_method: 'bank_transfer',
  has_invoice: true,
  vat_rate: 20,
  description_template: '',
};

