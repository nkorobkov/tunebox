---
name: verify
description: How to verify tunebox frontend changes end-to-end without real PocketBase credentials — drive the app in headless Chromium with the PB API mocked at the network layer.
---

# Verifying tunebox changes

The app needs Google OAuth against the real PocketBase (`pb.home.nkorobkov.com`),
which is impossible headlessly. Instead, drive the real frontend with the PB API
mocked via Playwright route interception. All app logic (rendering, exports, PDF
generation, bulk ops) runs for real; only the network is fake.

## Recipe

1. `npm run dev` (background) — serves on `http://localhost:5173`.
2. Playwright lives in the npx cache, not the repo. Symlink it into the script dir:
   `ln -sfn $(dirname $(npx which playwright))/../.. node_modules` — or find it via
   `npx which playwright`. Chromium browsers are in `~/Library/Caches/ms-playwright`.
3. Fake auth: seed localStorage **before page load** (`addInitScript`) with key
   `pocketbase_auth` = `{ token, record }`. The token just needs a parseable JWT
   payload with a far-future `exp` — the SDK only checks exp locally:
   `b64url({alg:'HS256'}) + '.' + b64url({exp: 4102444800, id, type:'auth'}) + '.sig'`.
4. Mock `https://pb.home.nkorobkov.com/**` with `context.route`. Endpoints the app hits:
   - `POST .../users/auth-refresh` → `{ token, record }` (fired on every app load)
   - `GET /api/collections/user_tunes/records` → `{ page, perPage, totalItems, totalPages, items }`
   - `PATCH|DELETE /api/collections/user_tunes/records/:id`
   - `GET /api/collections/{practice_log,attachments}/records` (filter param has `user_tune = "id"`)
   - `GET /api/files/**` → raw bytes
   Record PATCH/DELETE calls in arrays to assert request bodies.
5. Abort `gc.zgo.at` requests (goatcounter; its dev-mode CSP console error is pre-existing noise).

A complete working harness from the bulk-edit feature verification (mock data,
selectors, download capture, PDF/zip assertions) can be recreated from this recipe;
see git history of the bulk-edit feature for what it covered.

## Gotchas

- Tune titles render twice per card (desktop + mobile layouts) — use `.first()`
  or strict-mode violations abound.
- Downloads: `page.waitForEvent('download')` + `dl.saveAs()`; context needs
  `acceptDownloads: true`.
- Inspect generated PDFs: `qlmanage -t -s 1200 -o dir file.pdf` rasterizes page 1
  (only page 1); `grep -ao '/Count [0-9]*' file.pdf` gives the page count.
- Zip contents: `unzip -l file.zip`.
- index.html has a strict CSP (meta tag) — new resource types (iframes, workers,
  external hosts) will be silently blocked; watch the console for violations.
- abcjs's `scale` option applies a CSS transform on the svg and no viewBox —
  measure via width/height attributes, not getBoundingClientRect, when feeding svg2pdf.
