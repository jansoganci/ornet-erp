# TEST-SCENARIOS.md — Ornet ERP Pre-Launch Audit Test Coverage

> Generated: 2026-03-14  
> Purpose: Verify all fixes applied during the pre-launch security and quality audit.  
> Scope: RLS integrity, form validation, UI behaviour, import flows, and error handling.

---

## Summary Table

| Test ID | Type | Related Fix | Description | Status |
|---------|------|-------------|-------------|--------|
| RLS-01 | Automated | RLS policy | Anon key blocked from finance data | ✅ Done |
| RLS-02 | Automated | RLS policy | Technician role blocked from finance data | ✅ Done |
| RLS-03 | Automated | Accepted — Known Behavior | profiles allows all authenticated to read (for assignment dropdowns) | ✅ Done |
| PR-C3 | Automated | PR-C3 | TRY proposal saves unit_price_usd as null | ✅ Done |
| SB-C3 | Automated | SB-C3 | Pause skips only future months | ✅ Done |
| SB-C2 | Automated | SB-C2 | Payment recording returns subscription_id | ✅ Done |
| MA-C1-API | Automated | MA-C1 | Materials import rejects malformed body | ✅ Done |
| AUTH-01 | Automated | A-C3 | Password update layer documented | ✅ Done |
| TECH-BLOCK-01..06 | Automated | RLS | Technician blocked from finance, subscriptions, proposals, sim_cards, payment_methods | ✅ Done |
| TECH-ALLOW-01..04 | Automated | RLS | Technician can read profiles, customers, work_orders, get_daily_work_list | ✅ Done |
| MAN-01 | Manual | A-C1 | Email verification error state | Pending |
| MAN-02 | Manual | A-C2 | Password recovery on slow connection | Pending |
| MAN-03 | Manual | A-C3 | Password change requires current password | Pending |
| MAN-04 | Manual | AB-C1 | Action board hidden during profile load | Pending |
| MAN-05 | Manual | SA-C1 | Bulk asset registration from list page | Pending |
| MAN-06 | Manual | TA-C1 | Single submit creates one task only | Pending |
| MAN-07 | Manual | WO-C1 | Work order update refreshes materials list | Pending |
| MAN-08 | Manual | CU-C2 | Deleted site disappears immediately | Pending |
| MAN-09 | Manual | NO-C1 | Notification badge updates after resolve | Pending |
| MAN-10 | Manual | DA-C1 | Dashboard fallback for missing customer name | Pending |
| MAN-11 | Manual | DA-C2 | Action board warning when queries fail | Pending |
| MAN-12 | Manual | WO-C2 | New work order preserves pre-filled site_id | Pending |
| MAN-13 | Manual | PR-C2 | PDF export shows error toast on failure | Pending |
| MAN-14 | Manual | SC-C1 | SIM import warns on failure, no redirect | Pending |
| MAN-15 | Manual | SC-C2 | Excel dates import with correct day values | Pending |
| MAN-16 | Manual | MA-C1 | Malformed Excel shows parse error toast | Pending |
| MAN-17 | Manual | WH-I1 | Workers column populated in work history | Pending |
| MAN-18 | Manual | SB-C3 | Pause keeps current month payment status | Pending |
| MAN-19 | Manual | 6C | Invalid date format triggers validation error | Pending |
| MAN-20 | Manual | 6D | Invalid IBAN triggers validation error | Pending |
| MAN-21 | Manual | 6A | Currency enum enforced by dropdown | Pending |
| MAN-22 | Manual | Tur-5 | Error toasts show Turkish, not raw errors | Pending |
| MAN-23 | Manual | notes-max | Subscription notes accepts 10 000 characters | Pending |
| MAN-24 | Manual | 6F | All 16 units available in materials dropdown | Pending |

---

## Environment Setup

Before running automated tests, export the following variables in your shell:

```bash
export SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
export ANON_KEY="eyJ..."          # Project anon/public key
export SERVICE_KEY="eyJ..."       # Project service_role key (admin)
export USER_JWT="eyJ..."          # JWT of a regular logged-in user
export TECH_JWT="eyJ..."          # JWT of a user with role = 'field_worker' (run ./scripts/setup-technician.sh)
export SUBSCRIPTION_ID="uuid"     # A known subscription UUID for SB tests
export PROPOSAL_ID="uuid"         # A known proposal UUID for PR tests
```

---

# Section 1 — Automated Tests (curl)

## Quick Reference

| ID | Method | Endpoint | Auth | Expected Status |
|----|--------|----------|------|-----------------|
| RLS-01 | GET | `/rest/v1/financial_transactions` | Anon key, no JWT | 200 `[]` or 401 |
| RLS-02 | GET | `/rest/v1/financial_transactions` | Technician JWT | 200 `[]` |
| RLS-03 | GET | `/rest/v1/profiles` | Regular user JWT | 200, all profiles (accepted) |
| PR-C3 | POST | `/rest/v1/proposal_items` | Admin JWT | 201, `unit_price_usd = null` |
| SB-C3 | GET | `/rest/v1/subscription_payments` | Admin JWT | 200, current month ≠ skipped |
| SB-C2 | POST | `/rest/v1/rpc/fn_record_payment` | Admin JWT | 200, has `subscription_id` |
| MA-C1-API | POST | `/rest/v1/materials` | Admin JWT | 400 or 422 |
| AUTH-01 | POST | `/auth/v1/user` | User JWT | Documented — see notes |

---

### RLS-01 — Anon key cannot read finance data without auth

**Verifies:** Row-Level Security blocks unauthenticated access to `financial_transactions`.

```bash
curl -s -X GET \
  "$SUPABASE_URL/rest/v1/financial_transactions?select=id&limit=5" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  | jq .
```

**Expected HTTP status:** `200`  
**Expected body:** `[]` (empty array — RLS filters all rows for unauthenticated requests)

> **Note:** If the policy is misconfigured and returns data, RLS is broken. A non-empty array is a **FAIL**.

**Pass criteria:** Response is `[]`.  
**Fail criteria:** Response contains any transaction rows.

---

### RLS-02 — Technician role cannot read finance data

**Verifies:** Users with `role = 'technician'` are blocked from `financial_transactions` by RLS.

```bash
curl -s -X GET \
  "$SUPABASE_URL/rest/v1/financial_transactions?select=id&limit=5" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $TECH_JWT" \
  -H "Content-Type: application/json" \
  | jq .
```

**Expected HTTP status:** `200`  
**Expected body:** `[]`

**Pass criteria:** Response is `[]`.  
**Fail criteria:** Technician user can read financial data.

---

### RLS-03 — Profiles table (Accepted — Known Behavior)

**Status:** Accepted — Known Behavior

**Verifies:** Current `profiles` RLS policy behavior.

The `profiles` table intentionally allows **all authenticated users** to read **all profiles** (`USING (true)`). This is required for work order assignment dropdowns, task assignee selectors, and similar UI components where users need to pick from the full team list. Technicians (field_workers) do not have write access to profiles — they can only update their own profile via `profiles_update_own`.

**Expected:** `GET /rest/v1/profiles` returns all profiles (≥1 row) for any authenticated user.

**Pass criteria:** Test documents current behavior; no change required.  
**Fail criteria:** N/A — this is accepted design.

---

### PR-C3 — TRY proposal item saves unit_price_usd as null

**Verifies:** When `currency = 'TRY'`, the `_usd` cost fields are stored as `null` in the database.

> ⚠️ **PRECONDITION:** A proposal with `currency = 'TRY'` must exist. Replace `$PROPOSAL_ID` with a valid UUID.

```bash
curl -s -X POST \
  "$SUPABASE_URL/rest/v1/proposal_items" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "proposal_id": "'"$PROPOSAL_ID"'",
    "description": "Test kalemi",
    "quantity": 1,
    "unit": "adet",
    "unit_price": 500,
    "unit_price_usd": null,
    "cost_usd": null
  }' \
  | jq '.[0] | {unit_price, unit_price_usd, cost_usd}'
```

**Expected HTTP status:** `201`  
**Expected fields:**
```json
{
  "unit_price": 500,
  "unit_price_usd": null,
  "cost_usd": null
}
```

**Pass criteria:** `unit_price_usd` and `cost_usd` are `null`.  
**Fail criteria:** USD fields contain numeric values for a TRY proposal.

---

### SB-C3 — Pause only skips future months, not current

**Verifies:** After pausing a subscription, the current month's payment row remains with its original status and is NOT set to `'skipped'`.

> ⚠️ **PRECONDITION:** `$SUBSCRIPTION_ID` must be an active subscription with a payment row for the current month.

```bash
# Step 1: Pause the subscription via the RPC
curl -s -X POST \
  "$SUPABASE_URL/rest/v1/rpc/fn_pause_subscription" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"p_subscription_id": "'"$SUBSCRIPTION_ID"'"}' \
  | jq .

# Step 2: Get this month's payment row
CURRENT_MONTH=$(date +%Y-%m-01)
curl -s -X GET \
  "$SUPABASE_URL/rest/v1/subscription_payments?subscription_id=eq.$SUBSCRIPTION_ID&payment_month=gte.$CURRENT_MONTH&select=id,status,payment_month" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  | jq '.[0] | {status, payment_month}'
```

**Expected — Step 2 status:** `"pending"` or `"paid"` (NOT `"skipped"`)

**Pass criteria:** Current month payment `status` ≠ `"skipped"`.  
**Fail criteria:** Current month payment was set to `"skipped"` by the pause operation.

---

### SB-C2 — Payment recording returns subscription_id

**Verifies:** The `fn_record_payment` RPC returns a row that includes `subscription_id`, confirming React Query can invalidate the correct cache key.

> ⚠️ **PRECONDITION:** A pending payment row must exist for the target subscription. The RPC takes `p_payment_id` (not `p_subscription_id`). Fetch a pending payment first.

```bash
# 1. Get user ID and a pending payment
user_res=$(curl -s -X GET "$SUPABASE_URL/auth/v1/user" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $USER_JWT")
USER_ID=$(echo "$user_res" | jq -r '.id')

pay_res=$(curl -s -X GET \
  "$SUPABASE_URL/rest/v1/subscription_payments?subscription_id=eq.$SUBSCRIPTION_ID&status=eq.pending&select=id&order=payment_month.asc&limit=1" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $USER_JWT")
PAYMENT_ID=$(echo "$pay_res" | jq -r '.[0].id')

# 2. Record payment (RPC returns SETOF = array)
PAYMENT_DATE=$(date +%Y-%m-%d)
curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/fn_record_payment" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "p_payment_id": "'"$PAYMENT_ID"'",
    "p_payment_date": "'"$PAYMENT_DATE"'",
    "p_payment_method": "cash",
    "p_should_invoice": false,
    "p_vat_rate": 0,
    "p_invoice_no": null,
    "p_invoice_type": null,
    "p_notes": null,
    "p_reference_no": null,
    "p_user_id": "'"$USER_ID"'"
  }' | jq '.[0] | {subscription_id, status}'
```

**Expected HTTP status:** `200`  
**Expected fields:** `subscription_id` (UUID), `status` (`"paid"`). RPC returns array; use `.[0]` to get the row.

**Pass criteria:** Response contains `subscription_id` as a non-null UUID string.  
**Fail criteria:** `subscription_id` is absent or null. Requires admin/accountant role.

---

### MA-C1-API — Materials import rejects malformed body

**Verifies:** The import endpoint does not silently accept an empty or corrupted request body.

```bash
# Test with empty body
curl -s -o /dev/null -w "%{http_code}" -X POST \
  "$SUPABASE_URL/rest/v1/materials" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected HTTP status:** `400` or `422`

```bash
# Test with missing required fields
curl -s -X POST \
  "$SUPABASE_URL/rest/v1/materials" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"unit": "adet"}' \
  | jq '{code: .code, message: .message}'
```

**Expected body:** An error object with a `code` or `message` field (not an empty success).

**Pass criteria:** Non-2xx status or error body with a meaningful message.  
**Fail criteria:** `201` returned with an empty or default row.

---

### AUTH-01 — Password update requires re-authentication

**Verifies:** The application enforces current password verification before allowing a password change.

> **Note:** Supabase's `/auth/v1/user` endpoint accepts a new password with only a valid JWT — it does **not** natively require the old password. The re-authentication check (`signInWithPassword` using the current password) is enforced entirely in the **application layer** (`features/profile/ProfilePage.jsx`). This test documents the Supabase layer behaviour and confirms the app-layer guard is in place.

```bash
# Supabase layer — accepts new password with a valid JWT alone (expected behaviour)
curl -s -X PUT \
  "$SUPABASE_URL/auth/v1/user" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"password": "newPassword123!"}' \
  | jq '{id: .id, email: .email}'
```

**Expected HTTP status from Supabase:** `200` (Supabase does not enforce old-password check)

**Application-layer guard:** The UI calls `supabase.auth.signInWithPassword({ email, password: currentPassword })` before calling `updateUser`. If this step fails, the password change is aborted and the user sees an error. **This is the actual enforcement point.**

**Pass criteria (application layer):**
1. Submitting the change-password form without a current password shows a validation error.
2. Entering a wrong current password shows "Mevcut şifre hatalı" (or equivalent) toast.
3. Entering the correct current password allows the change.

**Fail criteria:** The form submits a new password without calling `signInWithPassword` first.

---

# Section 3 — Technician Role Tests

> **Purpose:** Verify that users with `role = 'field_worker'` (technicians) are correctly restricted from sensitive data and can access work-related data.  
> **Requires:** `TECH_JWT` — JWT of a user with `role = 'field_worker'`. Use `./scripts/setup-technician.sh` to create one.

## Technician Capabilities (from codebase)

| Area | Technician (field_worker) | Admin/Accountant |
|------|---------------------------|-------------------|
| **BLOCKED** | financial_transactions, subscriptions, subscription_payments, proposals, sim_cards, payment_methods | Full access |
| **ALLOWED** | profiles, customers, customer_sites, work_orders (assigned only), tasks (assigned only), get_daily_work_list | Full access |
| **exchange_rates** | Read allowed (er_select uses `true`) | Full access |

RLS policies use `get_my_role() IN ('admin', 'accountant')` to restrict sensitive tables. Technicians see only work orders and tasks they are assigned to.

---

## Quick Reference

| ID | Type | Endpoint | Expected |
|----|------|----------|----------|
| TECH-BLOCK-01 | GET | `/rest/v1/financial_transactions` | 200 `[]` |
| TECH-BLOCK-02 | GET | `/rest/v1/subscriptions` | 200 `[]` |
| TECH-BLOCK-03 | GET | `/rest/v1/subscription_payments` | 200 `[]` |
| TECH-BLOCK-04 | GET | `/rest/v1/proposals` | 200 `[]` |
| TECH-BLOCK-05 | GET | `/rest/v1/sim_cards` | 200 `[]` |
| TECH-BLOCK-06 | GET | `/rest/v1/payment_methods` | 200 `[]` |
| TECH-ALLOW-01 | GET | `/rest/v1/profiles` | 200, ≥1 row |
| TECH-ALLOW-02 | GET | `/rest/v1/customers` | 200 |
| TECH-ALLOW-03 | GET | `/rest/v1/work_orders` | 200 (assigned only) |
| TECH-ALLOW-04 | POST | `/rest/v1/rpc/get_daily_work_list` | 200, array |

---

### TECH-BLOCK-01 through TECH-BLOCK-06 — Technician blocked from sensitive tables

**Verifies:** RLS returns `[]` for technician JWT on finance, subscriptions, proposals, sim_cards, payment_methods.

```bash
# Example: financial_transactions
curl -s -X GET \
  "$SUPABASE_URL/rest/v1/financial_transactions?select=id&limit=5" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $TECH_JWT" \
  -H "Content-Type: application/json" \
  | jq .
```

**Expected:** `[]` for each table.  
**Pass criteria:** Response is empty array.  
**Fail criteria:** Any rows returned.

---

### TECH-ALLOW-01 — Technician can read profiles

**Verifies:** All authenticated users can read profiles (for assignment dropdowns).

```bash
curl -s -X GET \
  "$SUPABASE_URL/rest/v1/profiles?select=id,full_name,role&limit=10" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $TECH_JWT" \
  -H "Content-Type: application/json" \
  | jq 'length'
```

**Expected:** ≥1 row.  
**Pass criteria:** At least one profile (technician's own).  
**Fail criteria:** 403 or empty when profiles exist.

---

### TECH-ALLOW-02 — Technician can read customers

**Verifies:** All authenticated users can read customers.

```bash
curl -s -o /dev/null -w "%{http_code}" -X GET \
  "$SUPABASE_URL/rest/v1/customers?select=id&limit=5" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $TECH_JWT" \
  -H "Content-Type: application/json"
```

**Expected:** HTTP 200.  
**Pass criteria:** 200.  
**Fail criteria:** 403.

---

### TECH-ALLOW-03 — Technician can read work_orders (assigned only)

**Verifies:** Technician can query work_orders; RLS filters to rows where `assigned_to` or `created_by` matches.

```bash
curl -s -X GET \
  "$SUPABASE_URL/rest/v1/work_orders?select=id&limit=5" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $TECH_JWT" \
  -H "Content-Type: application/json" \
  | jq .
```

**Expected:** HTTP 200. Body may be `[]` if no work orders assigned.  
**Pass criteria:** 200 (request allowed).  
**Fail criteria:** 403.

---

### TECH-ALLOW-04 — Technician can call get_daily_work_list

**Verifies:** RPC returns array (filtered to technician's own work for the date).

```bash
TODAY=$(date +%Y-%m-%d)
curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/get_daily_work_list" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $TECH_JWT" \
  -H "Content-Type: application/json" \
  -d "{\"target_date\": \"$TODAY\"}" \
  | jq 'type'
```

**Expected:** `"array"`.  
**Pass criteria:** Valid JSON array (may be empty).  
**Fail criteria:** Error object or 403.

---

**Troubleshooting:** If TECH-BLOCK-03 or TECH-BLOCK-04 fail, apply migration `00133_fix_subscription_payments_proposals_rls.sql` (drops all SELECT policies and recreates restrictive ones). Ensure the technician user has `role = 'field_worker'` (run `./scripts/setup-technician.sh`).

---

# Section 2 — Manual Test Scenarios

> **Instructions for testers:**
> - Use the staging/development environment, not production.
> - Record pass/fail in a shared spreadsheet with date and tester name.
> - For tests marked ⚠️ PRECONDITION, prepare the required data before starting.

---

### MAN-01 — Email verification shows error when not confirmed

**Related fix:** A-C1  
**What is verified:** The login flow shows an error state instead of hanging when an email address has not been verified.

⚠️ **PRECONDITION:** A registered account that has **not** clicked the verification link.

**Steps:**
1. Navigate to `/login`.
2. Enter the credentials of the unverified account.
3. Click **Giriş Yap**.
4. Observe the result.

**Expected result:** An error message is displayed (e.g., "E-posta adresinizi doğrulamanız gerekiyor"). The user is **not** logged in and **not** stuck on a blank/loading screen.

**Pass criteria:** Clear Turkish error message visible within 3 seconds of clicking login.  
**Fail criteria:** Spinner runs indefinitely, blank screen, or user is partially logged in.

---

### MAN-02 — Password recovery works on slow connections

**Related fix:** A-C2  
**What is verified:** The forgot-password flow does not show a premature timeout error on slow networks.

⚠️ **PRECONDITION:** Chrome DevTools or a network throttling tool (e.g., Network Link Conditioner on macOS).

**Steps:**
1. Open Chrome DevTools → Network → set throttle to **Slow 3G**.
2. Navigate to `/forgot-password`.
3. Enter a valid registered email address.
4. Click **Şifremi Sıfırla**.
5. Wait up to 15 seconds.

**Expected result:** A success message appears ("Şifre sıfırlama bağlantısı gönderildi" or similar). No timeout error is shown during the wait.

**Pass criteria:** Success message appears without an error toast, even on slow connection.  
**Fail criteria:** An error toast saying "İstek zaman aşımına uğradı" or similar appears before the email is sent.

---

### MAN-03 — Password change requires current password

**Related fix:** A-C3  
**What is verified:** The profile password-change form refuses to submit without the current password.

**Steps:**
1. Log in as any user.
2. Navigate to `/profile`.
3. Scroll to the **Şifre Değiştir** section.
4. Leave the **Mevcut Şifre** field empty.
5. Fill in **Yeni Şifre** and **Şifre Tekrar** with a valid new password.
6. Click **Şifreyi Değiştir**.
7. Repeat steps 4–6 but this time enter an **incorrect** current password.

**Expected result:**
- Step 6: Form validation error on the **Mevcut Şifre** field.
- Step 7: Toast error "Mevcut şifre hatalı" (or equivalent). Password is NOT changed.

**Pass criteria:** Both cases block the submission with a clear error.  
**Fail criteria:** Password changes successfully without correct current password verification.

---

### MAN-04 — Action board hidden during profile load

**Related fix:** AB-C1  
**What is verified:** The Action Board link/page is not accessible before the user profile (and role) has loaded.

**Steps:**
1. Open the application in an incognito window with network throttled to **Slow 3G**.
2. Log in as an admin user.
3. Immediately after login redirect, observe the sidebar while the profile is still loading.
4. Attempt to navigate to `/action-board` via the address bar.

**Expected result:** During profile load, either a spinner/skeleton is shown in the sidebar (Action Board not yet visible), or the route renders a loading/access-restricted state. The Action Board content is **not** rendered until the role is confirmed as admin.

**Pass criteria:** Action Board content is not displayed during profile fetch.  
**Fail criteria:** Action Board content renders with admin data before role is confirmed.

---

### MAN-05 — Bulk asset registration from list page

**Related fix:** SA-C1  
**What is verified:** The Bulk Asset Registration modal can be opened from the site assets list and saves correctly.

⚠️ **PRECONDITION:** At least one customer with at least one site exists.

**Steps:**
1. Navigate to `/equipment`.
2. Click **Toplu Kayıt** (Bulk Register) button.
3. In the modal, select a customer from the dropdown.
4. Select a site from the site dropdown.
5. Add at least 2 assets using the form rows.
6. Click **Kaydet**.

**Expected result:** Modal closes, a success toast appears, and the new assets appear in the list without a page reload.

**Pass criteria:** Assets saved and visible in the list.  
**Fail criteria:** Modal closes but assets do not appear, or an error toast is shown.

---

### MAN-06 — Single submit creates one task only

**Related fix:** TA-C1  
**What is verified:** Clicking the submit button once on the task form creates exactly one task row.

**Implementation note:** `TaskModal` uses `loading={createMutation.isPending || updateMutation.isPending}` on the submit button. The Button component disables itself when `loading` is true, so re-clicks are blocked. Risk is low; verify under network throttle (Slow 3G) if needed.

⚠️ **PRECONDITION:** Access to Supabase Table Editor or a count query to verify row count.

**Steps:**
1. Navigate to `/tasks`.
2. Click **Yeni Görev** (New Task).
3. Fill in Title and any other required fields.
4. Click **Kaydet** once (do not double-click).
5. Check the tasks list for duplicates.
6. (Optional) Verify in Supabase that exactly 1 new row was inserted.
7. (Optional) Repeat with DevTools Network → Slow 3G to confirm no duplicate on slow connection.

**Expected result:** Exactly 1 task appears in the list matching what was entered.

**Pass criteria:** 1 task row created.  
**Fail criteria:** 2 or more identical task rows created from a single click.

---

### MAN-07 — Work order update refreshes materials list

**Related fix:** WO-C1  
**What is verified:** After saving an edit to a work order, the materials used section reflects the latest data without a manual page reload.

⚠️ **PRECONDITION:** A work order with at least one material line item.

**Steps:**
1. Open a work order detail page.
2. Note the current materials listed.
3. Click **Düzenle** (Edit).
4. Add or change a material line item.
5. Click **Kaydet**.
6. Observe the materials section on the detail page after save.

**Expected result:** The materials section updates automatically to show the new/changed item. No manual refresh required.

**Pass criteria:** Materials list updates within 2 seconds of save.  
**Fail criteria:** Old materials shown until page is manually refreshed.

---

### MAN-08 — Deleted site disappears immediately

**Related fix:** CU-C2  
**What is verified:** After deleting a customer site, it is removed from the customer detail page without a full page reload.

⚠️ **PRECONDITION:** A customer with at least 2 sites.

**Steps:**
1. Navigate to a customer detail page.
2. Locate the **Lokasyonlar** (Sites) tab.
3. Note the number of sites listed.
4. Delete one site (click delete button and confirm).
5. Observe the sites list.

**Expected result:** The deleted site is immediately removed from the list. The remaining sites are still shown. No page reload occurs.

**Pass criteria:** Site disappears from UI within 1 second of confirmation.  
**Fail criteria:** Deleted site still appears until manual refresh.

---

### MAN-09 — Notification badge updates after resolve

**Related fix:** NO-C1  
**What is verified:** Resolving a notification decreases the unread badge count in the header.

⚠️ **PRECONDITION:** At least 1 unread notification exists.

**Steps:**
1. Observe the notification bell icon in the header — note the badge number.
2. Click the bell to open the notification panel.
3. Click **Çözüldü** (Resolve) on one notification.
4. Observe the badge number after the action.

**Expected result:** The badge count decreases by 1. If it was 1, the badge disappears.

**Pass criteria:** Badge count decrements immediately.  
**Fail criteria:** Badge count stays the same after resolving.

---

### MAN-10 — Dashboard shows fallback for missing customer name

**Related fix:** DA-C1  
**What is verified:** When a work order has no associated customer (null customer_name), the dashboard shows "Bilinmiyor" instead of a blank or crashing.

⚠️ **PRECONDITION:** A work order exists with a null or missing customer reference. This may need to be inserted directly in the database for testing.

**Steps:**
1. Insert a work order row with `customer_name = null` (or remove the customer link).
2. Navigate to the Dashboard `/`.
3. Locate the recent work orders or metrics section where customer names appear.

**Expected result:** The customer name field shows "Bilinmiyor" (or an equivalent fallback label) — not blank, not "[object Object]", not a crash.

**Pass criteria:** "Bilinmiyor" text visible in place of missing customer name.  
**Fail criteria:** Blank cell, JavaScript error in console, or page crash.

---

### MAN-11 — Action board shows warning when queries fail

**Related fix:** DA-C2  
**What is verified:** When one or more data fetches fail on the Action Board, an amber warning indicator is shown rather than failing silently.

⚠️ **PRECONDITION:** Admin account. Ability to temporarily disconnect network after initial page load.

**Steps:**
1. Log in as admin and navigate to `/action-board`.
2. Confirm the page loads normally.
3. Open DevTools → Network → click **Offline** to simulate disconnection.
4. Trigger a data refresh (e.g., switch tabs and return, or wait for auto-refresh if implemented).

**Expected result:** An amber/yellow warning indicator or banner appears stating that some data could not be loaded. Existing data (if any) is still shown — the page does not go blank.

**Pass criteria:** Warning state visible to user.  
**Fail criteria:** Silent failure — page looks normal but shows stale/empty data with no warning.

---

### MAN-12 — New work order form keeps correct site_id

**Related fix:** WO-C2  
**What is verified:** When navigating to the new work order form with a pre-filled `site_id` (e.g., from a customer site detail page), the site selector stays correctly set and does not reset.

⚠️ **PRECONDITION:** At least one customer with at least one site.

**Steps:**
1. Navigate to a customer's site detail page.
2. Click **Yeni İş Emri Oluştur** (or equivalent action that pre-fills site_id).
3. On the new work order form, observe the **Lokasyon** (Site) field.
4. Do NOT change any field. Scroll through the form.

**Expected result:** The site field shows the correct pre-filled site throughout. It does not reset to blank or to a different site after a re-render.

**Pass criteria:** Site field retains the correct value from pre-fill.  
**Fail criteria:** Site field resets to empty or a different value mid-render.

---

### MAN-13 — PDF export shows error toast on failure

**Related fix:** PR-C2  
**What is verified:** If a proposal PDF fails to generate (e.g., due to missing required fields), a user-friendly error toast is shown instead of a hanging spinner.

**Implementation note:** `ProposalDetailPage.handleDownloadPdf` wraps the PDF generation in try/catch with `toast.error(t('pdf.exportError'))` on failure, and `finally` resets `isExporting` so the button returns to normal state. Translation key: `proposals:pdf.exportError` → "PDF oluşturulurken bir hata oluştu".

⚠️ **PRECONDITION:** A proposal that has at least one null or corrupt field (e.g., null `site_name`). May require manual DB manipulation.

**Steps:**
1. Navigate to a proposal detail page (`/proposals/:id`).
2. Click **PDF İndir** (Download PDF).
3. Observe the result if the proposal data is incomplete.

**Expected result:** If generation fails, a toast appears: "PDF oluşturulurken bir hata oluştu" (or equivalent). The export button returns to its normal state (not stuck in loading).

**Pass criteria:** Error toast appears, spinner stops.  
**Fail criteria:** Spinner runs indefinitely, page crashes, or no feedback is given.

---

### MAN-14 — SIM import warns on failure, does not navigate away

**Related fix:** SC-C1  
**What is verified:** When a SIM card bulk import fails (partially or fully), the user stays on the import page and sees a warning about potential partial saves.

**Steps:**
1. Navigate to `/sim-cards/import`.
2. Upload a valid Excel file.
3. Click **İçe Aktar** (Import).
4. To simulate failure: use an Excel with phone numbers that violate a DB unique constraint (duplicate numbers already in the system).

**Expected result:** An error/warning toast appears: "Bazı kayıtlar kaydedilmiş olabilir. Lütfen SIM kart listesini kontrol edin." The page does NOT redirect to the SIM cards list. The user can review and retry.

**Pass criteria:** Warning toast shown, user stays on import page.  
**Fail criteria:** Silent redirect to list page or no error feedback.

---

### MAN-15 — Excel dates import correctly in UTC+ timezone

**Related fix:** SC-C2  
**What is verified:** Dates parsed from Excel serial numbers match the expected calendar dates, with no off-by-one-day errors in UTC+ environments.

⚠️ **PRECONDITION:** A test Excel file with known date values (e.g., a row with date 2024-06-15 as an Excel serial number).

**Steps:**
1. Prepare an Excel file where column `activation_date` (or similar) contains the date **15 June 2024** (Excel serial ~45458).
2. Navigate to `/sim-cards/import`.
3. Upload the file and review the parsed preview data before confirming import.

**Expected result:** The parsed date shown in the preview is **2024-06-15**, not 2024-06-14.

**Pass criteria:** Displayed date matches the source Excel date exactly.  
**Fail criteria:** Date is one day earlier than the Excel source date.

---

### MAN-16 — Malformed Excel shows parse error toast

**Related fix:** MA-C1  
**What is verified:** Uploading a corrupted or wrong-format file to the materials import shows a clear error toast instead of a silent reset to the upload screen.

**Steps:**
1. Prepare a corrupted file: rename a `.png` or `.pdf` file to `.xlsx`.
2. Navigate to `/materials/import`.
3. Upload the corrupted file.

**Expected result:** A toast appears: "Dosya okunamadı. Lütfen Excel formatını kontrol edin." The user remains on the import page (not silently reset).

**Pass criteria:** Error toast with the expected message appears.  
**Fail criteria:** Page silently resets to the upload state with no feedback.

---

### MAN-17 — Workers column shows data in work history

**Related fix:** WH-I1  
**What is verified:** The Workers column in the work history table is populated with actual worker names, not blank.

⚠️ **PRECONDITION:** At least one work order in history that has `assigned_to` populated with worker names.

**Steps:**
1. Navigate to `/work-history`.
2. Search or browse to a work order known to have assigned workers.
3. Observe the **İşçiler** (Workers) column.

**Expected result:** Worker name(s) are displayed in the column.

**Pass criteria:** Worker names visible in the column.  
**Fail criteria:** Column is blank for all rows despite workers being assigned.

---

### MAN-18 — Subscription pause keeps current month payment

**Related fix:** SB-C3  
**What is verified:** Pausing a subscription mid-month does not change the current month's payment status to "skipped". Only future months are affected.

⚠️ **PRECONDITION:** An active subscription with a pending payment for the current month.

**Steps:**
1. Navigate to the subscription detail page for a target subscription.
2. Note the current month's payment status (should be "Bekliyor" / pending).
3. Click **Duraklat** (Pause) and confirm.
4. Navigate to the **Ödemeler** (Payments) tab.
5. Find the current month's payment row.

**Expected result:** Current month payment status is still "Bekliyor" (pending) or "Ödendi" (paid) — NOT "Atlandı" (skipped). Only payments in future months should be marked as skipped.

**Pass criteria:** Current month status unchanged by pause.  
**Fail criteria:** Current month payment was set to "Atlandı" by the pause action.

---

### MAN-19 — Form validation rejects invalid date format

**Related fix:** 6C (isoDateSchema)  
**What is verified:** Date fields with the `isoDateSchema` validator correctly reject non-ISO strings and display a validation error.

**Steps:**
1. Navigate to any form with a date field (e.g., **Yeni Abonelik** at `/subscriptions/new` — the `Başlangıç Tarihi` field).
2. Type `bugun` into the date field.
3. Click outside the field (blur) or attempt to submit.
4. Repeat with `15/06/2024` (wrong format).
5. Repeat with `2024-06-15` (correct format).

**Expected result:**
- Steps 2–3 and 4: Validation error shown — "Geçerli bir tarih giriniz (YYYY-AA-GG)".
- Step 5: No validation error.

**Pass criteria:** Only ISO-8601 dates (`YYYY-MM-DD`) are accepted.  
**Fail criteria:** Invalid date strings pass validation or no error is shown.

---

### MAN-20 — Form validation rejects invalid IBAN

**Related fix:** 6D (IBAN regex)  
**What is verified:** The IBAN field in the payment method form rejects non-Turkish or malformed IBANs.

**Steps:**
1. Navigate to a subscription and open **Ödeme Yöntemi Ekle** (Add Payment Method).
2. Select **Banka Havalesi** (Bank Transfer) as the method type.
3. In the **IBAN** field, type `ABC123`.
4. Attempt to submit.
5. Clear and type a valid Turkish IBAN: `TR330006100519786457841326`.
6. Attempt to submit.

**Expected result:**
- Step 4: Validation error — "Geçerli bir IBAN giriniz (TR ile başlayan 26 karakter)".
- Step 6: No IBAN validation error.

**Pass criteria:** Only `TR` + 24 digits accepted.  
**Fail criteria:** Invalid IBAN passes validation.

---

### MAN-21 — Currency field enforced by enum dropdown

**Related fix:** 6A (z.enum)  
**What is verified:** Currency fields only accept `TRY` or `USD`. This is enforced by the dropdown UI and the Zod schema.

> **Note:** This is a schema-level constraint enforced by the dropdown. Direct keyboard entry of an invalid currency (e.g., `EUR`) is not possible through the UI. This test verifies the dropdown does not offer other options.

**Steps:**
1. Navigate to **Yeni Abonelik** (`/subscriptions/new`).
2. Locate the **Para Birimi** (Currency) dropdown.
3. Open the dropdown and observe the available options.

**Expected result:** Only **TRY** and **USD** are listed. No EUR, GBP, or other currencies.

**Pass criteria:** Exactly 2 options visible: TRY and USD.  
**Fail criteria:** Other currency options present, or the field accepts free-text input.

---

### MAN-22 — Error toasts show Turkish messages, not raw Supabase errors

**Related fix:** Tur-5 (FS-RE1 through FS-RE4)  
**What is verified:** When a save operation fails, the toast shows a friendly Turkish message — not raw Supabase error text like `duplicate key value violates unique constraint`.

⚠️ **PRECONDITION:** Ability to trigger a save failure (e.g., submit a subscription form when the database is temporarily unreachable, or use DevTools to block the network request).

**Steps:**
1. Open **Yeni Abonelik** (`/subscriptions/new`) and fill in all required fields.
2. Open DevTools → Network → block the Supabase REST domain.
3. Click **Kaydet** (Save).
4. Observe the error toast message.

**Expected result:** Toast displays: "Kayıt başarısız oldu. Lütfen tekrar deneyin." (or equivalent Turkish message). No raw database error text is visible.

**Pass criteria:** Only the localised Turkish error message appears.  
**Fail criteria:** Raw Supabase error text (e.g., `"code": "23505"`, column names, constraint names) is shown to the user.

---

### MAN-23 — Subscription notes accepts up to 10 000 characters

**Related fix:** notes max length increased to 10 000  
**What is verified:** The `notes` and `setup_notes` fields on the subscription form accept long text up to 10 000 characters.

**Steps:**
1. Navigate to **Yeni Abonelik** (`/subscriptions/new`) or edit an existing subscription.
2. In the **Notlar** (Notes) field, paste a text string of exactly 10 000 characters.
   ```
   # Generate in browser console:
   # 'A'.repeat(10000)
   ```
3. Fill in all other required fields.
4. Click **Kaydet**.
5. Reopen the subscription and verify the notes field is intact.
6. Attempt to paste 10 001 characters and observe validation.

**Expected result:**
- Step 4: Save succeeds with 10 000 characters.
- Step 6: Validation error appears (or the field truncates) at 10 001 characters.

**Pass criteria:** 10 000 chars saves successfully; 10 001 chars shows an error.  
**Fail criteria:** Save fails at fewer than 10 000 characters, or 10 001+ chars saves without error.

---

### MAN-24 — All 16 units available in materials form

**Related fix:** 6F (unit enum expanded to 16 values)  
**What is verified:** The unit dropdown in the material creation form offers all 16 valid units for a security installation business.

**Steps:**
1. Navigate to `/materials` and click **Yeni Malzeme** (New Material).
2. Locate the **Birim** (Unit) dropdown.
3. Open the dropdown and count the available options.

**Expected result:** All 16 units are listed:

| Value | Açıklama |
|-------|----------|
| `adet` | Adet (quantity) |
| `boy` | Boy (piece/length) |
| `paket` | Paket (package) |
| `metre` | Metre — kablo |
| `mm` | Milimetre — lens, kanal |
| `V` | Volt |
| `A` | Amper |
| `W` | Watt |
| `MHz` | Megahertz |
| `TB` | Terabayt |
| `MP` | Megapiksel |
| `port` | Port (ağ) |
| `kanal` | Kanal (DVR/NVR) |
| `inç` | İnç (ekran) |
| `rpm` | RPM (disk hızı) |
| `bölge` | Bölge (alarm giriş) |

**Pass criteria:** All 16 options present in the dropdown.  
**Fail criteria:** Fewer than 16 options, or `'set'` still appears in the list.

---

## Appendix — Test Data Templates

### Generating a 10 000-character string (browser console)

```javascript
copy('A'.repeat(10000));
// Then paste into the notes field
```

### Sample valid Turkish IBAN

```
TR330006100519786457841326
```
(Format: `TR` + 2 check digits + 22 account digits = 26 characters total)

### Sample Excel serial date mapping

| Excel Serial | Expected Date |
|-------------|---------------|
| 45458 | 2024-06-15 |
| 44927 | 2023-01-01 |
| 45292 | 2024-01-01 |

### Valid ISO date examples for MAN-19

| Input | Expected Result |
|-------|----------------|
| `bugun` | Validation error |
| `15/06/2024` | Validation error |
| `2024-6-15` | Validation error |
| `2024-06-15` | Accepted |
| `2024-13-01` | **Known limitation:** Accepted by regex (13 matches `\d{2}`), but month 13 is invalid. Calendar validity is not checked at schema level. Document as limitation, not a pass case. |

---

*End of TEST-SCENARIOS.md*
