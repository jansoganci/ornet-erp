import { z } from 'zod';
import i18n from '../../lib/i18n';

// Reusable email schema
const emailSchema = z
  .string()
  .min(1, i18n.t('auth:validation.emailRequired'))
  .email(i18n.t('auth:validation.emailInvalid'));

// Reusable password schema (with minimum length)
const passwordSchema = z
  .string()
  .min(1, i18n.t('auth:validation.passwordRequired'))
  .min(8, i18n.t('auth:validation.passwordMinLength'));

// Login form schema
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, i18n.t('auth:validation.passwordRequired')),
});

export const loginDefaultValues = {
  email: '',
  password: '',
};

// Register form schema
export const registerSchema = z
  .object({
    fullName: z.string().min(1, i18n.t('auth:validation.fullNameRequired')),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, i18n.t('auth:validation.confirmPasswordRequired')),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: i18n.t('auth:validation.passwordsDoNotMatch'),
    path: ['confirmPassword'],
  });

export const registerDefaultValues = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
};

// Forgot password form schema
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const forgotPasswordDefaultValues = {
  email: '',
};

// Update password form schema
export const updatePasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, i18n.t('auth:validation.confirmPasswordRequired')),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: i18n.t('auth:validation.passwordsDoNotMatch'),
    path: ['confirmPassword'],
  });

export const updatePasswordDefaultValues = {
  password: '',
  confirmPassword: '',
};
