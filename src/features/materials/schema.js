import { z } from 'zod';
import i18n from '../../lib/i18n';

export const materialSchema = z.object({
  code: z.string().min(1, i18n.t('errors:validation.required')),
  name: z.string().min(1, i18n.t('errors:validation.required')),
  category: z.string().optional().or(z.literal('')),
  unit: z.string().default('adet'),
  is_active: z.boolean().default(true),
});

export const materialDefaultValues = {
  code: '',
  name: '',
  category: '',
  unit: 'adet',
  is_active: true,
};
