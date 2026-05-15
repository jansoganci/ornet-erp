import { z } from 'zod';
import i18n from '../../lib/i18n';

const toOptionalNumber = (val) => {
  if (val === '' || val === undefined || val === null) return null;
  const n = Number(val);
  return Number.isNaN(n) ? null : n;
};

export const materialSchema = z.object({
  code: z.string().min(1, i18n.t('errors:validation.required')).max(50),
  name: z.string().min(1, i18n.t('errors:validation.required')).max(200),
  description: z.string().optional().or(z.literal('')),
  unit: z.enum([
    'adet', 'boy', 'paket', 'metre', 'mm', 'V', 'A', 'W',
    'MHz', 'TB', 'MP', 'port', 'kanal', 'inç', 'rpm', 'bölge',
    'set', 'takim',
  ]).default('adet'),
  unit_price: z.preprocess(toOptionalNumber, z.number().min(0).optional().nullable()),
  cost_price: z.preprocess(toOptionalNumber, z.number().min(0).optional().nullable()),
  currency: z.enum(['TRY', 'USD']).default('TRY'),
  is_active: z.boolean().default(true),
});

export const materialDefaultValues = {
  code: '',
  name: '',
  description: '',
  unit: 'adet',
  unit_price: null,
  cost_price: null,
  currency: 'TRY',
  is_active: true,
};
