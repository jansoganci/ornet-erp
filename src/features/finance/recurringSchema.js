import { z } from 'zod';
import i18n from '../../lib/i18n';

const toNumber = (val) => (val === '' || val === undefined || val === null ? undefined : Number(val));

export const PAYMENT_METHODS = ['card', 'cash', 'bank_transfer'];
export const BURDEN_TYPES = ['unassigned', 'labor_burden', 'vehicle_burden', 'general_overhead'];

export const templateSchema = z.object({
  name: z.string().min(1, i18n.t('errors:validation.required')),
  expense_category_id: z.string().min(1, i18n.t('errors:validation.required')).uuid(),
  burden_type: z.enum(BURDEN_TYPES).default('unassigned'),
  is_variable: z.boolean().default(false),
  amount: z.preprocess(toNumber, z.number({ invalid_type_error: i18n.t('errors:validation.invalidNumber') }).positive()),
  day_of_month: z.preprocess(toNumber, z.number({ invalid_type_error: i18n.t('errors:validation.invalidNumber') }).int().min(1).max(31)),
  is_active: z.boolean().default(true),
  payment_method: z.enum(PAYMENT_METHODS),
  has_invoice: z.boolean().default(true),
  vat_rate: z.preprocess(toNumber, z.number().min(0).max(100).default(20)),
  description_template: z.string().optional().or(z.literal('')),
});

export function normalizeRecurringTemplateName(name) {
  return String(name ?? '').trim().toLowerCase();
}

export function hasActiveTemplateNameConflict(name, templates, excludeId = null) {
  const normalized = normalizeRecurringTemplateName(name);
  if (!normalized) return false;

  return (templates || []).some(
    (template) =>
      template.id !== excludeId
      && normalizeRecurringTemplateName(template.name) === normalized
  );
}

export const templateDefaultValues = {
  name: '',
  expense_category_id: '',
  burden_type: 'unassigned',
  is_variable: false,
  amount: 0,
  day_of_month: 1,
  is_active: true,
  payment_method: 'bank_transfer',
  has_invoice: true,
  vat_rate: 20,
  description_template: '',
};
