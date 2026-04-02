import { z } from 'zod';
import i18n from '../../lib/i18n';

export const materialSchema = z.object({
  code: z.string().min(1, i18n.t('errors:validation.required')).max(50),
  name: z.string().min(1, i18n.t('errors:validation.required')).max(200),
  description: z.string().optional().or(z.literal('')),
  category: z.string().optional().or(z.literal('')),
  unit: z.enum([
    'adet', 'boy', 'paket', 'metre', 'mm', 'V', 'A', 'W',
    'MHz', 'TB', 'MP', 'port', 'kanal', 'inç', 'rpm', 'bölge',
    'set', 'takim',
  ]).default('adet'),
  is_active: z.boolean().default(true),
});

export const materialDefaultValues = {
  code: '',
  name: '',
  description: '',
  category: '',
  unit: 'adet',
  is_active: true,
};
