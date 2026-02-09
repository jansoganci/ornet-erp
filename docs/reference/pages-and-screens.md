# Ornet ERP — Sayfa ve Ekran Planlaması
# Page & Screen Planning

> MVP için gereken tüm sayfaların detaylı planlaması.
> Complete screen inventory for systematic implementation.

---

## Table of Contents

1. [Design Decisions](#1-design-decisions)
2. [User Roles & Access Matrix](#2-user-roles--access-matrix)
3. [Screen Inventory](#3-screen-inventory)
4. [Screen Details](#4-screen-details)
5. [Navigation Structure](#5-navigation-structure)
6. [Implementation Phases](#6-implementation-phases)
7. [i18n Requirements](#7-i18n-requirements)
8. [Mobile Considerations](#8-mobile-considerations)
9. [URL Structure](#9-url-structure)

---

## 1. Design Decisions

### Answered Questions

| Question | Decision | Rationale |
|----------|----------|-----------|
| Separate Service vs Installation screens? | **No** — Unified "Work Orders" with type filter | Simpler, less code duplication, same workflow |
| Calendar view? | **Phase 2** — Not MVP | Dashboard "today's schedule" covers immediate needs |
| Reports/Analytics? | **Phase 2** — Dashboard stats only for MVP | Adds complexity; basic stats sufficient initially |
| Offline mode? | **No** — Assume always online | Significant complexity; defer to Phase 3 if needed |
| Customer History? | **Yes** — Integrated in Customer Detail | Critical for field workers to see past work |
| User Management screens? | **Phase 2** — Use Supabase Dashboard for MVP | Admin can manage via Supabase Auth; custom UI later |
| Notifications? | **Phase 2** — Not MVP | Nice-to-have; focus on core workflows first |
| Mobile-specific screens? | **No** — Same screens, responsive design | Mobile-first CSS; one codebase for all devices |

### Core Principles

1. **One screen, one purpose** — Each screen solves a specific problem
2. **Progressive disclosure** — Show essential info first, details on demand
3. **Field-worker first** — Optimize for mobile, touch, outdoor use
4. **Minimal navigation** — Max 2 clicks to any action
5. **Turkish-first i18n** — All text from translation files

---

## 2. User Roles & Access Matrix

### Role Definitions

| Role | Turkish | Description | Primary Device |
|------|---------|-------------|----------------|
| `admin` | Yönetici | Owner/manager, full access | Desktop + Mobile |
| `field_worker` | Saha Ekibi | Technicians, assigned work only | Mobile (primary) |
| `accountant` | Muhasebe | Financial overview, read-mostly | Desktop |

### Access Matrix

| Screen | Admin | Field Worker | Accountant |
|--------|-------|--------------|------------|
| Dashboard | ✅ Full | ✅ Own stats | ✅ Financial stats |
| Customer List | ✅ Full | ✅ View + Add | ✅ View only |
| Customer Detail | ✅ Full | ✅ View + Edit | ✅ View only |
| Work Order List | ✅ All | ⚠️ Assigned only | ✅ All (read) |
| Work Order Detail | ✅ Full | ⚠️ Assigned only | ✅ View only |
| Work Order Form | ✅ Create/Edit | ✅ Create + Edit assigned | ❌ No access |
| Task List | ✅ All | ⚠️ Assigned only | ❌ No access |
| Profile | ✅ Own | ✅ Own | ✅ Own |

---

## 3. Screen Inventory

### Complete Screen List

| # | Screen (TR) | Screen (EN) | URL | Roles | Priority | Phase |
|---|-------------|-------------|-----|-------|----------|-------|
| **Authentication** |||||||
| 1 | Giriş | Login | `/login` | All | 🔴 Critical | MVP |
| 2 | Şifre Sıfırla | Password Reset | `/reset-password` | All | 🟡 High | MVP |
| **Main Screens** |||||||
| 3 | Ana Sayfa | Dashboard | `/` | All | 🔴 Critical | MVP |
| 4 | Müşteriler | Customers | `/customers` | All | 🔴 Critical | MVP |
| 5 | Müşteri Detay | Customer Detail | `/customers/:id` | All | 🔴 Critical | MVP |
| 6 | İş Emirleri | Work Orders | `/work-orders` | All | 🔴 Critical | MVP |
| 7 | İş Emri Detay | Work Order Detail | `/work-orders/:id` | All | 🔴 Critical | MVP |
| 8 | Yeni İş Emri | New Work Order | `/work-orders/new` | Admin, Field | 🔴 Critical | MVP |
| 9 | Yapılacaklar | Tasks | `/tasks` | Admin, Field | 🔴 Critical | MVP |
| 10 | Profil | Profile | `/profile` | All | 🟡 High | MVP |
| **Forms (Modals or Pages)** |||||||
| 11 | Müşteri Ekle | Add Customer | `/customers/new` | Admin, Field | 🔴 Critical | MVP |
| 12 | Müşteri Düzenle | Edit Customer | `/customers/:id/edit` | Admin, Field | 🟡 High | MVP |
| 13 | İş Emri Düzenle | Edit Work Order | `/work-orders/:id/edit` | Admin, Field | 🟡 High | MVP |
| 14 | Görev Ekle | Add Task | Modal | Admin, Field | 🟡 High | MVP |
| **Phase 2 Screens** |||||||
| 15 | Takvim | Calendar | `/calendar` | All | 🟢 Medium | Phase 2 |
| 16 | Raporlar | Reports | `/reports` | Admin, Accountant | 🟢 Medium | Phase 2 |
| 17 | Kullanıcılar | Users | `/users` | Admin | 🟢 Medium | Phase 2 |
| 18 | Ayarlar | Settings | `/settings` | Admin | 🟢 Medium | Phase 2 |
| 19 | Bildirimler | Notifications | `/notifications` | All | 🔵 Low | Phase 2 |

### Screen Count Summary

| Phase | Count | Status |
|-------|-------|--------|
| MVP (Phase 1) | 14 screens | To implement |
| Phase 2 | 5 screens | After MVP |
| **Total** | **19 screens** | |

---

## 4. Screen Details

### 4.1 Login Page (Giriş)

```
URL:        /login
Roles:      Public (unauthenticated)
Priority:   🔴 Critical
i18n NS:    auth
```

**Purpose:** Authenticate users to access the system.

**Features:**
- [ ] Email input field
- [ ] Password input field (with show/hide toggle)
- [ ] "Giriş Yap" (Login) button
- [ ] "Şifremi Unuttum" (Forgot Password) link
- [ ] Error message display
- [ ] Loading state during auth
- [ ] Redirect to Dashboard on success
- [ ] Remember last email (optional)

**UI Components:**
- Input (email, password)
- Button (primary)
- Alert (error)
- Spinner (loading)

**Wireframe:**
```
┌─────────────────────────────────┐
│         Ornet ERP Logo          │
├─────────────────────────────────┤
│                                 │
│  ┌───────────────────────────┐  │
│  │ E-posta                   │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │ Şifre                 👁  │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │        Giriş Yap          │  │
│  └───────────────────────────┘  │
│                                 │
│       Şifremi Unuttum           │
│                                 │
└─────────────────────────────────┘
```

---

### 4.2 Password Reset (Şifre Sıfırla)

```
URL:        /reset-password
Roles:      Public
Priority:   🟡 High
i18n NS:    auth
```

**Purpose:** Allow users to reset forgotten passwords.

**Features:**
- [ ] Email input field
- [ ] "Sıfırlama Linki Gönder" button
- [ ] Success message after submission
- [ ] Back to login link

**Flow:**
1. User enters email
2. Supabase sends reset email
3. User clicks link in email
4. Supabase handles password update

---

### 4.3 Dashboard (Ana Sayfa)

```
URL:        /
Roles:      All (authenticated)
Priority:   🔴 Critical
i18n NS:    dashboard
```

**Purpose:** Quick overview of today's work and pending items.

**Features by Role:**

| Feature | Admin | Field Worker | Accountant |
|---------|-------|--------------|------------|
| Today's work orders count | ✅ All | ✅ Assigned | ✅ All |
| Pending work orders count | ✅ All | ✅ Assigned | ✅ All |
| Open tasks count | ✅ All | ✅ Assigned | ❌ |
| Overdue tasks alert | ✅ All | ✅ Assigned | ❌ |
| Today's schedule list | ✅ All | ✅ Assigned | ❌ |
| Recent activity | ✅ | ❌ | ✅ |
| Quick action buttons | ✅ | ✅ | ❌ |

**UI Components:**
- StatCard (4 cards)
- Card (today's schedule)
- Button (quick actions)
- Badge (overdue indicator)
- EmptyState (no tasks)

**Wireframe:**
```
┌─────────────────────────────────────────────────────┐
│  Ana Sayfa                              [+] Ekle ▼  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐  │
│  │  Bugün   │ │ Bekleyen │ │  Açık    │ │ Gecik. │  │
│  │    3     │ │    12    │ │    5     │ │   2    │  │
│  │ iş emri  │ │ iş emri  │ │  görev   │ │ görev  │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘  │
│                                                     │
│  Bugünün Programı                                   │
│  ┌─────────────────────────────────────────────┐    │
│  │ 09:00  Ahmet Yılmaz - Servis    [Bekliyor]  │    │
│  │        Kadıköy, İstanbul                    │    │
│  ├─────────────────────────────────────────────┤    │
│  │ 11:00  Mehmet Kaya - Montaj    [Planlandı]  │    │
│  │        Üsküdar, İstanbul                    │    │
│  ├─────────────────────────────────────────────┤    │
│  │ 14:00  Ayşe Demir - Servis     [Planlandı]  │    │
│  │        Beşiktaş, İstanbul                   │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  Bekleyen Görevler                                  │
│  ┌─────────────────────────────────────────────┐    │
│  │ ○ Teklif hazırla - ABC Şirketi   [Bugün]    │    │
│  │ ○ Malzeme siparişi ver           [Yarın]    │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Data Sources:**
- `get_dashboard_stats()` — Stats cards
- `get_today_schedule()` — Today's work orders
- `get_my_pending_tasks(5)` — Top 5 pending tasks

---

### 4.4 Customer List (Müşteriler)

```
URL:        /customers
Roles:      All
Priority:   🔴 Critical
i18n NS:    customers
```

**Purpose:** Find and manage customers.

**Features:**
- [ ] Search by name or phone
- [ ] List of customers (cards on mobile, table on desktop)
- [ ] Click to view customer detail
- [ ] "Müşteri Ekle" (Add Customer) button
- [ ] Empty state when no customers
- [ ] Loading skeleton while fetching
- [ ] Pagination or infinite scroll

**UI Components:**
- SearchInput
- Card (customer card)
- Table (desktop)
- Button (add)
- EmptyState
- Skeleton
- Pagination

**Wireframe (Mobile):**
```
┌─────────────────────────────────┐
│  Müşteriler            [+ Ekle] │
├─────────────────────────────────┤
│  ┌─────────────────────────┐    │
│  │ 🔍 Ara...               │    │
│  └─────────────────────────┘    │
│                                 │
│  ┌─────────────────────────┐    │
│  │ Ahmet Yılmaz            │    │
│  │ 0555 123 4567      [→]  │    │
│  └─────────────────────────┘    │
│                                 │
│  ┌─────────────────────────┐    │
│  │ Mehmet Kaya             │    │
│  │ 0532 987 6543      [→]  │    │
│  └─────────────────────────┘    │
│                                 │
│  ┌─────────────────────────┐    │
│  │ ABC Şirketi             │    │
│  │ 0212 555 1234      [→]  │    │
│  └─────────────────────────┘    │
│                                 │
└─────────────────────────────────┘
```

**Wireframe (Desktop - Table):**
```
┌───────────────────────────────────────────────────────────────────┐
│  Müşteriler                                       [+ Müşteri Ekle]│
├───────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────┐                             │
│  │ 🔍 Müşteri ara...                │                             │
│  └──────────────────────────────────┘                             │
│                                                                   │
│  ┌────────────────┬──────────────┬──────────────┬───────────────┐ │
│  │ Müşteri Adı    │ Telefon      │ E-posta      │ Şehir         │ │
│  ├────────────────┼──────────────┼──────────────┼───────────────┤ │
│  │ Ahmet Yılmaz   │ 0555 123 45  │ ahmet@...    │ İstanbul      │ │
│  │ Mehmet Kaya    │ 0532 987 65  │ mehmet@...   │ İstanbul      │ │
│  │ ABC Şirketi    │ 0212 555 12  │ info@abc...  │ Ankara        │ │
│  └────────────────┴──────────────┴──────────────┴───────────────┘ │
│                                                                   │
│                          < 1 2 3 ... 10 >                         │
└───────────────────────────────────────────────────────────────────┘
```

---

### 4.5 Customer Detail (Müşteri Detay)

```
URL:        /customers/:id
Roles:      All
Priority:   🔴 Critical
i18n NS:    customers
```

**Purpose:** View customer info and work history.

**Features:**
- [ ] Customer info card (name, phone, email, address)
- [ ] Quick action: Call phone (mobile)
- [ ] Quick action: New work order for this customer
- [ ] Work history list (past services/installations)
- [ ] Edit customer button
- [ ] Delete customer (admin only, with confirmation)

**UI Components:**
- Card (customer info)
- Button (call, edit, add work order)
- Table/List (work history)
- Badge (work order status)
- Modal (delete confirmation)

**Wireframe:**
```
┌─────────────────────────────────────────────────────┐
│  ← Müşteriler                           [Düzenle]   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  Ahmet Yılmaz                     M-2024-001  │  │
│  │                                               │  │
│  │  📞 0555 123 4567                    [Ara]    │  │
│  │  ✉️  ahmet@example.com                        │  │
│  │  📍 Caferağa Mah. Moda Cad. No:15             │  │
│  │     Kadıköy, İstanbul                         │  │
│  │                                               │  │
│  │  Not: VIP müşteri, hızlı servis öncelikli     │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  [+ Yeni İş Emri]                                   │
│                                                     │
│  Geçmiş İşler (12)                                  │
│  ┌───────────────────────────────────────────────┐  │
│  │ 15.01.2024  Servis        ₺1.500  [Tamamlandı]│  │
│  │ Klima bakım - Panel: AC-2024-01               │  │
│  ├───────────────────────────────────────────────┤  │
│  │ 03.12.2023  Montaj        ₺8.500  [Tamamlandı]│  │
│  │ Yeni klima montajı - Panel: AC-2023-45        │  │
│  ├───────────────────────────────────────────────┤  │
│  │ 20.08.2023  Servis        ₺800    [Tamamlandı]│  │
│  │ Arıza giderme                                 │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Data Sources:**
- `customers` table — Customer info
- `get_customer_work_history(customer_id)` — Work history

---

### 4.6 Customer Form (Müşteri Formu)

```
URL:        /customers/new (add)
            /customers/:id/edit (edit)
Roles:      Admin, Field Worker
Priority:   🔴 Critical (add), 🟡 High (edit)
i18n NS:    customers
```

**Purpose:** Add or edit customer information.

**Features:**
- [ ] Form fields: name, phone, phone_secondary, email, address, city, district, notes
- [ ] Account number auto-generation (or manual entry)
- [ ] Form validation (Zod)
- [ ] Save and Cancel buttons
- [ ] Loading state on submit
- [ ] Redirect to customer detail on success

**Form Fields:**

| Field | Turkish Label | Type | Required | Validation |
|-------|--------------|------|----------|------------|
| name | Müşteri Adı | text | ✅ | min 2 chars |
| account_number | Müşteri Kodu | text | ❌ | unique |
| phone | Telefon | tel | ❌ | Turkish phone format |
| phone_secondary | İkinci Telefon | tel | ❌ | Turkish phone format |
| email | E-posta | email | ❌ | valid email |
| address | Adres | textarea | ❌ | - |
| city | Şehir | select | ❌ | - |
| district | İlçe | select | ❌ | - |
| notes | Notlar | textarea | ❌ | - |

**UI Components:**
- Input (text, email, tel)
- Select (city, district)
- Textarea (address, notes)
- Button (save, cancel)
- Alert (error)

---

### 4.7 Work Order List (İş Emirleri)

```
URL:        /work-orders
Roles:      All (filtered by role)
Priority:   🔴 Critical
i18n NS:    workOrders
```

**Purpose:** View and manage all work orders.

**Features:**
- [ ] Filter by status (pending, scheduled, in_progress, completed, cancelled)
- [ ] Filter by type (service, installation)
- [ ] Filter by date range
- [ ] Search by customer name
- [ ] List/card view
- [ ] Click to view detail
- [ ] "Yeni İş Emri" (New Work Order) button
- [ ] Field workers see only assigned orders

**Filter Tabs:**
```
[ Tümü ] [ Bekleyen ] [ Planlandı ] [ Devam Eden ] [ Tamamlandı ]
```

**UI Components:**
- Tabs (status filter)
- Select (type filter)
- SearchInput (customer search)
- Card (work order card)
- Badge (status, type, priority)
- EmptyState
- Button (new)

**Wireframe:**
```
┌─────────────────────────────────────────────────────┐
│  İş Emirleri                           [+ Yeni]     │
├─────────────────────────────────────────────────────┤
│  [Tümü] [Bekleyen] [Planlandı] [Devam] [Tamamlandı] │
│                                                     │
│  ┌──────────────────────┐ Tip: [Tümü ▼]             │
│  │ 🔍 Müşteri ara...    │                           │
│  └──────────────────────┘                           │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │ #WO-2024-089                      [Bekliyor]  │  │
│  │ Ahmet Yılmaz - Servis             [Yüksek]    │  │
│  │ 📅 05.02.2024 09:00                           │  │
│  │ 📍 Kadıköy, İstanbul                          │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │ #WO-2024-088                      [Planlandı] │  │
│  │ Mehmet Kaya - Montaj              [Normal]    │  │
│  │ 📅 05.02.2024 14:00                           │  │
│  │ 📍 Üsküdar, İstanbul                          │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

### 4.8 Work Order Detail (İş Emri Detay)

```
URL:        /work-orders/:id
Roles:      All (filtered by role)
Priority:   🔴 Critical
i18n NS:    workOrders
```

**Purpose:** View complete work order details and update status.

**Features:**
- [ ] Work order info (type, status, priority, dates)
- [ ] Customer info (link to customer detail)
- [ ] Description and notes
- [ ] Materials used
- [ ] Panel/equipment number
- [ ] Amount
- [ ] Assigned technician
- [ ] Status update buttons (field workers)
- [ ] Edit button (admin)
- [ ] Complete work order button

**Status Flow Buttons:**
```
[Bekliyor] → [Başla] → [Tamamla]
         → [İptal Et]
```

**Wireframe:**
```
┌─────────────────────────────────────────────────────┐
│  ← İş Emirleri                         [Düzenle]    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │  #WO-2024-089                                 │ │
│  │  [Servis] [Bekliyor] [Yüksek Öncelik]         │ │
│  │                                                │ │
│  │  📅 05.02.2024 09:00                          │ │
│  │  👤 Ali Teknisyen                             │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  Müşteri                                           │
│  ┌───────────────────────────────────────────────┐ │
│  │  Ahmet Yılmaz                         [→]     │ │
│  │  📞 0555 123 4567                     [Ara]   │ │
│  │  📍 Caferağa Mah. Moda Cad. No:15            │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  Detaylar                                          │
│  ┌───────────────────────────────────────────────┐ │
│  │  Açıklama: Klima soğutmuyor, gaz kontrol     │ │
│  │  Panel No: AC-2024-01                         │ │
│  │  Malzemeler: R410A gaz, filtre               │ │
│  │  Tutar: ₺1.500                               │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │           [İşe Başla]                       │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

### 4.9 Work Order Form (İş Emri Formu)

```
URL:        /work-orders/new (add)
            /work-orders/:id/edit (edit)
Roles:      Admin, Field Worker
Priority:   🔴 Critical
i18n NS:    workOrders
```

**Purpose:** Create or edit work orders.

**Features:**
- [ ] Customer selection (searchable dropdown)
- [ ] Type selection (service/installation)
- [ ] Priority selection
- [ ] Scheduled date and time
- [ ] Assigned technician (admin only can assign others)
- [ ] Description
- [ ] Panel number
- [ ] Amount (optional)
- [ ] Notes

**Form Fields:**

| Field | Turkish Label | Type | Required | Notes |
|-------|--------------|------|----------|-------|
| customer_id | Müşteri | searchable select | ✅ | With "add new" option |
| type | Tip | select | ✅ | Servis / Montaj |
| priority | Öncelik | select | ✅ | Default: Normal |
| scheduled_date | Tarih | date | ❌ | - |
| scheduled_time | Saat | time | ❌ | - |
| assigned_to | Atanan | select | ❌ | Only admin can change |
| title | Başlık | text | ❌ | Short description |
| description | Açıklama | textarea | ❌ | - |
| panel_number | Panel No | text | ❌ | - |
| amount | Tutar | number | ❌ | In TRY |
| notes | Notlar | textarea | ❌ | Internal notes |

---

### 4.10 Task List (Yapılacaklar)

```
URL:        /tasks
Roles:      Admin, Field Worker
Priority:   🔴 Critical
i18n NS:    tasks
```

**Purpose:** Manage daily to-do items.

**Features:**
- [ ] Filter by status (pending, in_progress, completed)
- [ ] Filter by priority
- [ ] Due date sorting
- [ ] Quick status toggle (checkbox)
- [ ] Add new task (modal or inline)
- [ ] Link to related work order (if any)
- [ ] Overdue indicator

**Wireframe:**
```
┌─────────────────────────────────────────────────────┐
│  Yapılacaklar                          [+ Ekle]     │
├─────────────────────────────────────────────────────┤
│  [Tümü] [Bekleyen] [Devam Eden] [Tamamlandı]        │
│                                                     │
│  Bugün (3)                                          │
│  ┌───────────────────────────────────────────────┐ │
│  │ ○ Teklif hazırla - ABC Şirketi    [Yüksek]   │ │
│  │   📅 Bugün                                    │ │
│  ├───────────────────────────────────────────────┤ │
│  │ ○ Malzeme siparişi ver            [Normal]   │ │
│  │   📅 Bugün                                    │ │
│  ├───────────────────────────────────────────────┤ │
│  │ ○ Müşteri ara - Mehmet Bey        [Normal]   │ │
│  │   📅 Bugün                                    │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  Yarın (2)                                          │
│  ┌───────────────────────────────────────────────┐ │
│  │ ○ Fatura kes                      [Normal]   │ │
│  │   📅 Yarın                                    │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  Gecikenler (1)                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ ○ Rapor gönder                    [Acil] ⚠️  │ │
│  │   📅 2 gün önce                              │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

### 4.11 Task Form (Görev Formu)

```
Type:       Modal (not full page)
Roles:      Admin, Field Worker
Priority:   🟡 High
i18n NS:    tasks
```

**Purpose:** Quick task creation.

**Features:**
- [ ] Title input
- [ ] Description (optional)
- [ ] Due date
- [ ] Priority
- [ ] Assigned to (admin can assign to others)
- [ ] Link to work order (optional)

**Form Fields:**

| Field         | Turkish Label  | Type     | Required  |
|---------------|----------------|----------|-----------|
| title         | Görev          | text     | ✅        |
| description   | Açıklama       | textarea | ❌        |
| due_date      | Tarih          | date     | ❌        |
| priority      | Öncelik        | select   | ✅        |
| assigned_to   | Atanan         | select   | ❌        |
| work_order_id | İlgili İş Emri | select   | ❌        |

---

### 4.12 Profile Page (Profil)

```
URL:        /profile
Roles:      All
Priority:   🟡 High
i18n NS:    profile
```

**Purpose:** View and edit own profile.

**Features:**
- [ ] Display name
- [ ] Phone number
- [ ] Avatar (optional, Phase 2)
- [ ] Change password link (via Supabase)
- [ ] Logout button

**Wireframe:**
```
┌─────────────────────────────────────────────────────┐
│  Profil                                             │
├─────────────────────────────────────────────────────┤
│                                                     │
│         ┌─────┐                                     │
│         │ 👤  │  Ali Teknisyen                      │
│         └─────┘  ali@ornet.com                      │
│                  Saha Ekibi                         │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  Ad Soyad                                     │  │
│  │  ┌───────────────────────────────────────┐    │  │
│  │  │ Ali Teknisyen                         │    │  │
│  │  └───────────────────────────────────────┘    │  │
│  │                                               │  │
│  │  Telefon                                      │  │
│  │  ┌───────────────────────────────────────┐    │  │
│  │  │ 0555 111 2233                         │    │  │
│  │  └───────────────────────────────────────┘    │  │
│  │                                               │  │
│  │           [Kaydet]                            │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  [Şifre Değiştir]                                   │
│                                                     │
│  [Çıkış Yap]                                        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 5. Navigation Structure

### Main Navigation (Desktop Sidebar / Mobile Bottom)

```
┌──────────────────┐
│  🏠 Ana Sayfa    │  /
├──────────────────┤
│  👥 Müşteriler   │  /customers
├──────────────────┤
│  📋 İş Emirleri  │  /work-orders
├──────────────────┤
│  ✓  Yapılacaklar │  /tasks
├──────────────────┤
│  👤 Profil       │  /profile
└──────────────────┘
```

### Mobile Bottom Navigation

```
┌────────┬────────┬────────┬────────┬────────┐
│   🏠   │   👥   │   ➕   │   📋   │   👤   │
│  Ana   │ Müşt.  │  Yeni  │   İş   │ Profil │
│ Sayfa  │        │        │ Emirl. │        │
└────────┴────────┴────────┴────────┴────────┘
```

### Quick Add Menu (+ Button)

```
┌─────────────────────┐
│  + Müşteri Ekle     │
│  + İş Emri Oluştur  │
│  + Görev Ekle       │
└─────────────────────┘
```

---

## 6. Implementation Phases

### Phase 1: MVP (Must Have)

| Priority | Screen | Complexity | Notes |
|----------|--------|------------|-------|
| 1 | Login | Low | Already exists, enhance |
| 2 | Dashboard | Medium | Stats + today's schedule |
| 3 | Customer List | Medium | Search + list |
| 4 | Customer Detail | Medium | Info + work history |
| 5 | Customer Form | Medium | Add/edit |
| 6 | Work Order List | Medium | Filters + list |
| 7 | Work Order Detail | Medium | Status updates |
| 8 | Work Order Form | High | Many fields, customer search |
| 9 | Task List | Medium | Status toggle |
| 10 | Task Form (Modal) | Low | Simple form |
| 11 | Profile | Low | Basic info + logout |
| 12 | Password Reset | Low | Supabase handles |

**Estimated Screens:** 12
**Implementation Order:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12

### Phase 2: Nice to Have

| Screen | Complexity | Notes |
|--------|------------|-------|
| Calendar View | High | Work order scheduling |
| Reports | Medium | Analytics dashboard |
| User Management | Medium | Invite/manage users |
| Settings | Low | App settings |
| Notifications | Medium | In-app notifications |

### Phase 3: Future

| Screen | Notes |
|--------|-------|
| Offline Mode | PWA with local storage |
| Mobile App | React Native (if needed) |
| Finance Module | Invoicing, payments |
| Inventory | Materials tracking |

---

## 7. i18n Requirements

### Namespace Structure

```
locales/
└── tr/
    ├── common.json       # Shared strings (buttons, labels)
    ├── auth.json         # Login, password reset
    ├── dashboard.json    # Dashboard stats, schedule
    ├── customers.json    # Customer list, detail, form
    ├── workOrders.json   # Work order screens
    ├── tasks.json        # Task screens
    ├── profile.json      # Profile page
    └── errors.json       # Error messages
```

### New Keys to Add

**common.json:**
```json
{
  "actions": {
    "add": "Ekle",
    "edit": "Düzenle",
    "delete": "Sil",
    "save": "Kaydet",
    "cancel": "İptal",
    "search": "Ara",
    "filter": "Filtrele",
    "back": "Geri",
    "close": "Kapat",
    "confirm": "Onayla",
    "call": "Ara",
    "viewDetails": "Detayları Gör"
  },
  "status": {
    "pending": "Bekliyor",
    "scheduled": "Planlandı",
    "inProgress": "Devam Ediyor",
    "completed": "Tamamlandı",
    "cancelled": "İptal Edildi"
  },
  "priority": {
    "low": "Düşük",
    "normal": "Normal",
    "high": "Yüksek",
    "urgent": "Acil"
  },
  "time": {
    "today": "Bugün",
    "tomorrow": "Yarın",
    "yesterday": "Dün",
    "thisWeek": "Bu Hafta",
    "overdue": "Gecikmiş"
  },
  "empty": {
    "noData": "Veri bulunamadı",
    "noResults": "Sonuç bulunamadı"
  }
}
```

**dashboard.json:**
```json
{
  "title": "Ana Sayfa",
  "stats": {
    "todayWorkOrders": "Bugünkü İşler",
    "pendingWorkOrders": "Bekleyen İşler",
    "openTasks": "Açık Görevler",
    "overdueTasks": "Geciken Görevler"
  },
  "todaySchedule": {
    "title": "Bugünün Programı",
    "empty": "Bugün için planlanmış iş yok"
  },
  "pendingTasks": {
    "title": "Bekleyen Görevler",
    "viewAll": "Tümünü Gör"
  },
  "quickActions": {
    "addCustomer": "Müşteri Ekle",
    "addWorkOrder": "İş Emri Oluştur",
    "addTask": "Görev Ekle"
  }
}
```

**customers.json:**
```json
{
  "list": {
    "title": "Müşteriler",
    "searchPlaceholder": "Müşteri ara...",
    "addButton": "Müşteri Ekle",
    "empty": "Henüz müşteri eklenmemiş"
  },
  "detail": {
    "title": "Müşteri Detayı",
    "workHistory": "Geçmiş İşler",
    "noHistory": "Bu müşteri için iş kaydı yok",
    "newWorkOrder": "Yeni İş Emri"
  },
  "form": {
    "addTitle": "Yeni Müşteri",
    "editTitle": "Müşteri Düzenle",
    "fields": {
      "name": "Müşteri Adı",
      "accountNumber": "Müşteri Kodu",
      "phone": "Telefon",
      "phoneSecondary": "İkinci Telefon",
      "email": "E-posta",
      "address": "Adres",
      "city": "Şehir",
      "district": "İlçe",
      "notes": "Notlar"
    },
    "placeholders": {
      "name": "Ad veya firma adı",
      "phone": "0555 123 4567",
      "email": "ornek@email.com",
      "address": "Açık adres"
    }
  },
  "delete": {
    "title": "Müşteri Sil",
    "message": "Bu müşteriyi silmek istediğinizden emin misiniz?",
    "warning": "Bu işlem geri alınamaz."
  }
}
```

**workOrders.json:**
```json
{
  "list": {
    "title": "İş Emirleri",
    "searchPlaceholder": "Müşteri ara...",
    "addButton": "Yeni İş Emri",
    "empty": "İş emri bulunamadı",
    "filters": {
      "all": "Tümü",
      "type": "Tip",
      "allTypes": "Tüm Tipler"
    }
  },
  "detail": {
    "title": "İş Emri Detayı",
    "customer": "Müşteri",
    "details": "Detaylar",
    "fields": {
      "description": "Açıklama",
      "panelNumber": "Panel No",
      "materials": "Malzemeler",
      "amount": "Tutar",
      "assignedTo": "Atanan",
      "scheduledDate": "Planlanan Tarih",
      "completedAt": "Tamamlanma Tarihi"
    }
  },
  "form": {
    "addTitle": "Yeni İş Emri",
    "editTitle": "İş Emri Düzenle",
    "fields": {
      "customer": "Müşteri",
      "type": "Tip",
      "priority": "Öncelik",
      "scheduledDate": "Tarih",
      "scheduledTime": "Saat",
      "assignedTo": "Atanan",
      "title": "Başlık",
      "description": "Açıklama",
      "panelNumber": "Panel No",
      "amount": "Tutar",
      "notes": "Notlar"
    },
    "selectCustomer": "Müşteri seçin",
    "selectType": "Tip seçin",
    "selectAssignee": "Kişi seçin"
  },
  "types": {
    "service": "Servis",
    "installation": "Montaj"
  },
  "actions": {
    "start": "İşe Başla",
    "complete": "Tamamla",
    "cancel": "İptal Et"
  }
}
```

**tasks.json:**
```json
{
  "list": {
    "title": "Yapılacaklar",
    "addButton": "Görev Ekle",
    "empty": "Görev bulunamadı",
    "sections": {
      "today": "Bugün",
      "tomorrow": "Yarın",
      "upcoming": "Yaklaşan",
      "overdue": "Geciken",
      "completed": "Tamamlanan"
    }
  },
  "form": {
    "addTitle": "Yeni Görev",
    "editTitle": "Görev Düzenle",
    "fields": {
      "title": "Görev",
      "description": "Açıklama",
      "dueDate": "Tarih",
      "priority": "Öncelik",
      "assignedTo": "Atanan",
      "workOrder": "İlgili İş Emri"
    },
    "placeholders": {
      "title": "Görevi kısaca yazın",
      "description": "Detaylar (isteğe bağlı)"
    }
  }
}
```

**profile.json:**
```json
{
  "title": "Profil",
  "fields": {
    "fullName": "Ad Soyad",
    "email": "E-posta",
    "phone": "Telefon",
    "role": "Rol"
  },
  "roles": {
    "admin": "Yönetici",
    "fieldWorker": "Saha Ekibi",
    "accountant": "Muhasebe"
  },
  "actions": {
    "changePassword": "Şifre Değiştir",
    "logout": "Çıkış Yap"
  }
}
```

---

## 8. Mobile Considerations

### Touch Targets
- Minimum button/link size: 44x44px
- Adequate spacing between tappable elements

### Mobile-Specific UX
- Bottom navigation (5 items max)
- Pull-to-refresh on lists
- Swipe gestures (optional, Phase 2)
- Click-to-call phone numbers
- GPS for address (optional, Phase 2)

### Responsive Breakpoints

| Screen | Mobile (< 640px) | Tablet (640-1024px) | Desktop (> 1024px) |
|--------|------------------|---------------------|-------------------|
| Lists | Cards, stacked | Cards, 2 columns | Table view |
| Forms | Full width | Centered, max 600px | Sidebar + form |
| Navigation | Bottom bar | Bottom bar | Left sidebar |
| Modals | Full screen | Centered, max 500px | Centered, max 500px |

---

## 9. URL Structure

### Route Definitions

```javascript
// App.jsx routes
const routes = [
  // Public
  { path: '/login', element: <LoginPage /> },
  { path: '/reset-password', element: <PasswordResetPage /> },

  // Protected (requires auth)
  {
    path: '/',
    element: <ProtectedRoute><AppLayout /></ProtectedRoute>,
    children: [
      { index: true, element: <DashboardPage /> },

      // Customers
      { path: 'customers', element: <CustomerListPage /> },
      { path: 'customers/new', element: <CustomerFormPage /> },
      { path: 'customers/:id', element: <CustomerDetailPage /> },
      { path: 'customers/:id/edit', element: <CustomerFormPage /> },

      // Work Orders
      { path: 'work-orders', element: <WorkOrderListPage /> },
      { path: 'work-orders/new', element: <WorkOrderFormPage /> },
      { path: 'work-orders/:id', element: <WorkOrderDetailPage /> },
      { path: 'work-orders/:id/edit', element: <WorkOrderFormPage /> },

      // Tasks
      { path: 'tasks', element: <TaskListPage /> },

      // Profile
      { path: 'profile', element: <ProfilePage /> },
    ],
  },

  // Catch-all
  { path: '*', element: <Navigate to="/" /> },
];
```

### URL Parameters

| Pattern | Example | Description |
|---------|---------|-------------|
| `/customers/:id` | `/customers/abc-123` | Customer UUID |
| `/work-orders/:id` | `/work-orders/wo-456` | Work order UUID |
| `?status=pending` | `/work-orders?status=pending` | Filter query param |
| `?search=ahmet` | `/customers?search=ahmet` | Search query param |
| `?type=service` | `/work-orders?type=service` | Type filter |

---

## Appendix: Screen Dependency Graph

```
LoginPage
    │
    ▼
DashboardPage ──────────────────────────┐
    │                                   │
    ├──► CustomerListPage               │
    │         │                         │
    │         ├──► CustomerDetailPage   │
    │         │         │               │
    │         │         └──► WorkOrderFormPage (pre-filled customer)
    │         │                         │
    │         └──► CustomerFormPage     │
    │                                   │
    ├──► WorkOrderListPage              │
    │         │                         │
    │         ├──► WorkOrderDetailPage  │
    │         │                         │
    │         └──► WorkOrderFormPage    │
    │                                   │
    ├──► TaskListPage                   │
    │         │                         │
    │         └──► TaskFormModal        │
    │                                   │
    └──► ProfilePage                    │
              │                         │
              └──► PasswordResetPage ◄──┘
```

---

## Changelog

| Date | Change |
|------|--------|
| 2024-XX-XX | Initial page planning created |

---

> **Implementation Notes:**
> - Start with Login → Dashboard → Customers flow
> - Build reusable components as you go
> - Test each screen on mobile before moving to next
> - Add loading states and error handling from the start
