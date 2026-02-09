import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CheckCircle } from 'lucide-react';

import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { AuthLayout } from './components/AuthLayout';
import { PasswordInput } from './components/PasswordInput';
import { PasswordStrength } from './components/PasswordStrength';
import { registerSchema, registerDefaultValues } from './schema';
import { signUp } from './api';
import { getAuthErrorKey } from './utils/errorMapper';

export function RegisterPage() {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: registerDefaultValues,
  });

  // Watch password for strength indicator
  const password = watch('password');

  const onSubmit = async (data) => {
    try {
      await signUp(data.email, data.password, {
        full_name: data.fullName,
      });

      // Show success state
      setIsSuccess(true);
    } catch (error) {
      const errorKey = getAuthErrorKey(error);
      toast.error(t(errorKey));
    }
  };

  // Success state - show message about verification email
  if (isSuccess) {
    return (
      <AuthLayout>
        <div className="text-center py-4">
          {/* Success icon */}
          <div className="mx-auto w-16 h-16 bg-success-100 dark:bg-success-900/30 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-success-600 dark:text-success-400" />
          </div>

          {/* Title */}
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50 mb-2">
            {t('register.success.title')}
          </h2>

          {/* Message */}
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">
            {t('register.success.message')}
          </p>

          {/* Back to login link */}
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={() => navigate('/login')}
          >
            {t('login.title')}
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t('register.title')} subtitle={t('register.subtitle')}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Full Name */}
        <Input
          label={t('register.fullName')}
          type="text"
          autoComplete="name"
          error={errors.fullName?.message}
          {...register('fullName')}
        />

        {/* Email */}
        <Input
          label={t('register.email')}
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />

        {/* Password */}
        <div>
          <PasswordInput
            label={t('register.password')}
            autoComplete="new-password"
            error={errors.password?.message}
            {...register('password')}
          />
          <PasswordStrength password={password} />
        </div>

        {/* Confirm Password */}
        <PasswordInput
          label={t('register.confirmPassword')}
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        {/* Submit button */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          loading={isSubmitting}
        >
          {isSubmitting ? t('register.submitting') : t('register.submit')}
        </Button>
      </form>

      {/* Link to login */}
      <p className="mt-6 text-center text-sm text-neutral-600 dark:text-neutral-400">
        {t('register.hasAccount')}{' '}
        <Link
          to="/login"
          className="font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
        >
          {t('register.signIn')}
        </Link>
      </p>
    </AuthLayout>
  );
}
