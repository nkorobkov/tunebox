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

The app runs on a Raspberry Pi at `192.168.0.2` via Docker Compose at `/home/nikita/hacking/master-compose/`:

- **Frontend**: nginx container serving `dist/` at `tunes.home.nkorobkov.com` behind Traefik
- **Backend**: PocketBase 0.36 container at `pb.home.nkorobkov.com` with data in `pocketbase_data` Docker volume
- **PB Hooks**: Mounted from `pocketbase/pb_hooks/` — contains `session_proxy.pb.js` for CORS-proxying thesession.org API

To deploy frontend updates: build locally, scp `dist/` to the Pi's `master-compose/tunebox/dist/`, restart the `tunebox` container.

The Docker network is named `traefic` (note the typo — maintain consistency). Cert resolver uses `${PROVIDER}` (Route53 DNS challenge).

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
- **`src/hooks/use-tunes.js`** — `useTunes()` for list with client-side label filtering, `useTune(id)` for single record.
- **`src/hooks/use-practice.js`** — builds practice queue (due tunes + new tunes), provides `advance()` to move through queue.
- **`src/hooks/use-metronome.js`** — Web Audio API click generator with BPM control.

### ABC Rendering & Playback
Uses `abcjs` library. `AbcViewer` renders SVG via `abcjs.renderAbc()` with a ref. `AbcPlayer` creates a `CreateSynth` instance for audio playback with tempo control. Both accept an ABC string prop.

### PocketBase SDK Version Note
The SDK is v0.26 but PocketBase server is v0.36. The `getFullList()` method sends `skipTotal=1` which PB 0.36 rejects — use `getList(page, perPage, opts)` instead. Filter strings should be plain strings like `user = "${userId}"`, not `pb.filter()` tagged templates.

### Environment
`VITE_PB_URL` overrides the PocketBase URL (defaults to `https://pb.home.nkorobkov.com`).
