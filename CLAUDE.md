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

Pushes to `main` trigger `.github/workflows/deploy.yml`, which runs `npm ci && npm run build`, copies `dist/index.html` → `dist/404.html` (SPA fallback), and publishes `dist/` via `actions/deploy-pages`. The site is served at `https://tunes.nkorobkov.com` (custom domain from `public/CNAME`). No manual deploy step — just merge to `main`.

### Backend — PocketBase

The frontend talks to a self-hosted PocketBase instance at `https://pb.home.nkorobkov.com`. The hosting, SSH access, Docker ops, admin-UI gating, and networking details live in `LOCAL_SETUP.md` (gitignored — personal infra notes).

## Architecture

Preact SPA talking directly to PocketBase (no intermediate backend). All data access is through the PocketBase JS SDK client in `src/lib/pb.js`.

### Auth Flow
`AuthProvider` in `src/lib/auth.jsx` wraps the app. It uses PocketBase's Google OAuth2 provider. The `useAuth()` hook exposes `user`, `loginWithGoogle()`, `logout()`. When not authenticated, the router renders `LoginPage` instead of the app routes.

### Data Model (PocketBase Collections)
Three collections, heavily denormalized:

- **`user_tunes`** — the core record. Holds tune data (title, type, abc, session_id), labels and instrument progress as JSON fields, spaced repetition state (next_review, interval_days, ease_factor, consecutive_correct), practice_tempo, and file attachments. All CRUD scoped to `user = @request.auth.id`.
- **`practice_log`** — append-only practice history (fluency_rating 1-5, tempo_used, practiced_at). Related to user_tunes.
- **`users`** — built-in auth collection extended with `instruments` JSON field (array of instrument names).

Labels are stored as JSON arrays on user_tunes: `[{type: "category", value: "learning"}, {type: "set", value: "Opening Set", order: 1}]`. Tunes sharing the same set name/type form a set. No separate labels or sets table.

### Key Modules

- **`src/lib/spaced-repetition.js`** — SM-2 algorithm. `calculateNextReview(state, rating)` returns new SR fields. `isDue(tune)` and `isNew(tune)` determine practice queue membership.
- **`src/lib/session-api.js`** — calls PocketBase proxy endpoints (`/api/session/search`, `/api/session/tune/:id`) which forward to thesession.org JSON API.
- **`src/lib/abc-utils.js`** — builds full ABC strings with headers from raw ABC + tune metadata. Maps tune types to meters and default tempos.
- **`src/lib/export-utils.js`** — bulk export builders: title list, concatenated ABC tunebook (placeholder ABC for tunes without notation), and full ZIP archive (folder per tune with ABC, record JSON, practice-history CSV, attachments) via lazy-loaded `fflate`.
- **`src/lib/tunebook-pdf.js`** — tunebook PDF via lazy-loaded `jspdf` + `svg2pdf.js`: renders each tune's ABC to SVG offscreen, measures, paginates up front (so the optional index has exact page numbers), then draws. Tunes without ABC embed their main-source sheet-music attachment when it's an image (fetched → canvas → JPEG); optionally tunes with no notation at all are skipped. Note: don't use abcjs's `scale` option here — it scales via CSS transform which svg2pdf ignores. Print = same PDF opened in a hidden iframe (`frame-src blob:` is allowed in the CSP for this).
- **`src/hooks/use-tunes.js`** — `useTunes()` for list with client-side label filtering, `useTune(id)` for single record.
- **`src/hooks/use-practice.js`** — builds practice queue (due tunes + new tunes), provides `advance()` to move through queue.
- **`src/hooks/use-metronome.js`** — Web Audio API click generator with BPM control.

### UI Conventions
Brand color tokens (`brand-50`…`brand-900`, anchored on the logo green #389833) are defined in `src/index.css` via Tailwind's `@theme`. Primary buttons, selected chips/tabs, and status accents use `brand-*`. Text links and selection states (checkboxes, selected-card rings, radio highlights) are `blue-600`/`blue-400`; blue is also used for informational callouts (e.g. the learning-mode prompt). Use `src/components/common/button.jsx` (`Button` — primary/secondary/danger/dangerOutline/ghost) and `src/components/common/dialog.jsx` (`Dialog`, `ConfirmDialog`) instead of hand-rolling buttons/modals. Copy uses sentence case for buttons and headings.

### ABC Rendering & Playback
Uses `abcjs` library. `AbcViewer` renders SVG via `abcjs.renderAbc()` with a ref. `AbcPlayer` creates a `CreateSynth` instance for audio playback with tempo control. Both accept an ABC string prop.

### PocketBase SDK Version Note
The SDK is v0.26 but PocketBase server is v0.36. The `getFullList()` method sends `skipTotal=1` which PB 0.36 rejects — use `getList(page, perPage, opts)` instead. Filter strings should be plain strings like `user = "${userId}"`, not `pb.filter()` tagged templates.

### Environment
`VITE_PB_URL` overrides the PocketBase URL (defaults to `https://pb.home.nkorobkov.com`).
