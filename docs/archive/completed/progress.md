# İlerleme / Yapılanlar (Progress Log)

Bu dosyada ne yaptığımız ve sıradaki işler yazılı. Her önemli adımdan sonra güncellenir.

---

## Yapılanlar

### Faz 0.1 — Proje kurulumu
- React + Vite projesi oluşturuldu (`ornet-erp`).
- Tailwind CSS v4 eklendi (`@tailwindcss/vite`); `src/index.css` içinde `@import "tailwindcss"` ve ilk `@theme` değerleri.
- Klasör yapısı kuruldu: `src/app`, `src/components/ui`, `src/features/{auth,customers,service,finance,tasks}`, `src/hooks`, `src/lib`, `src/locales/tr`, `src/pages`, `src/styles`.
- ESLint (Vite varsayılan) kullanılıyor.

### Faz 0.2 — Design token’lar + Inter
- `src/index.css` içinde `@theme` tamamlandı: renkler, spacing, radius, shadow, font-size, line-height ([docs/design-tokens.md](design-tokens.md) ile uyumlu).
- Inter fontu `index.html` üzerinden (Google Fonts) yüklendi.

### Faz 0.3 — i18n
- `i18next` ve `react-i18next` kuruldu.
- `src/locales/tr/` altında namespace dosyaları: `common`, `auth`, `errors`, `customers`, `finance`, `service`.
- `src/lib/i18n.js` ile varsayılan dil `tr`, namespace’ler tanımlandı.
- `main.jsx` içinde i18n import edildi; App ve diğer ekranlar `t()` kullanıyor.

### Faz 0.4 — Supabase client (login entegre edilmedi)
- `.env.example` kaldırıldı; repoda `.env` yok. Supabase URL/anon key hosting veya gitignored local’den gelir.
- [docs/frontend-and-ops.md](frontend-and-ops.md) içine “Supabase config” bölümü eklendi (Secrets vs frontend config).
- `@supabase/supabase-js` kuruldu; `src/lib/supabase.js` ile client oluşturuluyor (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).

### Faz 0.5 — Auth boilerplate (şu an kullanılmıyor)
- `react-router-dom` kuruldu.
- `src/hooks/useAuth.js`: `user`, `loading`, `signOut`; Supabase `onAuthStateChange`.
- `src/features/auth/LoginPage.jsx`: e-posta/şifre formu, `signInWithPassword`, i18n.
- `src/app/ProtectedRoute.jsx`: giriş yoksa `/login`’e yönlendiriyor.
- `src/app/AppLayout.jsx`: header (app adı, e-posta, çıkış), `<Outlet />`.
- `src/pages/DashboardPage.jsx`: basit hoş geldin içeriği.
- `App.jsx`: `/login` (LoginPage), `/` (ProtectedRoute → AppLayout → Dashboard), catch-all → `/`.

**Not:** Supabase hesabı açılmadığı için login şu an entegre edilmiyor; uygulama Supabase olmadan ilerleyecek. Hesap açıldığında env değişkenleri ve Auth açılacak.

**Supabase olmadan çalışma:** `VITE_SUPABASE_URL` ve `VITE_SUPABASE_ANON_KEY` tanımlı değilse uygulama login istemeden `/` (dashboard) gösterir; header'da e-posta ve çıkış butonu görünmez. Supabase yapılandırıldığında korumalı route ve login tekrar devreye girer.

### Faz 1.1 — Veritabanı Şeması (Database Schema)

- Supabase projesi oluşturuldu: `https://xyybpwrkqdwfvcomvnrk.supabase.co`
- `.env.local` dosyası oluşturuldu (Supabase URL eklendi, anon key bekleniyor)
- `supabase/migrations/` klasörü oluşturuldu:
  - `00001_profiles.sql` — Kullanıcı profilleri (role: admin/field_worker/accountant)
  - `00002_customers.sql` — Müşteri tablosu + account_number generator
  - `00003_work_orders.sql` — Servis/montaj işleri + status triggers
  - `00004_tasks.sql` — Yapılacak işler
  - `00005_dashboard_functions.sql` — Dashboard istatistikleri için helper functions
- `supabase/complete_schema.sql` — Tek dosyada tüm şema (SQL Editor'e yapıştır-çalıştır)
- RLS (Row Level Security) politikaları tamamlandı:
  - profiles: Herkes okur, kendi günceller, admin siler
  - customers: Herkes okur/yazar, admin siler
  - work_orders: Admin/muhasebe hepsini görür, saha ekibi sadece atananları
  - tasks: Admin hepsini görür, saha ekibi sadece atananları
- Helper functions: `get_my_role()`, `get_dashboard_stats()`, `get_today_schedule()`, `get_my_pending_tasks()`, `get_customer_work_history()`
- Views: `work_orders_with_customer`, `tasks_with_details`
- **Supabase şeması başarıyla çalıştırıldı** (tüm tablolar, RLS, fonksiyonlar aktif)

### Design System Dokümantasyonu

- `docs/design-system.md` oluşturuldu — Kapsamlı UI spesifikasyonu:
  - **Color Palette**: Primary (Blue), Neutral (Slate), Success, Warning, Error, Info
  - **Typography**: Inter font ailesi, font-size scale (xs-4xl), weights
  - **Spacing**: 4px tabanlı scale (0-16)
  - **Components**: Button, Input, Select, Card, Badge, Modal, Alert, Table, Spinner, EmptyState
  - **Folder Structure**: `components/ui/`, `components/layout/`, `features/`, `hooks/`, `lib/`
  - Component specs: Variants, sizes, states, props, structure
- `src/index.css` güncellendi — Yeni design tokens:
  - Full color palette (50-950 scales)
  - Extended spacing scale
  - Z-index system
  - Animations (spin, pulse, fade-in, slide-up/down)
  - Focus styles, scrollbar styles
- `src/lib/utils.js` oluşturuldu:
  - `cn()` class merger
  - `formatPhone()`, `formatDate()`, `formatDateTime()`, `formatCurrency()`
  - `getInitials()`, `debounce()`, `truncate()`, `getRelativeTime()`
  - Status/priority variant mappings
  - Turkish labels (statusLabels, priorityLabels, workOrderTypeLabels)

### Sayfa ve Ekran Planlaması

- `docs/pages-and-screens.md` oluşturuldu — Kapsamlı ekran envanteri:
  - **MVP Ekranları (14 adet)**: Login, Dashboard, Customers (list/detail/form), Work Orders (list/detail/form), Tasks, Profile
  - **Phase 2 Ekranları (5 adet)**: Calendar, Reports, Users, Settings, Notifications
  - Her ekran için: URL, roller, özellikler, wireframe, data sources
  - Navigation yapısı (desktop sidebar, mobile bottom nav)
  - URL route tanımları
  - Uygulama sırası ve öncelikler
- i18n dosyaları güncellendi — Tüm ekranlar için çeviri anahtarları:
  - `common.json` — actions, status, priority, time, nav
  - `dashboard.json` — stats, schedule, quickActions
  - `customers.json` — list, detail, form, delete
  - `workOrders.json` — list, detail, form, statuses, actions
  - `tasks.json` — list, form, statuses, priorities
  - `profile.json` — fields, roles, actions
  - `auth.json` — login, passwordReset, errors
  - `errors.json` — general, validation, api, entity errors
- `src/lib/i18n.js` güncellendi — 8 namespace aktif

### Faz 1.1.1 — Bağımlılıklar ve UI Bileşenleri

- React Query, react-hook-form, zod, lucide-react kuruldu
- `clsx` ve `tailwind-merge` kuruldu
- `src/lib/utils.js` güncellendi — `cn()` artık `twMerge(clsx(...))` kullanıyor

**UI Bileşenleri Tamamlandı** (`src/components/ui/`):
- `Spinner.jsx` — sm/md/lg sizes, animate-spin
- `Badge.jsx` — default/primary/success/warning/error/info variants, dot option
- `Button.jsx` — primary/secondary/outline/ghost/danger variants, loading state, icons
- `IconButton.jsx` — icon-only button, aria-label required
- `Input.jsx` — label, hint, error, left/right icons, forwardRef
- `Select.jsx` — native select, options array, forwardRef
- `SearchInput.jsx` — debounced search, clear button
- `Card.jsx` — default/interactive/selected variants, header/footer
- `Table.jsx` — columns, data, loading, empty state, striped
- `Modal.jsx` — portal, backdrop, escape key, focus trap

**Layout Bileşenleri** (`src/components/layout/`):
- `Stack.jsx` — flex container, direction, spacing, align, justify
- `Container.jsx` — max-width, padding, centered
- `Header.jsx` — title, left/right content, sticky

**Index dosyaları** — Re-export all components

### Faz 1.2 — Müşteri Modülü

- **React Query provider** kuruldu (`src/app/providers.jsx`)
- **AppLayout güncellendi** — Desktop navbar + mobile bottom navigation
- **Müşteri API** (`src/features/customers/api.js`):
  - `fetchCustomers()` — Liste + arama
  - `fetchCustomer()` — Tekil müşteri
  - `fetchCustomerWorkOrders()` — Müşterinin iş emirleri
  - `createCustomer()` — Yeni müşteri (account_number otomatik)
  - `updateCustomer()` — Güncelleme
  - `deleteCustomer()` — Silme (admin only)
  - Mock data desteği (Supabase olmadan geliştirme için)
- **React Query hooks** (`src/features/customers/hooks.js`):
  - `useCustomers()`, `useCustomer()`, `useCustomerWorkOrders()`
  - `useCreateCustomer()`, `useUpdateCustomer()`, `useDeleteCustomer()`
- **Zod validation** (`src/features/customers/schema.js`)
- **Sayfalar**:
  - `CustomersListPage.jsx` — Arama, kart grid, boş durum
  - `CustomerDetailPage.jsx` — İletişim bilgileri, notlar, iş geçmişi tablosu, silme modalı
  - `CustomerFormPage.jsx` — react-hook-form + zod, oluştur/düzenle modu
- **Routing** (`src/App.jsx`):
  - `/customers` — Liste
  - `/customers/new` — Yeni müşteri formu
  - `/customers/:id` — Detay sayfası
  - `/customers/:id/edit` — Düzenleme formu

### Faz 1.3 — İş Emri Modülü

- **İş emri API + hooks** (`src/features/workOrders/`) — Supabase + Mock desteği
- **Zod validation** (`src/features/workOrders/schema.js`)
- **Sayfalar**:
  - `WorkOrdersListPage.jsx` — Gelişmiş filtreleme (durum, tip, arama)
  - `WorkOrderDetailPage.jsx` — Müşteri bilgileri, teknik detaylar, durum aksiyonları (Başlat/Tamamla/İptal)
  - `WorkOrderFormPage.jsx` — Özel `CustomerSelect` bileşeni ile müşteri seçimi
- **Routing**: `/work-orders`, `/work-orders/new`, `/work-orders/:id`, `/work-orders/:id/edit` eklendi.

### Faz 1.4 — Görev Modülü

- **Görev API + hooks** (`src/features/tasks/`) — Supabase + Mock desteği
- **Zod validation** (`src/features/tasks/schema.js`)
- **Bileşenler**:
  - `TaskModal.jsx` — Görev ekleme ve düzenleme için modal yapısı
  - `TasksPage.jsx` — Kart tabanlı liste görünümü, hızlı durum değiştirme (tamamla/aç), filtreler
- **Routing**: `/tasks` eklendi.

### Faz 1.5 — Dashboard

- **Dashboard API + hooks** (`src/features/dashboard/`) — Supabase RPC + Mock desteği
- **Bileşenler**:
  - `StatCard.jsx` — İstatistik kartları (renkli varyantlar ve ikonlar ile)
- **DashboardPage.jsx**:
  - İstatistik özeti (Bugünkü işler, bekleyen işler, açık görevler, toplam müşteri)
  - "Bugünün Programı" listesi (Zaman bazlı sıralama)
  - "Bekleyen Görevler" listesi (Hızlı tamamlama özelliği ile)
  - "Hızlı İşlemler" paneli (Müşteri ekle, iş emri oluştur, görev ekle)

---

## Sıradaki iş (Next task)

### Faz 2.1 — Takvim Görünümü
1. Takvim kütüphanesi entegrasyonu
2. İş emirlerinin takvim üzerinde görüntülenmesi
3. Sürükle-bırak ile tarih güncelleme

---

## Güncelleme kuralı

Her önemli teslimattan sonra bu dosyada “Yapılanlar”a ekleme yap; “Sıradaki iş”i güncelle.
