# Auth Module

## Overview
The Auth module provides a complete identity management system using Supabase Auth. It handles user registration, secure login, password recovery, and email verification. The module also manages the global authentication state and provides protected routing for the application.

## Routes
- `/login` - User sign-in page
- `/register` - New user account creation
- `/forgot-password` - Password reset request page
- `/auth/update-password` - Secure page to set a new password (via email link)
- `/auth/verify-email` - Landing page for email confirmation links

## Pages

### LoginPage (`/login`)
**Purpose:** Authenticate existing users to access the ERP system.

**Features:**
- Email and password validation
- "Remember me" functionality (handled by Supabase)
- Redirect to intended destination after login
- Error mapping for localized feedback

**Key Components:**
- `AuthLayout` - Shared wrapper for all auth pages
- `PasswordInput` - Input field with show/hide toggle
- `Input` - Standardized email field

**API Calls:**
- `signIn(email, password)` - Authenticates with Supabase Auth

**User Flow:**
1. Enter email and password
2. Submit form
3. Redirect to Dashboard or previous protected route

**File:** `src/features/auth/LoginPage.jsx`

***

### RegisterPage (`/register`)
**Purpose:** Allow new staff members to create an account.

**Features:**
- Full name, email, and password collection
- Real-time password strength indicator
- Password confirmation validation
- Success state with instructions for email verification

**Key Components:**
- `PasswordStrength` - Visual feedback on password complexity
- `CheckCircle` (Icon) - Used in success state

**API Calls:**
- `signUp(email, password, metadata)` - Creates user and sends verification email

**User Flow:**
1. Enter registration details
2. Verify password strength
3. Submit and see success screen
4. Check email for confirmation link

**File:** `src/features/auth/RegisterPage.jsx`

***

### ForgotPasswordPage (`/forgot-password`)
**Purpose:** Initiate the password recovery process.

**Features:**
- Email-only form
- Success state to prevent email enumeration (generic success message)
- Quick link back to login

**API Calls:**
- `resetPassword(email)` - Triggers Supabase recovery email

**User Flow:**
1. Enter registered email
2. Receive recovery link via email
3. Click link to navigate to Update Password page

**File:** `src/features/auth/ForgotPasswordPage.jsx`

***

### UpdatePasswordPage (`/auth/update-password`)
**Purpose:** Securely set a new password after a recovery request.

**Features:**
- Recovery mode detection (listens for `PASSWORD_RECOVERY` event)
- Token expiration/invalidity handling
- Password strength validation
- Automatic redirection to login after success

**API Calls:**
- `updatePassword(newPassword)` - Updates the user's password in Supabase

**User Flow:**
1. Arrive from email link
2. System verifies recovery session
3. Enter and confirm new password
4. Redirect to login

**File:** `src/features/auth/UpdatePasswordPage.jsx`

***

### VerifyEmailPage (`/auth/verify-email`)
**Purpose:** Confirm user's email address and finalize account activation.

**Features:**
- Automated verification check on mount
- Real-time listener for `email_confirmed_at` changes
- Success/Error state handling with clear CTAs

**User Flow:**
1. Click link in verification email
2. Land on page; system verifies token
3. See success message and click "Continue to Login"

**File:** `src/features/auth/VerifyEmailPage.jsx`

***

## Components

### AuthLayout
**Purpose:** Centered, branded container for all authentication forms.
**Used in:** All Auth pages
**File:** `src/features/auth/components/AuthLayout.jsx`

### PasswordInput
**Purpose:** Text input with a toggle button to reveal/hide characters.
**Used in:** `LoginPage`, `RegisterPage`, `UpdatePasswordPage`
**File:** `src/features/auth/components/PasswordInput.jsx`

### PasswordStrength
**Purpose:** Visual bar and text indicating the complexity of the entered password.
**Used in:** `RegisterPage`, `UpdatePasswordPage`
**File:** `src/features/auth/components/PasswordStrength.jsx`

***

## API & Data

**API File:** `src/features/auth/api.js`

**Key Functions:**
- `signIn(email, password)` - Standard login
- `signUp(email, password, metadata)` - Registration with additional profile data
- `resetPassword(email)` - Triggers recovery email
- `updatePassword(newPassword)` - Updates password for current session
- `signOut()` - Clears Supabase session

**Global Hook:**
- `useAuth()` - The primary hook for all auth state. Provides `user`, `session`, `isAuthenticated`, and all auth methods.

**Database Tables:**
- `profiles` - Extended user data (managed via Supabase triggers on `auth.users`)

***

## Business Rules
1. **Protected Access:** All routes except auth pages require a valid session (enforced by `ProtectedRoute`).
2. **Email Verification:** Users must verify their email before certain actions (though basic login is allowed depending on Supabase config).
3. **Password Policy:** Minimum 8 characters required for all new passwords.
4. **Role Management:** User roles (admin, technician, etc.) are stored in the `profiles` table and checked for feature access.

***

## Technical Notes
- **Event Listeners:** Uses `onAuthStateChange` to react to global session events (login, logout, recovery).
- **Error Mapping:** Uses a custom `errorMapper.js` to translate Supabase technical errors into user-friendly i18n keys.
- **Session Persistence:** Supabase handles session persistence in localStorage automatically.
