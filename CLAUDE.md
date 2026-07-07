# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start Vite dev server (HMR)
npm run build    # Production build to dist/
npm run preview  # Preview production build locally
```

No test runner or linter is configured.

## Deployment

### Frontend — GitHub Pages

Pushes to `main` trigger `.github/workflows/deploy.yml`, which runs `npm ci && npm run build`, copies `dist/index.html` → `dist/404.html` (SPA fallback), and publishes `dist/` via `actions/deploy-pages`.

`npm run build` runs `scripts/prerender.mjs` after `vite build`: it renders `LandingPage` (via `src/prerender-entry.jsx` + `preact-render-to-string`) and injects the static HTML into `dist/index.html`'s `#app` div for SEO. Consequence: the landing page and everything it imports must stay SSR-safe — no `window`/`document`/`navigator` access at module scope or during render (effects are fine). SEO surface lives in `index.html` (meta/OG/JSON-LD) and `public/{robots.txt,sitemap.xml,og-image.png}`.

A hash-allowlisted inline boot script in `index.html` runs before first paint: it applies the saved dark theme and adds `.booting` on `<html>` (hiding the prerendered landing) when the visitor is signed in or on a deep link, so refreshes don't flash the landing snapshot; `main.jsx` removes the class after render. **If you change that script by even one character, recompute its CSP hash** (`printf %s '<script body>' | openssl dgst -sha256 -binary | openssl base64`) and update the `sha256-…` entry in the CSP meta tag. The service worker's `navigateFallbackDenylist` (vite.config.js) keeps browser navigations to `/robots.txt` and `/sitemap.xml` from being hijacked by the SPA fallback — curl/crawlers were never affected, but the SW made them look missing in a browser. The site is served at `https://tunes.nkorobkov.com` (custom domain from `public/CNAME`). No manual deploy step — just merge to `main`.

### Backend — PocketBase

The frontend talks to a self-hosted PocketBase instance at `https://pb.home.nkorobkov.com`. The hosting, SSH access, Docker ops, admin-UI gating, and networking details live in `LOCAL_SETUP.md` (gitignored — personal infra notes).

## Architecture

Preact SPA talking directly to PocketBase (no intermediate backend). All data access is through the PocketBase JS SDK client in `src/lib/pb.js`.

### Auth Flow
`AuthProvider` in `src/lib/auth.jsx` wraps the app. It uses PocketBase's Google OAuth2 provider. The `useAuth()` hook exposes `user`, `loginWithGoogle()`, `logout()`. When not authenticated, the router renders `LoginPage` instead of the app routes.

### Data Model (PocketBase Collections)
Four collections, heavily denormalized:

- **`user_tunes`** — the core record. Holds tune data (title, type, abc, session_id), labels and instrument progress as JSON fields, spaced repetition state (next_review, interval_days, ease_factor, consecutive_correct), and practice_tempo. All CRUD scoped to `user = @request.auth.id`.
- **`attachments`** — per-tune media, related to user_tunes. Each record holds either a `file` (both optional in the schema) or a `url` (YouTube links), plus `type` (sheet_music / recording / backing_track / source / other), `bpm`, `label`, `main_source`. `backing_track` records surface on the practice card; the `main_source` sheet_music record replaces ABC rendering.
- **`practice_log`** — append-only practice history (fluency_rating 1-5, tempo_used, practiced_at). Related to user_tunes.
- **`users`** — built-in auth collection extended with `instruments` JSON field (array of instrument names).

Schema changes ship as PB JS migrations kept in `pocketbase/pb_migrations/` (deployment to the self-hosted instance is described in `LOCAL_SETUP.md`).

Labels are stored as JSON arrays on user_tunes: `[{type: "category", value: "learning"}, {type: "set", value: "Opening Set", order: 1}]`. Tunes sharing the same set name/type form a set. No separate labels or sets table.

### Key Modules

- **`src/lib/spaced-repetition.js`** — SM-2 algorithm. `calculateNextReview(state, rating)` returns new SR fields. `isDue(tune)` and `isNew(tune)` determine practice queue membership.
- **`src/lib/session-api.js`** — calls PocketBase proxy endpoints (`/api/session/search`, `/api/session/tune/:id`) which forward to thesession.org JSON API.
- **`src/lib/abc-utils.js`** — builds full ABC strings with headers from raw ABC + tune metadata. Maps tune types to meters and default tempos.
- **`src/components/common/markdown.jsx`** — renders user-authored markdown (tune notes) via `marked` (GFM, breaks, bare-URL autolink) sanitized with DOMPurify; anchors forced to `target="_blank"`. Typography for the rendered subset lives under `.markdown-body` in `src/index.css`. Notes are edited in place on the tune page (`src/components/tune/tune-notes.jsx`), not through the tune form only.
- **`src/lib/youtube.js`** + **`src/components/common/youtube-embed.jsx`** — YouTube URL parsing (watch/youtu.be/shorts/live/embed, `t=` start times, `shortYouTubeUrl` for display) and a click-to-load embed (thumbnail facade → `youtube-nocookie.com` iframe). Playback speed is deliberately left to the embedded player's own controls — programmatic rate control via the widget postMessage protocol was tried and removed (unreliable in practice; the iframe_api script would violate the CSP anyway). CSP allows `frame-src www.youtube-nocookie.com` and `img-src i.ytimg.com` for this.
- **`src/lib/export-utils.js`** — bulk export builders: title list, concatenated ABC tunebook (placeholder ABC for tunes without notation), and full ZIP archive (folder per tune with ABC, record JSON, practice-history CSV, attachments) via lazy-loaded `fflate`.
- **`src/lib/tunebook-pdf.js`** — tunebook PDF via lazy-loaded `jspdf` + `svg2pdf.js`: renders each tune's ABC to SVG offscreen, measures, paginates up front (so the optional index has exact page numbers), then draws. Tunes without ABC embed their main-source sheet-music attachment when it's an image (fetched → canvas → JPEG); optionally tunes with no notation at all are skipped. Note: don't use abcjs's `scale` option here — it scales via CSS transform which svg2pdf ignores. Print = same PDF opened in a hidden iframe (`frame-src blob:` is allowed in the CSP for this).
- **`src/hooks/use-tunes.js`** — `useTunes()` for list with client-side label filtering, `useTune(id)` for single record.
- **`src/hooks/use-practice.js`** — builds practice queue (due tunes + new tunes), provides `advance()` to move through queue.
- **`src/hooks/use-metronome.js`** — Web Audio API click generator with BPM control.

### UI Conventions
Brand color tokens (`brand-50`…`brand-900`, anchored on the logo green #389833) are defined in `src/index.css` via Tailwind's `@theme`.

**Dark theme**: light is the default (deliberately not system preference); the toggle is on the settings page and persists via localStorage (`src/lib/theme.js`, applied as a `dark` class on `<html>` by the hash-allowlisted boot script in index.html before first paint, and again by `main.jsx` as backup). Dark mode is implemented by remapping the palette CSS variables under `.dark` in `src/index.css`, not by `dark:` variants — write components with normal light-mode utilities and they adapt automatically. Special cases: `bg-white` (card surface) is overridden as a utility because `text-white` must stay white; `brand-600/700` and `red-400`/black are not remapped (button backgrounds), so brand-colored *text* needs an explicit `dark:text-brand-300/400` (a class-based `@custom-variant dark` exists for this); the `theme-light` class restores the light palette for a subtree that is dark-on-light by design (landing page, metronome/record buttons). Sheet music always renders black-on-white: abcjs SVGs use `currentColor`, so `.dark .abc-viewer` pins `background:#fff; color:#000`, and the offscreen PDF-render container in `tunebook-pdf.js` sets `color:#000` for the same reason. Primary buttons, selected chips/tabs, and status accents use `brand-*`. Text links and selection states (checkboxes, selected-card rings, radio highlights) are `blue-600`/`blue-400`; blue is also used for informational callouts (e.g. the learning-mode prompt). Use `src/components/common/button.jsx` (`Button` — primary/secondary/danger/dangerOutline/ghost) and `src/components/common/dialog.jsx` (`Dialog`, `ConfirmDialog`) instead of hand-rolling buttons/modals. Copy uses sentence case for buttons and headings.

### ABC Rendering & Playback
Uses `abcjs` library. `AbcViewer` renders SVG via `abcjs.renderAbc()` with a ref. `AbcPlayer` creates a `CreateSynth` instance for audio playback with tempo control. Both accept an ABC string prop.

### PocketBase SDK Version Note
The SDK is v0.26 but PocketBase server is v0.36. The `getFullList()` method sends `skipTotal=1` which PB 0.36 rejects — use `getList(page, perPage, opts)` instead. Filter strings should be plain strings like `user = "${userId}"`, not `pb.filter()` tagged templates.

### Environment
`VITE_PB_URL` overrides the PocketBase URL (defaults to `https://pb.home.nkorobkov.com`).
