import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Globe, Lock, Users } from 'lucide-react';

import { PageContainer, PageHeader } from '../../components/layout';
import {
  Button,
  Card,
  Input,
  Badge,
  ErrorState,
  FormSkeleton,
  Table,
  SearchInput,
  Select,
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
import { normalizeForSearch } from '../../lib/normalizeForSearch';

/** Match Customer Detail surfaces (CustomerDetailPage.jsx) */
const PAGE_BG = 'bg-neutral-50 dark:bg-[#0a0a0a]';
const SURFACE =
  'rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-[#262626] dark:bg-[#171717]';
const TEXT_MUTED = 'text-neutral-500 dark:text-neutral-400';
const CARD_PAD = 'p-6';
const CARD_TITLE = 'text-lg font-bold text-neutral-900 dark:text-neutral-50';
/** Unified card header: icon + title + border-b (Customer Detail style) */
const CARD_HEADER =
  'flex items-center gap-3 pb-4 border-b border-neutral-200 dark:border-[#262626]';
const SECTION_DIVIDER = 'border-t border-neutral-200 dark:border-[#262626]';

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
  const sizeCls = size === 'lg' ? 'h-16 w-16 text-xl' : 'h-8 w-8 text-xs';

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className={cn('rounded-full object-cover shrink-0', sizeCls, className)}
      />
    );
  }

  return (
    <div
      className={cn(
        'rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center font-bold text-neutral-700 dark:text-neutral-200 shrink-0',
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

  const [directorySearch, setDirectorySearch] = useState('');
  const [directoryRoleFilter, setDirectoryRoleFilter] = useState('all');

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

  const breadcrumbs = [
    { label: t('common:nav.dashboard'), to: '/' },
    { label: t('profile:accountSettings.title') },
  ];

  const headerLabelClass =
    'text-[10px] uppercase tracking-widest font-bold text-neutral-500 dark:text-neutral-400';

  const roleFilterOptions = useMemo(
    () => [
      { value: 'all', label: t('profile:usersManagement.filterAllRoles') },
      { value: 'admin', label: t('common:roles.admin') },
      { value: 'accountant', label: t('common:roles.accountant') },
      { value: 'field_worker', label: t('common:roles.field_worker') },
    ],
    [t]
  );

  const filteredDirectoryProfiles = useMemo(() => {
    let list = directoryProfiles;
    if (directoryRoleFilter !== 'all') {
      list = list.filter((p) => p.role === directoryRoleFilter);
    }
    const q = normalizeForSearch(directorySearch.trim());
    if (q) {
      list = list.filter((p) => {
        const name = normalizeForSearch(p.full_name || '');
        const roleKey = getRoleLabel(p.role);
        const roleText = roleKey ? normalizeForSearch(t(roleKey)) : '';
        return name.includes(q) || roleText.includes(q);
      });
    }
    return list;
  }, [directoryProfiles, directoryRoleFilter, directorySearch, t]);

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
      <PageContainer maxWidth="4xl" padding="default" className={cn(PAGE_BG, 'space-y-4')}>
        <PageHeader title={t('profile:accountSettings.title')} breadcrumbs={breadcrumbs} />
        <ErrorState message={profileError.message} onRetry={refetchProfile} />
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="full" padding="default" className={cn(PAGE_BG, 'space-y-4 pb-12')}>
      <PageHeader
        title={t('profile:accountSettings.title')}
        description={t('profile:accountSettings.subtitle')}
        breadcrumbs={breadcrumbs}
        className="space-y-2"
      />

      <div
        className={cn(
          'mt-2 mx-auto w-full grid grid-cols-1 gap-6 lg:gap-8 lg:items-stretch',
          isAdmin ? 'max-w-7xl lg:grid-cols-12' : 'max-w-7xl'
        )}
      >
        {isAdmin && (
          <div className="col-span-12 lg:col-span-7 order-2 lg:order-1 min-w-0 flex flex-col">
            <Card className={cn(SURFACE, CARD_PAD, 'h-full flex flex-col min-h-0')}>
              <div className={CARD_HEADER}>
                <Users className={cn('w-5 h-5 shrink-0', TEXT_MUTED)} aria-hidden />
                <h2 className={CARD_TITLE}>{t('profile:usersManagement.title')}</h2>
              </div>
              <p className={cn('mt-1 mb-4 text-xs font-semibold uppercase tracking-wide', TEXT_MUTED)}>
                {t('profile:usersManagement.subtitle')}
              </p>

              {directoryError ? (
                <ErrorState
                  message={directoryError.message || t('profile:usersManagement.loadError')}
                  onRetry={() => refetchDirectory()}
                />
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                    <SearchInput
                      value={directorySearch}
                      onChange={setDirectorySearch}
                      placeholder={t('profile:usersManagement.searchPlaceholder')}
                      className="min-w-0 flex-1"
                    />
                    <div className="w-full sm:w-[11.5rem] shrink-0">
                      <Select
                        label={t('profile:usersManagement.filterRole')}
                        options={roleFilterOptions}
                        value={directoryRoleFilter}
                        onChange={(e) => setDirectoryRoleFilter(e.target.value)}
                        size="md"
                      />
                    </div>
                  </div>
                  <div
                    className={cn(
                      'flex-1 min-h-0 overflow-auto rounded-lg border border-neutral-200 dark:border-[#262626]',
                      'bg-neutral-50/50 dark:bg-[#141414]'
                    )}
                  >
                    <Table
                      columns={userColumns}
                      data={filteredDirectoryProfiles}
                      loading={directoryLoading}
                      keyExtractor={(row) => row.id}
                      emptyMessage={t('profile:usersManagement.empty')}
                    />
                  </div>
                </>
              )}
            </Card>
          </div>
        )}

        <div
          className={cn(
            'col-span-12 flex min-w-0 flex-col gap-6',
            isAdmin ? 'lg:col-span-5 order-1 lg:order-2' : 'lg:col-span-12'
          )}
        >
          <Card className={cn(SURFACE, CARD_PAD, 'flex flex-col gap-6')}>
            <div className={CARD_HEADER}>
              <Globe className={cn('w-5 h-5 shrink-0', TEXT_MUTED)} aria-hidden />
              <h2 className={CARD_TITLE}>{t('profile:accountCard.title')}</h2>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <ProfileAvatar
                name={displayName}
                avatarUrl={profile?.avatar_url}
                size="lg"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 gap-y-1">
                  <p className={cn(CARD_TITLE, 'truncate')}>{displayName}</p>
                  <span
                    className="inline-flex shrink-0 items-center gap-1.5"
                    title={t('profile:session.active')}
                  >
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success-500" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-success-600 dark:text-success-400">
                      {t('profile:session.active')}
                    </span>
                  </span>
                </div>
                <p className={cn('mt-0.5 truncate text-sm', TEXT_MUTED)}>{user?.email}</p>
                {profile?.role && (
                  <div className="mt-3">
                    <Badge variant={profileRoleBadgeVariant(profile.role)} size="sm" dot>
                      {t(getRoleLabel(profile.role))}
                    </Badge>
                  </div>
                )}
              </div>
            </div>

            <div className={cn(SECTION_DIVIDER, 'pt-6')}>
              <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
                <div>
                  <label className={cn('mb-2 block', headerLabelClass)} htmlFor="profile-full-name">
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
                  <label className={cn('mb-2 block', headerLabelClass)} htmlFor="profile-email">
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
                <div>
                  <label className={cn('mb-2 block', headerLabelClass)} htmlFor="profile-phone">
                    {t('profile:fields.phone')}
                  </label>
                  <Input
                    id="profile-phone"
                    placeholder={t('profile:placeholders.phone')}
                    error={profileForm.formState.errors.phone?.message}
                    {...profileForm.register('phone')}
                  />
                </div>
                <div className={cn('flex justify-end pt-5', SECTION_DIVIDER)}>
                  <Button type="submit" variant="primary" loading={updateProfileMutation.isPending}>
                    {t('profile:actions.save')}
                  </Button>
                </div>
              </form>
            </div>
          </Card>

          <Card className={cn(SURFACE, CARD_PAD, 'flex flex-col gap-5')}>
            <div>
              <div className={CARD_HEADER}>
                <Lock className={cn('w-5 h-5 shrink-0', TEXT_MUTED)} aria-hidden />
                <h2 className={CARD_TITLE}>{t('profile:securityCard.title')}</h2>
              </div>
              <p className={cn('mt-1 text-xs font-semibold uppercase tracking-wide', TEXT_MUTED)}>
                {t('profile:securityCard.subtitle')}
              </p>
            </div>
            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="flex flex-col gap-4">
              <PasswordInput
                label={t('profile:changePassword.currentPassword')}
                autoComplete="current-password"
                error={passwordForm.formState.errors.currentPassword?.message}
                {...passwordForm.register('currentPassword')}
              />
              <PasswordInput
                label={t('profile:changePassword.password')}
                autoComplete="new-password"
                error={passwordForm.formState.errors.password?.message}
                {...passwordForm.register('password')}
              />
              <PasswordStrength password={password} />
              <PasswordInput
                label={t('profile:changePassword.confirmPassword')}
                autoComplete="new-password"
                error={passwordForm.formState.errors.confirmPassword?.message}
                {...passwordForm.register('confirmPassword')}
              />
              <div
                className={cn(
                  'flex flex-col-reverse gap-3 pt-5 sm:flex-row sm:items-center sm:justify-end',
                  SECTION_DIVIDER
                )}
              >
                <Link
                  to="/forgot-password"
                  className="text-sm text-primary-600 dark:text-primary-400 hover:underline sm:mr-auto"
                >
                  {t('profile:changePassword.forgotLink')}
                </Link>
                <Button
                  type="submit"
                  variant="primary"
                  loading={passwordForm.formState.isSubmitting}
                >
                  {t('profile:actions.changePassword')}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
