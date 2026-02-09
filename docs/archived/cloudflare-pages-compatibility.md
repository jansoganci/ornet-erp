# Cloudflare Pages Deployment Compatibility

## Compatibility: **YES**

Your stack is compatible with Cloudflare Pages. No backend runs on Cloudflare; you deploy a static Vite build and call Supabase from the browser.

---

## 1. Vite + React on Cloudflare Pages

**Compatible.** Cloudflare Pages runs `npm run build` and serves the `dist` folder. Vite produces static HTML/JS/CSS—no server runtime required.

---

## 2. Build Config

**No changes required.** Your `vite.config.js` is fine. Optional: set explicit output dir so Cloudflare knows where to look (default is already `dist`):

```js
// vite.config.js – optional, dist is already default
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { outDir: 'dist' },
})
```

---

## 3. Environment Variables

**Works.** Vite inlines `import.meta.env.VITE_*` at build time. In Cloudflare Pages:

1. **Dashboard:** Project → **Settings** → **Environment variables**
2. Add:
   - `VITE_SUPABASE_URL` = your Supabase project URL  
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key  

Use the same names as in `.env` locally. Cloudflare injects them during the build.

---

## 4. Dependencies on Cloudflare

**No issues.** All your deps run in the browser:

- React, Vite, Tailwind, i18next, React Query, Supabase JS, react-router-dom, etc. are client-side only.  
- No Node-only packages (no `fs`, `path`, server APIs) in `src`.

---

## 5. Supabase API Calls

**Works.** Requests go from the user’s browser → Supabase. Cloudflare only serves static files; CORS is between browser and Supabase. Ensure your Supabase project allows your Cloudflare Pages URL in **Authentication → URL Configuration** (Redirect URLs) if you use auth redirects.

---

## 6. SPA Routing

**Required:** Cloudflare must serve `index.html` for all paths so React Router can handle `/customers`, `/tasks`, etc.  
Add a redirect rule so every request falls back to `/index.html`.

---

## Required Changes

| Item | Action |
|------|--------|
| SPA fallback | Add `public/_redirects` (see below) so all routes → `/index.html`. |

---

## Deployment Steps

1. **Repo:** Push code to GitHub/GitLab.
2. **Cloudflare:** **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → select repo.
3. **Build settings:**
   - **Framework preset:** None (or “Vite” if listed).
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** leave empty unless the app is in a subfolder.
4. **Env vars:** Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in **Settings → Environment variables** (for Production and/or Preview if needed).
5. **Deploy:** Save; Cloudflare will build and deploy. Your app URL will be `https://<project>.pages.dev`.

---

## Potential Issues

| Issue | Mitigation |
|-------|------------|
| **Deep links / refresh 404** | Fixed by `_redirects` (all routes → `/index.html`). |
| **Auth redirect URL** | Add `https://<project>.pages.dev/**` (and custom domain) in Supabase **Auth → URL Configuration**. |
| **Preview branches** | Each branch gets its own URL. Use the same Supabase project or separate env vars per branch if needed. |
| **Build time** | Cold builds can be ~1–2 min. No code change; optional: caching or smaller `node_modules`. |
| **Large bundle** | Use Vite’s code splitting as you do; no Cloudflare-specific change. |

---

## Summary

- **Compatibility:** YES.  
- **Required:** Add `public/_redirects` for SPA routing.  
- **Config:** Default Vite build; set env vars in Cloudflare dashboard.  
- **Supabase:** Works from the client; configure redirect URLs in Supabase for auth.
