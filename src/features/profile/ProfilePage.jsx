import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Globe, Lock, Users, Save, KeyRound } from 'lucide-react';

import { PageContainer, PageHeader } from '../../components/layout';
import {
  Button,
  Input,
  Badge,
  ErrorState,
  FormSkeleton,
  Table,
} from '../../components/ui';
import { PasswordInput } from '../auth/components/PasswordInput';
import { PasswordStrength } from '../auth/components/PasswordStrength';
import { useAuth } from '../../hooks/useAuth';
import { useCurrentProfile } from '../subscriptions/hooks';
import { useUpdateProfile, useAdminProfilesDirectory } from './hooks';
import {
  profileSchema,
  profileDefaultValues,
  changePasswordSchema,
  changePasswordDefaultValues,
} from './schema';
import { getAuthErrorKey } from '../auth/utils/errorMapper';
import { cn } from '../../lib/utils';

const CARD =
  'rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-[#262626] dark:bg-[#171717] p-6';
const TEXT_MUTED = 'text-neutral-500 dark:text-neutral-400';
const CARD_TITLE = 'text-lg font-bold text-neutral-900 dark:text-neutral-50';
const CARD_HEADER =
  'flex items-center gap-3 pb-4 border-b border-neutral-200 dark:border-[#262626] mb-6';
const LABEL =
  'mb-2 block text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400';

function getRoleLabel(role) {
  return role ? `common:roles.${role}` : null;
}

function profileRoleBadgeVariant(role) {
  if (role === 'admin') return 'primary';
  if (role === 'accountant') return 'info';
  return 'default';
}

function ProfileAvatar({ name, avatarUrl, size = 'sm', className }) {
  const initial = name?.trim()?.charAt(0)?.toUpperCase() || '?';
  const sizeCls = size === 'lg' ? 'h-14 w-14 text-lg' : 'h-8 w-8 text-xs';

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className={cn(
          'rounded-full object-cover shrink-0 ring-2 ring-neutral-200 dark:ring-neutral-700',
          sizeCls,
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        'rounded-full bg-gradient-to-tr from-primary-500 to-primary-700 flex items-center justify-center font-bold text-white shrink-0 shadow-sm',
        sizeCls,
        className
      )}
    >
      {initial}
    </div>
  );
}

export function ProfilePage() {
  const { t } = useTranslation(['profile', 'auth', 'common']);
  const { user, changePassword } = useAuth();
  const { data: profile, isLoading: profileLoading, error: profileError, refetch: refetchProfile } =
    useCurrentProfile();
  const updateProfileMutation = useUpdateProfile();
  const isAdmin = profile?.role === 'admin';
  const {
    data: directoryProfiles = [],
    isLoading: directoryLoading,
    error: directoryError,
    refetch: refetchDirectory,
  } = useAdminProfilesDirectory(isAdmin);

  const profileForm = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: profileDefaultValues,
  });

  const passwordForm = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: changePasswordDefaultValues,
  });

  const password = useWatch({ control: passwordForm.control, name: 'password' });

  useEffect(() => {
    if (profile) {
      profileForm.reset({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
      });
    }
  }, [profile, profileForm]);

  const onProfileSubmit = async (data) => {
    if (!user?.id) return;
    try {
      await updateProfileMutation.mutateAsync({
        id: user.id,
        data: {
          full_name: data.full_name,
          phone: data.phone || null,
        },
      });
    } catch {
      // Error handled by mutation onError (toast)
    }
  };

  const onPasswordSubmit = async (data) => {
    try {
      await changePassword(data.currentPassword, data.password);
      toast.success(t('profile:changePassword.success'));
      passwordForm.reset(changePasswordDefaultValues);
    } catch (error) {
      const errorKey = getAuthErrorKey(error);
      toast.error(t(errorKey));
    }
  };

  const userColumns = useMemo(
    () => [
      {
        key: 'full_name',
        header: t('profile:usersManagement.columns.user'),
        headerClassName:
          'text-[10px] uppercase tracking-widest font-bold text-neutral-500 dark:text-neutral-400',
        cellClassName: '!whitespace-normal',
        render: (_, row) => (
          <div className="flex items-center gap-3">
            <ProfileAvatar name={row.full_name} avatarUrl={row.avatar_url} size="sm" />
            <span className="font-medium text-neutral-900 dark:text-neutral-50">
              {row.full_name || t('common:labels.unknown')}
            </span>
          </div>
        ),
      },
      {
        key: 'phone',
        header: t('profile:usersManagement.columns.phone'),
        headerClassName:
          'text-[10px] uppercase tracking-widest font-bold text-neutral-500 dark:text-neutral-400',
        cellClassName: '!whitespace-normal',
        render: (phone) => (
          <span className="text-sm text-neutral-700 dark:text-neutral-300">
            {phone || '—'}
          </span>
        ),
      },
      {
        key: 'role',
        header: t('profile:usersManagement.columns.role'),
        headerClassName:
          'text-[10px] uppercase tracking-widest font-bold text-neutral-500 dark:text-neutral-400',
        render: (role) => (
          <Badge
            variant={profileRoleBadgeVariant(role)}
            size="sm"
            className="uppercase tracking-tight border border-neutral-200/80 dark:border-neutral-600"
          >
            {role ? t(getRoleLabel(role)) : '—'}
          </Badge>
        ),
      },
    ],
    [t]
  );

  const displayName = profile?.full_name || user?.email?.split('@')[0] || '';

  if (profileLoading && !profile && !profileError) {
    return <FormSkeleton />;
  }

  if (profileError) {
    return (
      <PageContainer maxWidth="4xl" padding="default">
        <PageHeader title={t('profile:accountSettings.title')} />
        <ErrorState message={profileError.message} onRetry={refetchProfile} />
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="4xl" padding="default" className="space-y-6 pb-10">
      <PageHeader title={t('profile:accountSettings.title')} />

      {/* Hesap Bilgileri */}
      <section className={CARD}>
        <div className={CARD_HEADER}>
          <Globe className={cn('w-5 h-5 shrink-0', TEXT_MUTED)} aria-hidden />
          <h2 className={CARD_TITLE}>{t('profile:accountCard.title')}</h2>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <ProfileAvatar name={displayName} avatarUrl={profile?.avatar_url} size="lg" />
          <div className="flex-1 min-w-0">
            <p className={cn(CARD_TITLE, 'truncate')}>{displayName}</p>
            <p className={cn('mt-0.5 truncate text-sm', TEXT_MUTED)}>{user?.email}</p>
          </div>
          {profile?.role && (
            <Badge
              variant={profileRoleBadgeVariant(profile.role)}
              className="uppercase tracking-wider shrink-0"
            >
              {t(getRoleLabel(profile.role))}
            </Badge>
          )}
        </div>

        <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={LABEL} htmlFor="profile-full-name">
                {t('profile:fields.fullName')}
              </label>
              <Input
                id="profile-full-name"
                placeholder={t('profile:placeholders.fullName')}
                error={profileForm.formState.errors.full_name?.message}
                {...profileForm.register('full_name')}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="profile-phone">
                {t('profile:fields.phone')}
              </label>
              <Input
                id="profile-phone"
                placeholder={t('profile:placeholders.phone')}
                error={profileForm.formState.errors.phone?.message}
                {...profileForm.register('phone')}
              />
            </div>
          </div>

          <div>
            <label className={LABEL} htmlFor="profile-email">
              {t('profile:fields.email')}
            </label>
            <Input
              id="profile-email"
              type="email"
              value={user?.email || ''}
              disabled
              className="cursor-not-allowed bg-neutral-50 dark:bg-neutral-800/50"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className={cn('text-xs', TEXT_MUTED)}>
              {profileForm.formState.isDirty
                ? t('profile:accountCard.unsavedChanges')
                : t('profile:accountCard.upToDate')}
            </span>
            <Button
              type="submit"
              variant="primary"
              loading={updateProfileMutation.isPending}
              leftIcon={<Save className="w-4 h-4" />}
            >
              {t('profile:actions.save')}
            </Button>
          </div>
        </form>
      </section>

      {/* Güvenlik */}
      <section className={CARD}>
        <div className={CARD_HEADER}>
          <Lock className={cn('w-5 h-5 shrink-0', TEXT_MUTED)} aria-hidden />
          <h2 className={CARD_TITLE}>{t('profile:securityCard.title')}</h2>
        </div>

        <p className={cn('mb-6 text-xs font-semibold uppercase tracking-wide', TEXT_MUTED)}>
          {t('profile:securityCard.subtitle')}
        </p>

        <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PasswordInput
              label={t('profile:changePassword.currentPassword')}
              autoComplete="current-password"
              error={passwordForm.formState.errors.currentPassword?.message}
              {...passwordForm.register('currentPassword')}
            />
            <div className="hidden md:block" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PasswordInput
              label={t('profile:changePassword.password')}
              autoComplete="new-password"
              error={passwordForm.formState.errors.password?.message}
              {...passwordForm.register('password')}
            />
            <PasswordInput
              label={t('profile:changePassword.confirmPassword')}
              autoComplete="new-password"
              error={passwordForm.formState.errors.confirmPassword?.message}
              {...passwordForm.register('confirmPassword')}
            />
          </div>

          <PasswordStrength password={password} />

          <div className="flex flex-col-reverse items-center justify-between gap-3 pt-2 sm:flex-row">
            <Link
              to="/forgot-password"
              className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
            >
              {t('profile:changePassword.forgotLink')}
            </Link>
            <Button
              type="submit"
              variant="primary"
              loading={passwordForm.formState.isSubmitting}
              leftIcon={<KeyRound className="w-4 h-4" />}
              className="w-full sm:w-auto"
            >
              {t('profile:actions.changePassword')}
            </Button>
          </div>
        </form>
      </section>

      {/* Kullanıcı Yönetimi */}
      {isAdmin && (
        <section className={CARD}>
          <div className="mb-6 flex items-center justify-between border-b border-neutral-200 pb-4 dark:border-[#262626]">
            <div className="flex items-center gap-3">
              <Users className={cn('w-5 h-5 shrink-0', TEXT_MUTED)} aria-hidden />
              <h2 className={CARD_TITLE}>{t('profile:usersManagement.title')}</h2>
            </div>
            <Badge variant="secondary">
              {t('profile:usersManagement.totalCount', { count: directoryProfiles.length })}
            </Badge>
          </div>

          {directoryError ? (
            <ErrorState
              message={directoryError.message || t('profile:usersManagement.loadError')}
              onRetry={() => refetchDirectory()}
            />
          ) : (
            <Table
              columns={userColumns}
              data={directoryProfiles}
              loading={directoryLoading}
              keyExtractor={(row) => row.id}
              emptyMessage={t('profile:usersManagement.empty')}
            />
          )}
        </section>
      )}
    </PageContainer>
  );
}
