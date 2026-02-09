import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';

import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { AuthLayout } from './components/AuthLayout';
import { PasswordInput } from './components/PasswordInput';
import { loginSchema, loginDefaultValues } from './schema';
import { signIn } from './api';
import { getAuthErrorKey } from './utils/errorMapper';

export function LoginPage() {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const location = useLocation();

  // Get the intended destination (if user was redirected to login)
  const from = location.state?.from?.pathname || '/';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: loginDefaultValues,
  });

  const onSubmit = async (data) => {
    try {
      await signIn(data.email, data.password);
      // Redirect to intended destination or dashboard
      navigate(from, { replace: true });
    } catch (error) {
      const errorKey = getAuthErrorKey(error);
      toast.error(t(errorKey));
    }
  };

  return (
    <AuthLayout title={t('login.title')} subtitle={t('login.subtitle')}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Email */}
        <Input
          label={t('login.email')}
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />

        {/* Password */}
        <PasswordInput
          label={t('login.password')}
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />

        {/* Forgot password link */}
        <div className="flex items-center justify-end">
          <Link
            to="/forgot-password"
            className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
          >
            {t('login.forgotPassword')}
          </Link>
        </div>

        {/* Submit button */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          loading={isSubmitting}
        >
          {isSubmitting ? t('login.submitting') : t('login.submit')}
        </Button>
      </form>

      {/* Link to register */}
      <p className="mt-6 text-center text-sm text-neutral-600 dark:text-neutral-400">
        {t('login.noAccount')}{' '}
        <Link
          to="/register"
          className="font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
        >
          {t('login.createAccount')}
        </Link>
      </p>
    </AuthLayout>
  );
}
