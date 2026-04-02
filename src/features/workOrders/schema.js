import { z } from 'zod';
import i18n from '../../lib/i18n';

const toNumber = (val) => (val === '' || val === undefined || val === null ? undefined : Number(val));

export const WORK_TYPES = ['survey', 'installation', 'service', 'maintenance', 'other'];
export const CURRENCIES = ['TRY', 'USD'];

/** Must match `proposalItemSchema.unit` and the shared unit dropdown in line-item editors. */
export const WORK_ORDER_ITEM_UNITS = [
  'adet', 'boy', 'paket', 'metre', 'mm', 'V', 'A', 'W',
  'MHz', 'TB', 'MP', 'port', 'kanal', 'inç', 'rpm', 'bölge',
  'set', 'takim',
];

const workOrderItemUnitEnum = z.enum(WORK_ORDER_ITEM_UNITS);

/**
 * Canonical work order / proposal line-item unit (trim, case-insensitive match, unknown → adet).
 * Keeps Zod happy when materials DB has mixed case or legacy import values.
 */
export function normalizeWorkOrderItemUnit(val) {
  if (val === '' || val === undefined || val === null) return 'adet';
  const s = String(val).trim();
  if (!s) return 'adet';
  const lower = s.toLowerCase();
  for (const u of WORK_ORDER_ITEM_UNITS) {
    if (u.toLowerCase() === lower) return u;
  }
  return 'adet';
}

export const workOrderSchema = z.object({
  site_id: z.union([z.literal(''), z.string().uuid()]),
  form_no: z.string().optional().or(z.literal('')),
  work_type: z.enum(WORK_TYPES),
  work_type_other: z.string().max(30).optional().or(z.literal('')),
  status: z.enum(['pending', 'scheduled', 'in_progress', 'completed', 'cancelled']).default('pending'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  assigned_to: z.array(z.string()).min(0).max(3, i18n.t('workOrders:validation.assignedToMax')),
  description: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  /** Stored for API/list; not edited in form — revenue from line items or DB trigger. */
  currency: z.enum(CURRENCIES).default('TRY'),
  items: z.array(z.object({
    description: z.string().min(1, i18n.t('errors:validation.required')),
    quantity: z.coerce.number().positive(),
    unit: z.preprocess(normalizeWorkOrderItemUnit, workOrderItemUnitEnum),
    unit_price: z.coerce.number().min(0),
    material_id: z.string().uuid().optional().nullable().or(z.literal('')),
    cost: z.coerce.number().min(0).optional().nullable(),
  })).min(0),
  materials_discount_percent: z.coerce.number().min(0).max(100).optional().nullable(),
  has_vat: z.boolean().default(true),
  has_tevkifat: z.boolean().default(false),
  vat_rate: z.preprocess(toNumber, z.number().min(0).max(100).default(20)),
}).refine((data) => {
  if (data.work_type === 'other') {
    return data.work_type_other && data.work_type_other.length > 0;
  }
  return true;
}, {
  message: i18n.t('workOrders:validation.workTypeOtherRequired'),
  path: ['work_type_other'],
}).refine((data) => {
  if (data.work_type !== 'survey' && data.items.length === 0) {
    return false;
  }
  return true;
}, {
  message: i18n.t('errors:validation.required'),
  path: ['items'],
}).superRefine((data, ctx) => {
  if (data.work_type !== 'survey' && (!data.site_id || data.site_id === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['site_id'],
      message: i18n.t('errors:validation.required'),
    });
  }
});

export const workOrderDefaultValues = {
  site_id: '',
  form_no: '',
  work_type: 'service',
  work_type_other: '',
  status: 'pending',
  priority: 'normal',
  scheduled_date: '',
  scheduled_time: '',
  assigned_to: [],
  description: '',
  notes: '',
  currency: 'TRY',
  items: [
    { description: '', quantity: 1, unit: 'adet', unit_price: 0, material_id: null, cost: null },
  ],
  materials_discount_percent: 0,
  has_vat: true,
  has_tevkifat: false,
  vat_rate: 20,
};
