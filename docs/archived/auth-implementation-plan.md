# Auth System Implementation Plan

> **Status:** Research & Planning
> **Created:** 2026-02-06
> **Project:** Ornet ERP - Work Order Management System

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Recommended Approach](#2-recommended-approach)
3. [Answers to Key Questions](#3-answers-to-key-questions)
4. [File Structure](#4-file-structure)
5. [Dependencies](#5-dependencies)
6. [Implementation Phases](#6-implementation-phases)
7. [Code Patterns & Snippets](#7-code-patterns--snippets)
8. [i18n Key Structure](#8-i18n-key-structure)
9. [Security Considerations](#9-security-considerations)
10. [Edge Cases & Error Handling](#10-edge-cases--error-handling)
11. [Potential Pitfalls](#11-potential-pitfalls)

---

## 1. Current State Analysis

### What Exists

| Component | Status | Notes |
|-----------|--------|-------|
| Supabase Client | ✅ Complete | Properly configured with env validation |
| useAuth Hook | ⚠️ Basic | Only provides `user`, `loading`, `signOut` |
| LoginPage | ⚠️ Basic | Uses plain inputs, no react-hook-form/zod |
| ProtectedRoute | ✅ Complete | Redirects to `/login`, preserves location |
| Auth Translations | ⚠️ Partial | Login + some errors, missing register/reset |
| Register Flow | ❌ Missing | Not implemented |
| Password Reset | ❌ Missing | Not implemented |
| Email Verification | ❌ Missing | Not implemented |

### What Needs Work

1. **LoginPage** → Upgrade to react-hook-form + zod (match project patterns)
2. **RegisterPage** → Create new
3. **ResetPasswordPage** → Create new (forgot password)
4. **UpdatePasswordPage** → Create new (after reset link clicked)
5. **useAuth Hook** → Extend with `signIn`, `signUp`, `resetPassword` methods
6. **Auth Translations** → Complete i18n coverage
7. **Email Verification UI** → Warning banner when unverified

---

## 2. Recommended Approach

### 2.1 Build Custom vs Use Supabase Auth UI

**Recommendation: Build Custom UI**

| Factor | @supabase/auth-ui-react | Custom UI |
|--------|-------------------------|-----------|
| Customization | Limited (CSS only) | Full control |
| i18n Support | Poor (English-centric) | Full Turkish support |
| Form Validation | Built-in, not configurable | react-hook-form + zod |
| Error Messages | Generic | Custom, translated |
| Design Match | Requires heavy override | Native to design system |
| Dependencies | Additional package | None (use existing) |
| Dark Mode | Partial support | Full (CSS variables) |

**Reasoning:**
- You already have Input, Button components with proper dark mode
- Your app uses react-hook-form + zod everywhere else
- Turkish translations need full control
- Supabase Auth UI i18n is limited and doesn't support Turkish well

### 2.2 Auth State Management

**Recommendation: Enhanced useAuth Hook (Context-based)**

| Approach | Pros | Cons | Fit for Project |
|----------|------|------|-----------------|
| Context + useReducer | Simple, built-in, no deps | Manual state management | ✅ Best fit |
| React Query | Caching, refetch logic | Overkill for auth | ❌ Overcomplicated |
| Zustand | Simple API, devtools | Another dependency | ❌ Not needed |

**Reasoning:**
- Auth state is simple (user or null)
- Session persistence is handled by Supabase client
- You already have a useAuth hook to extend
- No need for caching/refetching (Supabase handles this)

### 2.3 Protected Routes Pattern

**Recommendation: Route Wrapper Component (Current Approach)**

Your existing `ProtectedRoute.jsx` is already correct. Keep it.

```jsx
// Current pattern - already optimal for React Router v6
<Route element={<ProtectedRoute />}>
  <Route path="/" element={<AppLayout />}>
    {/* Protected routes */}
  </Route>
</Route>
```

**Why not alternatives:**
- HOC: Outdated pattern, harder to type
- Route loader: Doesn't integrate well with Supabase's async session

### 2.4 Multi-Tenant Approach

**Recommendation: Invite-Only with Org Pre-assigned (Phase 2)**

For initial implementation:
1. Admin creates user account manually in Supabase dashboard
2. User receives email, sets password
3. User is pre-assigned to org via `profiles.org_id`

Future enhancement:
1. Admin sends invite link with org_id embedded
2. User signs up via invite link
3. Org is auto-assigned during signup

**Why not self-signup with org creation:**
- Adds complexity (org creation UI, billing, etc.)
- Most work order systems are closed (employees only)
- Can be added later if needed

---

## 3. Answers to Key Questions

### Q1: Supabase Auth UI vs Custom?

**Answer: Custom UI**

Supabase Auth UI (`@supabase/auth-ui-react`) has these limitations:
- i18n only supports a few languages (no Turkish)
- Styling requires complex CSS overrides
- Form validation is not configurable
- Error messages are generic
- Doesn't use your existing Input/Button components

Your project already has excellent UI components. Building custom is the right choice.

### Q2: Auth State Management Approach?

**Answer: Enhanced Context-based Hook**

Extend your existing `useAuth.js` to include:
- `signIn(email, password)` method
- `signUp(email, password, metadata)` method
- `resetPassword(email)` method
- `updatePassword(newPassword)` method
- `error` state for auth errors

This keeps auth logic centralized and follows your current patterns.

### Q3: Protected Routes Pattern?

**Answer: Keep Current Route Wrapper**

Your `ProtectedRoute.jsx` is already well-implemented:
- Uses `useAuth()` hook
- Shows loading state
- Preserves intended location via `state`
- Handles dev mode (Supabase not configured)

No changes needed.

### Q4: Multi-Tenant Implications?

**Answer: Defer to Phase 2**

For now:
1. Create users in Supabase dashboard
2. Manually set `profiles.org_id`
3. RLS policies filter by org_id

Later (Phase 2):
1. Implement invite system
2. Add org selection/creation UI
3. Handle org-less users gracefully

This keeps initial auth implementation simple.

### Q5: Password Reset Flow?

**Answer: Supabase Magic Link + Custom Reset Page**

Flow:
1. User enters email on ForgotPasswordPage
2. Call `supabase.auth.resetPasswordForEmail(email, { redirectTo: URL })`
3. Supabase sends email with magic link
4. User clicks link → redirected to `/auth/update-password`
5. User enters new password
6. Call `supabase.auth.updateUser({ password })`

**Supabase Dashboard Config Required:**
- Site URL: `http://localhost:5173` (dev) / production URL
- Redirect URLs: Add `/auth/update-password`

---

## 4. File Structure

```
src/
├── features/
│   └── auth/
│       ├── index.js                    # Barrel exports
│       ├── api.js                      # Auth API functions
│       ├── schema.js                   # Zod validation schemas
│       ├── hooks.js                    # Auth-specific hooks
│       │
│       ├── LoginPage.jsx               # UPDATE (use form patterns)
│       ├── RegisterPage.jsx            # NEW
│       ├── ForgotPasswordPage.jsx      # NEW
│       ├── UpdatePasswordPage.jsx      # NEW (after reset link)
│       ├── VerifyEmailPage.jsx         # NEW (optional)
│       │
│       ├── components/
│       │   ├── AuthLayout.jsx          # NEW - shared auth page layout
│       │   ├── PasswordInput.jsx       # NEW - password with show/hide
│       │   ├── PasswordStrength.jsx    # NEW - strength indicator
│       │   └── EmailVerificationBanner.jsx  # NEW - warning banner
│       │
│       └── utils/
│           └── errorMapper.js          # NEW - Supabase error → i18n key
│
├── hooks/
│   └── useAuth.js                      # UPDATE - extend with auth methods
│
├── app/
│   ├── ProtectedRoute.jsx              # KEEP (no changes)
│   └── AuthRoute.jsx                   # NEW - redirect if already logged in
│
└── locales/
    └── tr/
        └── auth.json                   # UPDATE - complete translations
```

### New Routes in App.jsx

```jsx
// Public auth routes (redirect if logged in)
<Route element={<AuthRoute />}>
  <Route path="/login" element={<LoginPage />} />
  <Route path="/register" element={<RegisterPage />} />
  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
</Route>

// Special auth routes (no redirect)
<Route path="/auth/update-password" element={<UpdatePasswordPage />} />
<Route path="/auth/verify-email" element={<VerifyEmailPage />} />

// Protected routes (existing)
<Route element={<ProtectedRoute />}>
  <Route path="/" element={<AppLayout />}>
    {/* ... */}
  </Route>
</Route>
```

---

## 5. Dependencies

### Already Installed (No Changes)
- `@supabase/supabase-js` - Supabase client
- `react-hook-form` - Form management
- `@hookform/resolvers` - Zod integration
- `zod` - Schema validation
- `sonner` - Toast notifications
- `react-router-dom` - Routing
- `i18next` / `react-i18next` - Translations

### New Dependencies
**None required.** Your existing dependencies cover all auth needs.

### Optional Enhancement
```bash
# Password strength estimation (optional)
npm install zxcvbn
```
Only if you want sophisticated password strength checking (like "password123" = weak, "xK9#mP2$" = strong).

---

## 6. Implementation Phases

### Phase 1: Core Infrastructure (Day 1)

- [ ] Create `src/features/auth/schema.js` - validation schemas
- [ ] Create `src/features/auth/api.js` - auth API wrapper
- [ ] Create `src/features/auth/utils/errorMapper.js` - error translation
- [ ] Update `src/hooks/useAuth.js` - add auth methods
- [ ] Create `src/features/auth/components/AuthLayout.jsx`
- [ ] Create `src/features/auth/components/PasswordInput.jsx`

### Phase 2: Login Page Upgrade (Day 1-2)

- [ ] Rewrite `LoginPage.jsx` using react-hook-form + zod
- [ ] Add proper error handling with translated messages
- [ ] Add "Forgot Password" link
- [ ] Add loading states
- [ ] Test login flow end-to-end

### Phase 3: Registration Page (Day 2)

- [ ] Create `RegisterPage.jsx`
- [ ] Add password confirmation field
- [ ] Add password strength indicator (optional)
- [ ] Handle duplicate email error
- [ ] Add link to login page
- [ ] Test registration flow

### Phase 4: Password Reset Flow (Day 3)

- [ ] Create `ForgotPasswordPage.jsx`
- [ ] Create `UpdatePasswordPage.jsx`
- [ ] Configure Supabase redirect URLs
- [ ] Test reset email delivery
- [ ] Test password update flow

### Phase 5: Auth Route Guard (Day 3)

- [ ] Create `AuthRoute.jsx` - redirect if logged in
- [ ] Update App.jsx routes
- [ ] Test redirect behavior

### Phase 6: Email Verification (Day 4 - Optional)

- [ ] Create `EmailVerificationBanner.jsx`
- [ ] Create `VerifyEmailPage.jsx`
- [ ] Add resend verification email
- [ ] Show banner in AppLayout when unverified

### Phase 7: i18n Completion (Day 4)

- [ ] Complete `auth.json` translations
- [ ] Test all error messages
- [ ] Test all form labels/placeholders

### Phase 8: Polish & Testing (Day 5)

- [ ] Mobile responsive testing
- [ ] Dark mode testing
- [ ] Error state testing
- [ ] Loading state testing
- [ ] Edge case testing

---

## 7. Code Patterns & Snippets

### 7.1 Validation Schemas (`schema.js`)

```javascript
import { z } from 'zod';
import i18n from '@/lib/i18n';

// Reusable email schema
const emailSchema = z
  .string()
  .min(1, i18n.t('auth:validation.emailRequired'))
  .email(i18n.t('auth:validation.emailInvalid'));

// Reusable password schema
const passwordSchema = z
  .string()
  .min(1, i18n.t('auth:validation.passwordRequired'))
  .min(8, i18n.t('auth:validation.passwordMinLength'));

// Login form
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, i18n.t('auth:validation.passwordRequired')),
});

// Register form
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string().min(1, i18n.t('auth:validation.confirmPasswordRequired')),
  fullName: z.string().min(1, i18n.t('auth:validation.fullNameRequired')),
}).refine((data) => data.password === data.confirmPassword, {
  message: i18n.t('auth:validation.passwordsDoNotMatch'),
  path: ['confirmPassword'],
});

// Forgot password form
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

// Update password form
export const updatePasswordSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string().min(1, i18n.t('auth:validation.confirmPasswordRequired')),
}).refine((data) => data.password === data.confirmPassword, {
  message: i18n.t('auth:validation.passwordsDoNotMatch'),
  path: ['confirmPassword'],
});

// Default values
export const loginDefaultValues = { email: '', password: '' };
export const registerDefaultValues = { email: '', password: '', confirmPassword: '', fullName: '' };
export const forgotPasswordDefaultValues = { email: '' };
export const updatePasswordDefaultValues = { password: '', confirmPassword: '' };
```

### 7.2 Auth API Functions (`api.js`)

```javascript
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

/**
 * Sign in with email and password
 */
export async function signIn(email, password) {
  if (!isSupabaseConfigured) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

/**
 * Sign up with email and password
 */
export async function signUp(email, password, metadata = {}) {
  if (!isSupabaseConfigured) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata, // { full_name: '...' }
      emailRedirectTo: `${window.location.origin}/auth/verify-email`,
    },
  });

  if (error) throw error;
  return data;
}

/**
 * Send password reset email
 */
export async function resetPassword(email) {
  if (!isSupabaseConfigured) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/update-password`,
  });

  if (error) throw error;
}

/**
 * Update user's password (after reset link clicked)
 */
export async function updatePassword(newPassword) {
  if (!isSupabaseConfigured) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) throw error;
}

/**
 * Sign out
 */
export async function signOut() {
  if (!isSupabaseConfigured) return;

  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Resend verification email
 */
export async function resendVerificationEmail(email) {
  if (!isSupabaseConfigured) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/verify-email`,
    },
  });

  if (error) throw error;
}
```

### 7.3 Error Mapper (`utils/errorMapper.js`)

```javascript
/**
 * Map Supabase auth errors to i18n keys
 */
export function getAuthErrorKey(error) {
  if (!error) return null;

  const message = error.message?.toLowerCase() || '';
  const code = error.code || '';

  // Supabase error codes
  const errorMap = {
    // Sign in errors
    'invalid_credentials': 'auth:errors.invalidCredentials',
    'invalid login credentials': 'auth:errors.invalidCredentials',

    // Sign up errors
    'user already registered': 'auth:errors.emailAlreadyExists',
    'email already registered': 'auth:errors.emailAlreadyExists',
    'password should be at least': 'auth:errors.weakPassword',

    // Rate limiting
    'too many requests': 'auth:errors.tooManyRequests',
    'email rate limit exceeded': 'auth:errors.tooManyRequests',

    // Network
    'fetch failed': 'auth:errors.networkError',
    'network': 'auth:errors.networkError',

    // Session
    'session expired': 'auth:errors.sessionExpired',
    'refresh token': 'auth:errors.sessionExpired',

    // Email verification
    'email not confirmed': 'auth:errors.emailNotVerified',

    // Password reset
    'token expired': 'auth:errors.resetTokenExpired',
    'invalid token': 'auth:errors.resetTokenInvalid',

    // Generic
    'supabase_not_configured': 'auth:errors.supabaseNotConfigured',
  };

  // Check code first
  if (errorMap[code]) {
    return errorMap[code];
  }

  // Check message content
  for (const [key, value] of Object.entries(errorMap)) {
    if (message.includes(key)) {
      return value;
    }
  }

  // Default error
  return 'auth:errors.generic';
}
```

### 7.4 Enhanced useAuth Hook

```javascript
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import * as authApi from '@/features/auth/api';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize session
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Sign in
  const signIn = useCallback(async (email, password) => {
    setError(null);
    try {
      const data = await authApi.signIn(email, password);
      return data;
    } catch (err) {
      setError(err);
      throw err;
    }
  }, []);

  // Sign up
  const signUp = useCallback(async (email, password, metadata) => {
    setError(null);
    try {
      const data = await authApi.signUp(email, password, metadata);
      return data;
    } catch (err) {
      setError(err);
      throw err;
    }
  }, []);

  // Reset password
  const resetPassword = useCallback(async (email) => {
    setError(null);
    try {
      await authApi.resetPassword(email);
    } catch (err) {
      setError(err);
      throw err;
    }
  }, []);

  // Update password
  const updatePassword = useCallback(async (newPassword) => {
    setError(null);
    try {
      await authApi.updatePassword(newPassword);
    } catch (err) {
      setError(err);
      throw err;
    }
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    setError(null);
    try {
      await authApi.signOut();
    } catch (err) {
      setError(err);
      throw err;
    }
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Derived state
  const isAuthenticated = !!user;
  const isEmailVerified = user?.email_confirmed_at != null;

  return useMemo(() => ({
    user,
    session,
    loading,
    error,
    isAuthenticated,
    isEmailVerified,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    clearError,
  }), [
    user,
    session,
    loading,
    error,
    isAuthenticated,
    isEmailVerified,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    clearError,
  ]);
}
```

### 7.5 AuthLayout Component

```jsx
import { Link } from 'react-router-dom';

export function AuthLayout({ children, title, subtitle }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-[#0a0a0a] px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
              Ornet ERP
            </h1>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-[#171717] rounded-xl shadow-sm border border-neutral-200 dark:border-[#262626] p-8">
          {/* Header */}
          {(title || subtitle) && (
            <div className="text-center mb-6">
              {title && (
                <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                  {subtitle}
                </p>
              )}
            </div>
          )}

          {/* Content */}
          {children}
        </div>
      </div>
    </div>
  );
}
```

### 7.6 PasswordInput Component

```jsx
import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { IconButton } from '@/components/ui/IconButton';

export const PasswordInput = forwardRef(function PasswordInput(
  { label, error, ...props },
  ref
) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Input
      ref={ref}
      type={showPassword ? 'text' : 'password'}
      label={label}
      error={error}
      rightIcon={
        <IconButton
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowPassword(!showPassword)}
          tabIndex={-1}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? (
            <EyeOff className="w-4 h-4 text-neutral-500" />
          ) : (
            <Eye className="w-4 h-4 text-neutral-500" />
          )}
        </IconButton>
      }
      {...props}
    />
  );
});
```

### 7.7 LoginPage (Upgraded)

```jsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';

import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { AuthLayout } from './components/AuthLayout';
import { PasswordInput } from './components/PasswordInput';
import { loginSchema, loginDefaultValues } from './schema';
import { useAuth } from '@/hooks/useAuth';
import { getAuthErrorKey } from './utils/errorMapper';

export function LoginPage() {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();

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
      navigate(from, { replace: true });
    } catch (error) {
      const errorKey = getAuthErrorKey(error);
      toast.error(t(errorKey));
    }
  };

  return (
    <AuthLayout title={t('login.title')} subtitle={t('login.subtitle')}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label={t('login.email')}
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />

        <PasswordInput
          label={t('login.password')}
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />

        <div className="flex items-center justify-end">
          <Link
            to="/forgot-password"
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            {t('login.forgotPassword')}
          </Link>
        </div>

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

      {/* Optional: Link to register */}
      {/* <p className="mt-6 text-center text-sm text-neutral-600 dark:text-neutral-400">
        {t('login.noAccount')}{' '}
        <Link to="/register" className="text-blue-600 hover:text-blue-700">
          {t('login.createAccount')}
        </Link>
      </p> */}
    </AuthLayout>
  );
}
```

### 7.8 AuthRoute Component (Redirect if Logged In)

```jsx
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/Spinner';

/**
 * Wrapper for auth pages (login, register, etc.)
 * Redirects to dashboard if user is already logged in
 */
export function AuthRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  // If logged in, redirect to intended page or dashboard
  if (user) {
    const from = location.state?.from?.pathname || '/';
    return <Navigate to={from} replace />;
  }

  return <Outlet />;
}
```

---

## 8. i18n Key Structure

### Complete `auth.json`

```json
{
  "login": {
    "title": "Giriş Yap",
    "subtitle": "Hesabınıza giriş yapın",
    "email": "E-posta",
    "password": "Şifre",
    "submit": "Giriş Yap",
    "submitting": "Giriş yapılıyor...",
    "forgotPassword": "Şifremi unuttum",
    "noAccount": "Hesabınız yok mu?",
    "createAccount": "Kayıt ol"
  },

  "register": {
    "title": "Kayıt Ol",
    "subtitle": "Yeni hesap oluşturun",
    "fullName": "Ad Soyad",
    "email": "E-posta",
    "password": "Şifre",
    "confirmPassword": "Şifre Tekrar",
    "submit": "Kayıt Ol",
    "submitting": "Kayıt yapılıyor...",
    "hasAccount": "Zaten hesabınız var mı?",
    "signIn": "Giriş yap",
    "success": {
      "title": "Kayıt Başarılı",
      "message": "E-posta adresinize doğrulama linki gönderildi. Lütfen e-postanızı kontrol edin."
    }
  },

  "forgotPassword": {
    "title": "Şifremi Unuttum",
    "subtitle": "E-posta adresinizi girin, şifre sıfırlama linki göndereceğiz",
    "email": "E-posta",
    "submit": "Sıfırlama Linki Gönder",
    "submitting": "Gönderiliyor...",
    "backToLogin": "Giriş sayfasına dön",
    "success": {
      "title": "E-posta Gönderildi",
      "message": "Şifre sıfırlama linki e-posta adresinize gönderildi. Lütfen e-postanızı kontrol edin."
    }
  },

  "updatePassword": {
    "title": "Yeni Şifre Belirle",
    "subtitle": "Yeni şifrenizi girin",
    "password": "Yeni Şifre",
    "confirmPassword": "Yeni Şifre Tekrar",
    "submit": "Şifreyi Güncelle",
    "submitting": "Güncelleniyor...",
    "success": {
      "title": "Şifre Güncellendi",
      "message": "Şifreniz başarıyla güncellendi. Şimdi giriş yapabilirsiniz."
    }
  },

  "verifyEmail": {
    "title": "E-posta Doğrulama",
    "checking": "E-posta doğrulanıyor...",
    "success": {
      "title": "E-posta Doğrulandı",
      "message": "E-posta adresiniz başarıyla doğrulandı."
    },
    "error": {
      "title": "Doğrulama Başarısız",
      "message": "E-posta doğrulama linki geçersiz veya süresi dolmuş."
    },
    "continueToLogin": "Giriş sayfasına git"
  },

  "emailVerificationBanner": {
    "message": "E-posta adresiniz henüz doğrulanmadı.",
    "resend": "Doğrulama e-postasını tekrar gönder",
    "sending": "Gönderiliyor...",
    "sent": "E-posta gönderildi"
  },

  "logout": "Çıkış Yap",

  "validation": {
    "emailRequired": "E-posta adresi gerekli",
    "emailInvalid": "Geçerli bir e-posta adresi girin",
    "passwordRequired": "Şifre gerekli",
    "passwordMinLength": "Şifre en az 8 karakter olmalı",
    "confirmPasswordRequired": "Şifre tekrarı gerekli",
    "passwordsDoNotMatch": "Şifreler eşleşmiyor",
    "fullNameRequired": "Ad soyad gerekli"
  },

  "errors": {
    "invalidCredentials": "E-posta veya şifre hatalı",
    "emailAlreadyExists": "Bu e-posta adresi zaten kayıtlı",
    "emailNotFound": "Bu e-posta adresi ile kayıtlı hesap bulunamadı",
    "weakPassword": "Şifre çok zayıf. En az 8 karakter kullanın",
    "networkError": "Bağlantı hatası. İnternet bağlantınızı kontrol edin",
    "tooManyRequests": "Çok fazla deneme. Lütfen biraz bekleyin",
    "sessionExpired": "Oturum süresi doldu. Lütfen tekrar giriş yapın",
    "emailNotVerified": "E-posta adresiniz doğrulanmamış",
    "resetTokenExpired": "Şifre sıfırlama linki süresi dolmuş",
    "resetTokenInvalid": "Şifre sıfırlama linki geçersiz",
    "supabaseNotConfigured": "Sistem yapılandırması eksik",
    "generic": "Bir hata oluştu. Lütfen tekrar deneyin"
  },

  "passwordStrength": {
    "label": "Şifre Güçlüğü",
    "weak": "Zayıf",
    "fair": "Orta",
    "good": "İyi",
    "strong": "Güçlü"
  }
}
```

---

## 9. Security Considerations

### 9.1 Password Requirements

```javascript
// Recommended: Use Zod for validation
const passwordSchema = z
  .string()
  .min(8, 'En az 8 karakter')
  .regex(/[A-Z]/, 'En az 1 büyük harf') // Optional: add complexity
  .regex(/[0-9]/, 'En az 1 rakam');     // Optional: add complexity
```

**Recommendation:** Start with min 8 characters only. Add complexity rules if security requirements increase.

### 9.2 Rate Limiting

**Supabase Handles This:**
- Built-in rate limiting for auth endpoints
- Configurable in Supabase Dashboard → Auth → Rate Limits
- Default: 100 requests per hour per IP

**No additional code needed.**

### 9.3 CSRF Protection

**Supabase Handles This:**
- Uses secure, httpOnly cookies for session in server-side contexts
- Browser client uses localStorage (acceptable for SPAs)
- All auth endpoints have CSRF protection

**No additional code needed.**

### 9.4 Secure Redirect

```javascript
// Always validate redirect URLs
const ALLOWED_REDIRECTS = ['/', '/dashboard', '/settings'];

function getSafeRedirect(url) {
  // Only allow relative URLs from our allowed list
  if (url && url.startsWith('/') && ALLOWED_REDIRECTS.some(r => url.startsWith(r))) {
    return url;
  }
  return '/';
}

// Usage
const from = getSafeRedirect(location.state?.from?.pathname);
navigate(from, { replace: true });
```

### 9.5 Token Storage

**Supabase's Approach:**
- Session stored in localStorage by default
- Secure for SPAs (no server-side rendering)
- httpOnly cookies available for SSR apps

**For your SPA:** Default localStorage is fine. Supabase handles token refresh automatically.

### 9.6 Supabase Dashboard Configuration

Required settings in Supabase Dashboard → Authentication:

1. **Site URL:**
   - Development: `http://localhost:5173`
   - Production: Your production URL

2. **Redirect URLs:**
   - `http://localhost:5173/auth/update-password`
   - `http://localhost:5173/auth/verify-email`
   - (Production equivalents)

3. **Email Templates:**
   - Customize password reset email (Turkish content)
   - Customize verification email (Turkish content)

4. **Auth Providers:**
   - Email enabled
   - "Confirm email" can be toggled (recommended: ON for production)

---

## 10. Edge Cases & Error Handling

### 10.1 Edge Case Handling

| Edge Case | Solution |
|-----------|----------|
| User already logged in visits /login | AuthRoute redirects to dashboard |
| Session expires mid-use | onAuthStateChange detects, redirect to login |
| Email not verified | Show banner, allow limited access or block |
| Network error during auth | Show toast with retry suggestion |
| Concurrent sessions (multiple tabs) | Supabase syncs via onAuthStateChange |
| Password reset link expired | Show error, offer to resend |
| User closes browser mid-reset | Token still valid, can continue later |
| Rapid form submission | Disable button during submission |

### 10.2 Session Expiry Handling

```javascript
// In useAuth.js or a separate useSessionWatcher.js
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      if (event === 'SIGNED_OUT') {
        // Session expired or user signed out
        navigate('/login');
        toast.info(t('auth:errors.sessionExpired'));
      }

      if (event === 'TOKEN_REFRESHED') {
        // Token was refreshed successfully
        console.log('Session refreshed');
      }
    }
  );

  return () => subscription.unsubscribe();
}, []);
```

### 10.3 Email Verification Flow

```jsx
// In AppLayout.jsx - show banner if not verified
function AppLayout() {
  const { user, isEmailVerified } = useAuth();

  return (
    <div>
      {user && !isEmailVerified && (
        <EmailVerificationBanner email={user.email} />
      )}
      {/* ... rest of layout */}
    </div>
  );
}
```

---

## 11. Potential Pitfalls

### 11.1 Common Mistakes to Avoid

| Mistake | Why It's Bad | Solution |
|---------|--------------|----------|
| Storing password in state | Security risk | Never store, only send to API |
| Not handling auth errors | Poor UX | Map all Supabase errors to i18n keys |
| Hardcoded error messages | Breaks i18n | Always use translation keys |
| Not disabling submit during loading | Double submissions | Use `isSubmitting` from react-hook-form |
| Redirecting before session updates | Race condition | Wait for onAuthStateChange |
| Using `useEffect` for redirect | Flicker before redirect | Use loader or immediate check |
| Not validating redirect URL | Open redirect vulnerability | Whitelist allowed paths |
| Blocking unverified users entirely | Poor UX | Show warning, allow limited access |

### 11.2 Supabase-Specific Gotchas

| Gotcha | Description | Solution |
|--------|-------------|----------|
| Session not available immediately | `getSession()` is async | Show loading state |
| `onAuthStateChange` fires multiple times | Normal behavior | Handle all event types appropriately |
| Password reset requires redirect URL | Must be configured in dashboard | Add URLs to Supabase settings |
| Email templates default to English | Poor UX for Turkish users | Customize in Supabase dashboard |
| "Confirm email" blocks login | If enabled, unverified users can't login | Either disable or handle gracefully |

### 11.3 React Router Specific

| Issue | Description | Solution |
|-------|-------------|----------|
| `location.state` is undefined | Direct URL access | Default to '/' |
| Infinite redirect loop | AuthRoute and ProtectedRoute conflict | Ensure proper route nesting |
| Back button issues | After login, back goes to login again | Use `replace: true` in navigate |

### 11.4 Form Validation Gotchas

```javascript
// DON'T: Create schema inside component (recreates on every render)
function LoginPage() {
  const schema = z.object({ ... }); // BAD
}

// DO: Create schema outside component
const loginSchema = z.object({ ... }); // GOOD
function LoginPage() {
  // Use loginSchema
}
```

```javascript
// DON'T: Use t() in schema directly at module level (i18n not ready)
const schema = z.object({
  email: z.string().min(1, t('auth:validation.required')), // BAD - t not available
});

// DO: Use i18n.t() or create schema factory
import i18n from '@/lib/i18n';
const schema = z.object({
  email: z.string().min(1, i18n.t('auth:validation.required')), // GOOD
});
```

---

## Appendix A: Supabase Auth Events Reference

```javascript
supabase.auth.onAuthStateChange((event, session) => {
  switch (event) {
    case 'INITIAL_SESSION':
      // Fired when auth is initialized
      break;
    case 'SIGNED_IN':
      // User signed in
      break;
    case 'SIGNED_OUT':
      // User signed out
      break;
    case 'TOKEN_REFRESHED':
      // Access token was refreshed
      break;
    case 'USER_UPDATED':
      // User data was updated
      break;
    case 'PASSWORD_RECOVERY':
      // Password reset link was clicked
      break;
  }
});
```

---

## Appendix B: Testing Checklist

### Login Flow
- [ ] Valid credentials → login successful
- [ ] Invalid email format → validation error
- [ ] Wrong password → API error displayed
- [ ] Empty fields → validation errors
- [ ] Rate limited → appropriate message
- [ ] Network error → error toast
- [ ] Already logged in → redirect to dashboard

### Register Flow
- [ ] Valid data → account created
- [ ] Duplicate email → error message
- [ ] Weak password → validation error
- [ ] Password mismatch → validation error
- [ ] Verification email sent → success message

### Password Reset Flow
- [ ] Valid email → success message
- [ ] Unknown email → still shows success (security)
- [ ] Click reset link → lands on update page
- [ ] Set new password → success, redirect to login
- [ ] Expired link → error message
- [ ] Use reset link twice → error message

### Session Management
- [ ] Refresh page → stays logged in
- [ ] Multiple tabs → session syncs
- [ ] Session expires → redirect to login
- [ ] Logout → clears session, redirect to login

---

**End of Auth Implementation Plan**
