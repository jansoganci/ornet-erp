import { z } from 'zod';
import i18n from '../../lib/i18n';

const isoDateSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  'Geçerli bir tarih giriniz (YYYY-AA-GG)'
);

const optionalString = z.union([z.string(), z.literal('')]).optional().transform((v) => (v === '' ? undefined : v));

export const assetSchema = z.object({
  site_id: z.string().min(1, i18n.t('errors:validation.required')).uuid(),
  equipment_name: z.string().min(1, i18n.t('errors:validation.required')),
  quantity: z.coerce.number().min(1).max(999).default(1),
  installation_date: z.union([isoDateSchema, z.literal('')]).optional().transform((v) => (v === '' ? undefined : v)),
});

export const assetDefaultValues = {
  site_id: '',
  equipment_name: '',
  quantity: 1,
  installation_date: '',
};

const batchAssetItemSchema = z.object({
  equipment_name: z.string().optional().default(''),
  quantity: z.coerce.number().min(1).max(999).default(1),
});

export const batchAssetSchema = z.object({
  site_id: z.string().min(1, i18n.t('errors:validation.required')).uuid(),
  installation_date: z.union([isoDateSchema, z.literal('')]).optional().transform((v) => (v === '' ? undefined : v)),
  items: z
    .array(batchAssetItemSchema)
    .min(1, i18n.t('errors:validation.required'))
    .refine((arr) => arr.some((item) => (item.equipment_name || '').trim()), {
      message: i18n.t('errors:validation.required'),
      path: ['items'],
    }),
});

export const batchAssetDefaultValues = {
  site_id: '',
  installation_date: '',
  items: [{ equipment_name: '', quantity: 1 }],
};

export const bulkItemSchema = z.object({
  equipment_name: z.string().min(1, i18n.t('errors:validation.required')),
  quantity: z.coerce.number().min(1).max(999).default(1),
  installation_date: z.union([isoDateSchema, z.literal('')]).optional().transform((v) => (v === '' ? undefined : v)),
});

export const bulkItemDefaultValues = {
  equipment_name: '',
  quantity: 1,
  installation_date: '',
};
