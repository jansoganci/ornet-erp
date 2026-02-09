# Tech Stack (Teknoloji Kararları)

Tüm teknoloji kararları tek tabloda; neden seçildiği kısa açıklanır. Değişirse sadece bu dosya güncellenir.

---

## 1. Karar Tablosu

| Katman | Karar | Neden / Not |
|--------|--------|-------------|
| **Frontend framework** | React | Yaygın, ekosistem zengin; component yapısı modüler sisteme uygun. |
| **Styling** | Tailwind CSS | Design token’larla uyumlu; utility-first, tutarlı spacing/renk; mobile first breakpoint’ler hazır. |
| **State (global)** | React Query (sunucu) + Zustand (isteğe, UI state) | Sunucu verisi: cache, refetch, loading; UI state sadece gerektiğinde Zustand. Basit tutulur. |
| **Routing** | React Router v6 | SPA; korumalı route’lar (auth); lazy load ile kod bölme. |
| **Form** | React Hook Form + Zod | Performanslı form; Zod ile validasyon şeması tek yerde; hata mesajları i18n key ile. |
| **Backend / DB / Auth** | Supabase | PostgreSQL, Auth, Realtime, Edge Functions tek platform; hızlı geliştirme. |
| **Otomasyon** | N8N (veya Make) | Tekrarlayan işler, webhook, Paraşüt/ödeme entegrasyonu; kod dışı akışlar. |
| **Hosting (frontend)** | Vercel | React için uyumlu; Git push = deploy; env değişkenleri panelden. |
| **API / serverless** | Supabase Edge Functions | Fatura tetikleme, kur çekme, webhook işleme; backend ayrı sunucu gerektirmez. |
| **i18n** | react-i18next + i18next | Namespace, lazy load; `docs/i18n.md` ile uyumlu. |
| **HTTP client** | Supabase client + fetch (Edge’den dış API) | Supabase: DB ve Auth; harici API’ler için fetch veya Edge Function. |

---

## 2. Versiyon ve Bağımlılık Notu

- **Node:** LTS (örn. 20.x)
- **Package manager:** npm veya pnpm
- Versiyonlar `package.json` içinde sabitlenir; “latest” kullanılmaz.

---

## 3. Mimari Prensip

- **Frontend ayrı, backend ayrı:** UI sadece Supabase API ve Edge Function endpoint’lerini çağırır; iş mantığı mümkün olduğunca backend/Edge’de. Böylece kullanım takip edilebilir, test ve bakım kolaylaşır.
- **Modüler:** Her modül (müşteri, finans, servis) kendi sayfaları, bileşenleri ve locale namespace’i ile; bağımlılıklar az.
- Bu dosya “ne kullanıyoruz?” sorusunun tek cevabıdır.
