// Pages
export { LoginPage } from './LoginPage';
export { RegisterPage } from './RegisterPage';
export { ForgotPasswordPage } from './ForgotPasswordPage';
export { UpdatePasswordPage } from './UpdatePasswordPage';
export { VerifyEmailPage } from './VerifyEmailPage';

// Components
export { AuthLayout } from './components/AuthLayout';
export { PasswordInput } from './components/PasswordInput';
export { PasswordStrength } from './components/PasswordStrength';
export { EmailVerificationBanner } from './components/EmailVerificationBanner';

// Schemas
export {
  loginSchema,
  loginDefaultValues,
  registerSchema,
  registerDefaultValues,
  forgotPasswordSchema,
  forgotPasswordDefaultValues,
  updatePasswordSchema,
  updatePasswordDefaultValues,
} from './schema';

// API
export * from './api';

// Utils
export { getAuthErrorKey } from './utils/errorMapper';
