import { z } from 'zod';
import i18n from '../../lib/i18n';

export const profileSchema = z.object({
  full_name: z
    .string()
    .min(1, i18n.t('profile:validation.fullNameRequired')),
  phone: z.string().optional(),
});

export const profileDefaultValues = {
  full_name: '',
  phone: '',
};

// Reuse auth validation messages for password change
const passwordSchema = z
  .string()
  .min(1, i18n.t('auth:validation.passwordRequired'))
  .min(8, i18n.t('auth:validation.passwordMinLength'));

export const changePasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, i18n.t('auth:validation.confirmPasswordRequired')),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: i18n.t('auth:validation.passwordsDoNotMatch'),
    path: ['confirmPassword'],
  });

export const changePasswordDefaultValues = {
  password: '',
  confirmPassword: '',
};
