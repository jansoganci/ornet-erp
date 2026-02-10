# Dashboard Redesign – Steve Jobs Style (Option 3 + Option 2)

## Design decisions

1. **Option 3 – Above / below the fold**
   - **Top:** Welcome + date (one line) → 6 KPI cards (compact, same style).
   - **Bottom:** Two columns: **left** = combined "To-do" (today’s schedule + open tasks); **right** = Quick actions (one primary CTA + 4 secondary).

2. **Combined block: Today’s program + Pending/Open tasks**
   - One section title: **"Yapılacaklar"** (or "Bugün & Görevler").
   - One list, same card style for every row:
     - **Work order rows:** `09:00 · Müşteri adı · İş emri başlığı` (tap → work order detail).
     - **Task rows:** `○ Görev başlığı · 10.02.2026` (tap circle → toggle complete; tap row → task detail/edit).
   - Order: today’s schedule first (by time), then open tasks (e.g. by due date). Optional: very light separator or small label "Açık görevler" before the first task.
   - One "Tümünü gör" that either goes to work-orders (or a combined page) or we show two small links: "İş emirleri" | "Görevler".

3. **Option 2 – One primary CTA, rest secondary**
   - **Right column:** One prominent action (e.g. **"İş emri oluştur"**) – primary button or single emphasized card.
   - Below it, 4 actions in the **same visual language** as the left column (minimal rows: icon + label, same border/padding as list rows). No big buttons; same "row" feel so the whole dashboard is one system.

---

## Wireframe (ASCII)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Hoş geldiniz, [user] · 9 Şubat 2026 Pazartesi                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────┐
│ Bugün│ │Bekleyen│ │ Açık │ │Toplam│ │ Aktif │ │ Tahmini  │
│  0   │ │   2   │ │  3   │ │  4   │ │ hat 0 │ │ aylık kar│
└──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────────┘
   ↑ 6 stat cards: same height, no icon box (or icon right/tiny). One neutral style.

┌─────────────────────────────────────────────┬───────────────────────────────────┐
│  Yapılacaklar                    Tümünü gör │  ┌─────────────────────────────┐  │
├─────────────────────────────────────────────┤  │  İş emri oluştur   (primary) │  │
│  09:00 · Acme Ltd · Montaj · Keşif      →  │  └─────────────────────────────┘  │
│  11:30 · Beta A.Ş. · Servis bakımı       →  │  Müşteri ekle                   │  │
│  14:00 · Gamma · Yeni kurulum            →  │  Görev ekle                      │  │
│  ─────────────────────────────────────────  │  Günlük işler                    │  │
│  ○ Çöp atılacak · 10.02                    │  İş geçmişi                      │  │
│  ○ Falan · 11.02                           │  (same row style as left list)   │  │
│  ○ deneme · 12.02                          │                                   │  │
└─────────────────────────────────────────────┴───────────────────────────────────┘
   ↑ One list, same card per row. Work orders then tasks.    ↑ One hero CTA, then 4 rows.
```

---

## Layout specs (for implementation)

| Zone | Content | Notes |
|------|--------|--------|
| **Header** | `Hoş geldiniz, {user}` + ` · ` + date | One line, `text-base`, no big gap below. |
| **KPI row** | 6 StatCards | Grid `2 cols` mobile, `3` tablet, `6` desktop. No icon box; number + label only, or tiny icon right. |
| **Left column** | Title "Yapılacaklar" + "Tümünü gör" | `text-sm font-semibold`. |
| **Left column** | List items | Same card: `p-3`, border, one row. Work order: time · customer · title + chevron. Task: circle + title + due date. |
| **Right column** | Primary CTA | One button/card: "İş emri oluştur" (or chosen hero action). Slightly taller or primary color. |
| **Right column** | 4 secondary actions | Same row style as left (icon + label), no heavy button. |

---

## Primary CTA choice

Recommendation: **"İş emri oluştur"** as the hero (most frequent action for site manager). If "Müşteri ekle" is more common, use that. One hero, rest secondary.

---

## Wireframe image

![Dashboard wireframe](../../.cursor/projects/Users-jans-Downloads-Projelerim-ornet-erp/assets/dashboard-wireframe.png)

(Also saved at: `.cursor/projects/.../assets/dashboard-wireframe.png` – open in IDE or file explorer.)

## File reference

- Implementation: `src/pages/DashboardPage.jsx`, `src/features/dashboard/StatCard.jsx`
