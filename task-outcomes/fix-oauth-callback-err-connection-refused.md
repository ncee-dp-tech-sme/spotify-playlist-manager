# Fix ERR_CONNECTION_REFUSED on Spotify OAuth callback

**Prompt:** using npm dev and npm dev --host both fail when I log in and authorize with spotify, I get a ERR_CONNECTION_REFUSED on the callback url
**Timestamp:** Thu Sep  3 23:37:25 CEST 2026

---

## Root Cause

Spotify redirects to `http://127.0.0.1:5173/callback?code=…` after authorization.
Vite's dev server had no handler for the `/callback` path — it only served `index.html` at `/`.
The request to `/callback` returned a 404/connection error before the app (and its auth handler) ever loaded.

Additionally, the callback detection in `src/main.ts` only checked for `?code=` query params on any path,
which could trigger a false-positive token exchange on other pages that happened to carry a `code` param.

## Fixes Applied

### `vite.config.ts`
Set `appType: 'spa'` (the correct Vite 8 API), which configures the dev server to serve `index.html`
for all unmatched paths — including `/callback`.

### `src/main.ts` (line 45)
Tightened callback detection to also require `pathname === '/callback'`:

```ts
// Before
const isCallback = url.searchParams.has('code') || url.searchParams.has('error');

// After
const isCallback =
  url.pathname === '/callback' &&
  (url.searchParams.has('code') || url.searchParams.has('error'));
```

## Validation

`npm run build` — TypeScript + Vite build: ✅ no errors or warnings.

## Manual Step Required

Ensure `http://127.0.0.1:5173/callback` is registered as an allowed Redirect URI in the
[Spotify Developer Dashboard](https://developer.spotify.com/dashboard) for your app.
