# Design Tokens (Tasarım Sistemi)

Tüm renk, tipografi, spacing ve bileşen değerleri tek yerden yönetilir. Kodda sabit değer yazılmaz; bu dosyaya veya (ileride) admin panelindeki tema ayarlarına referans verilir.

---

## 1. Renkler (Colors)

**Design Language:** Warm & Clear with Red Accent (Security SaaS)

| Token | Değer | Kullanım |
|-------|--------|----------|
| `color.primary` | `#dc2626` | Ana buton, link, vurgu (Red - Brand) |
| `color.primary.hover` | `#b91c1c` | Hover durumu |
| `color.secondary` | `#78716c` | İkincil aksiyon, alt metin (Warm Stone) |
| `color.success` | `#059669` | Başarı, onay, tamamlandı (Emerald) |
| `color.danger` | `#dc2626` | Hata, sil, uyarı (Red - same as primary) |
| `color.warning` | `#d97706` | Uyarı, bekleyen (Amber) |
| `color.info` | `#2563eb` | Bilgilendirme mesajları (Blue) |
| `color.background` | `#ffffff` (light) / `#0a0a0a` (dark) | Sayfa arka planı |
| `color.surface` | `#ffffff` (light) / `#171717` (dark) | Kart, modal arka planı |
| `color.text.primary` | `#1c1917` (light) / `#fafafa` (dark) | Ana metin |
| `color.text.secondary` | `#78716c` (light) / `#a3a3a3` (dark) | Açıklama, placeholder |
| `color.border` | `#e7e5e4` (light) / `#262626` (dark) | Kenarlık, ayırıcı |

*İleride: Bu değerler `theme.json` veya DB’den okunabilir; marka değişince tek yerden güncellenir.*

---

## 2. Tipografi (Typography)

| Token | Değer | Kullanım |
|-------|--------|----------|
| `font.family` | `'Inter', system-ui, sans-serif` | Tüm uygulama |
| `font.size.xs` | `0.75rem` (12px) | Küçük etiket, badge |
| `font.size.sm` | `0.875rem` (14px) | Form, tablo hücre |
| `font.size.base` | `1rem` (16px) | Body, varsayılan |
| `font.size.lg` | `1.125rem` (18px) | Alt başlık |
| `font.size.xl` | `1.25rem` (20px) | Sayfa başlığı |
| `font.size.2xl` | `1.5rem` (24px) | Büyük başlık |
| `font.weight.normal` | `400` | Body |
| `font.weight.medium` | `500` | Vurgu, buton |
| `font.weight.semibold` | `600` | Başlık |
| `font.weight.bold` | `700` | Önemli vurgu |
| `line.height.tight` | `1.25` | Başlık |
| `line.height.normal` | `1.5` | Body |

---

## 3. Spacing (Boşluklar)

Tailwind ile uyumlu 4px tabanlı scale. Bileşenlerde sabit sayı yerine bu token’lar kullanılır.

| Token | Değer | Kullanım |
|-------|--------|----------|
| `space.0` | `0` | — |
| `space.1` | `0.25rem` (4px) | Çok dar boşluk |
| `space.2` | `0.5rem` (8px) | İkon–metin, küçük padding |
| `space.3` | `0.75rem` (12px) | Input içi, küçük bileşen |
| `space.4` | `1rem` (16px) | Standart padding |
| `space.5` | `1.25rem` (20px) | Kart içi |
| `space.6` | `1.5rem` (24px) | Bölüm arası |
| `space.8` | `2rem` (32px) | Sayfa padding |
| `space.10` | `2.5rem` (40px) | Geniş boşluk |

---

## 4. Border Radius & Shadow

| Token | Değer | Kullanım |
|-------|--------|----------|
| `radius.sm` | `0.25rem` (4px) | Badge |
| `radius.md` | `0.5rem` (8px) | Buton, input, kart (updated from 6px) |
| `radius.lg` | `0.75rem` (12px) | Modal, büyük kart |
| `radius.full` | `9999px` | Yuvarlak avatar, pill |
| `shadow.sm` | `0 1px 2px rgba(0,0,0,0.05)` | Hafif ayrışma |
| `shadow.md` | `0 4px 6px -1px rgba(0,0,0,0.1)` | Kart |
| `shadow.lg` | `0 10px 15px -3px rgba(0,0,0,0.1)` | Modal, dropdown |

---

## 5. Breakpoints (Mobile First)

Önce mobil, sonra tablet/desktop. Tailwind ile uyumlu.

| Token | Değer | Kullanım |
|-------|--------|----------|
| `screen.sm` | `640px` | Küçük tablet |
| `screen.md` | `768px` | Tablet |
| `screen.lg` | `1024px` | Küçük desktop |
| `screen.xl` | `1280px` | Desktop |
| `screen.2xl` | `1536px` | Geniş ekran |

Tüm bileşenler önce `default` (mobil) tasarlanır; `sm:`, `md:` ile yukarı çıkılır.

---

## 6. Projede Kullanım

- **Tailwind:** `tailwind.config.js` içinde `theme.extend` ile bu değerler tanımlanır; class’lar `text-primary`, `rounded-md`, `p-4` vb. kullanır.
- **CSS değişkenleri (isteğe):** `:root` içinde `--color-primary`, `--space-4` vb. tanımlanıp bileşenlerde `var(--color-primary)` kullanılabilir; ileride admin’den tema değişince sadece bu değişkenler güncellenir.

Bu dosya tek kaynak; değişiklik yapılacak yer burası (veya admin tema ekranı).
