# Frontend Yapısı ve Operasyonlar

Klasör yapısı, auth akışı, MVP sayfaları, deploy ve env kararları. Modüler ve mobile first hedeflerine uygun.

---

## 1. Klasör Yapısı (Modüler)

```
src/
  app/                 # Route tree, layout, auth wrapper
  components/          # Paylaşılan: Button, Input, Card, Table
    ui/                # Sade UI bileşenleri (design token kullanır)
  features/           # Modül bazlı (her biri kendi sayfa + bileşen)
    auth/
    customers/
    service/           # Servis + montaj formu, işler
    finance/
    tasks/             # Yapılacak işler
  hooks/               # useAuth, useTranslation, custom hooks
  lib/                 # Supabase client, i18n config, utils
  locales/             # tr/, en/ — i18n.md ile uyumlu
  pages/               # Route sayfaları (features’a delegate edebilir)
  styles/              # Global CSS, Tailwind entry
```

- Her feature kendi klasöründe; dışa minimal bağımlılık.
- UI bileşenleri `components/ui`; renk/boyut sadece design token’dan.

---

## 2. Auth Akışı

| Adım | Karar | Açıklama |
|------|--------|----------|
| **Sağlayıcı** | Supabase Auth | Email/şifre (MVP); ileride OAuth eklenebilir. |
| **Login sayfası** | `/login` | Sadece giriş; “beni hatırla” opsiyonel. |
| **Korumalı route** | Layout veya route guard | Giriş yoksa `/login`’e yönlendir. |
| **Rol bilgisi** | `user_metadata.role` veya `profiles` tablosu | Admin / saha / muhasebe; RLS ve UI’da rol bazlı görünüm. |
| **Saha kullanıcısı** | Sadece atandığı işler ve servis/montaj formu | Liste filtreleri ve Supabase RLS ile. |

Auth state: Supabase `onAuthStateChange` + React Query veya Context; tek kaynak.

---

## 3. MVP Sayfaları (Mobile First)

Tüm sayfalar önce mobil (tek sütun, dokunmatik dostu); `sm:` ve `md:` ile tablet/desktop.

| Route | Açıklama | Modül |
|-------|----------|--------|
| `/login` | Giriş ekranı | auth |
| `/` veya `/dashboard` | Basit özet (açık iş sayısı, bugünkü işler) | — |
| `/customers` | Müşteri listesi (arama, filtre) | customers |
| `/customers/:id` | Müşteri kartı (iletişim, adres, geçmiş servis/montaj) | customers |
| `/service/new` veya form | Servis/montaj formu (saha ekibi doldurur) | service |
| `/tasks` | Yapılacak işler listesi (durum, tarih, atanan) | tasks |

Faz 2: Finans (kasa, ödeme), teklif, abonelik sayfaları eklenir.

---

## 4. Supabase config

- **Supabase Secrets** = sadece Edge Functions (sunucu tarafı). Dashboard → Edge Functions → Secrets ile ayarlanır; tarayıcıya hiç gönderilmez.
- **Frontend** için Supabase **Project URL** ve **anon key** gerekir. Bunlar “gizli” değildir (RLS veriyi korur). Dashboard → Project Settings → API’den alınır.
- **Yerel geliştirme:** `VITE_SUPABASE_URL` ve `VITE_SUPABASE_ANON_KEY` değerlerini commit edilmeyen bir dosyada veya dev ortamında ayarlayın; asla repoya koymayın.
- **Production:** Aynı değişkenleri hosting platformunda (örn. Vercel → Environment Variables) tanımlayın. Repoda `.env` veya `.env.example` tutulmaz; Supabase Secrets yalnızca Edge Functions için kullanılır.

---

## 5. Deploy ve Ortam

| Konu | Karar | Açıklama |
|------|--------|----------|
| **Kim deploy eder?** | Sen (veya yetkili) | Git push → Vercel otomatik build + deploy; main/production branch. |
| **Supabase URL / anon key** | Hosting env veya gitignored local | Dashboard → API’den alınır; Vercel (prod) veya local gitignored dosyada. Repoda .env yok. |
| **Production env** | Vercel proje ayarları | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` panelden girilir; build’de inject edilir. |

---

## 6. Backup ve İzlenebilirlik

| Konu | Karar |
|------|--------|
| **Veritabanı yedeği** | Supabase otomatik yedekleme; proje ayarlarından kontrol edilir. |
| **Kullanım takibi** | İsteğe: kritik aksiyonlar (giriş, form gönderimi) log tablosuna veya Edge Function ile loglanabilir; MVP’de zorunlu değil. |
| **Hata takibi** | İsteğe: Sentry vb.; MVP sonrası eklenebilir. |

Bu dosya: “Nereye ne koyarız, nasıl deploy ederiz?” sorusunun tek referansı.
