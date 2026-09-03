# Spotify Playlist Manager

A fully functional Spotify Playlist Manager SPA built with **TypeScript + Vite** and the **Spotify Web API**.

---

## Features

| Feature | Details |
|---|---|
| **Authentication** | Authorization Code with PKCE — no client secret exposed in the browser |
| **Playlist List** | All user playlists with cover image, name, and track count (fully paginated) |
| **Playlist Detail** | Full track list with name, artist(s), album, added-at date |
| **Duplicate Detection** | Toggle to highlight/isolate tracks that appear more than once (by Spotify track ID) |
| **Compare Two Playlists** | Side-by-side view with colour-coded exclusive / shared tracks |
| **Track Transfer** | Select exclusive tracks and add them to the other playlist; refreshes automatically |

---

## Quick Start

### 1. Create a Spotify App

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) and create an app.
2. In the app settings, add the following **Redirect URI**:
   ```
   http://127.0.0.1:5173/callback
   ```
   > Use HTTPS in production. `http://localhost` is **not** accepted — use `127.0.0.1`.

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
VITE_SPOTIFY_CLIENT_ID=your_client_id_here
VITE_SPOTIFY_REDIRECT_URI=http://127.0.0.1:5173/callback
VITE_SPOTIFY_SCOPES=playlist-read-private playlist-read-collaborative playlist-modify-public playlist-modify-private
```

> `.env` is git-ignored. Never commit real credentials.

### 3. Install and run

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173) in your browser.

### 4. Production build

```bash
npm run build        # outputs to dist/
npm run preview      # preview the production build locally
```

---

## Project Structure

```
spotify-playlist-manager/
├── src/
│   ├── auth/
│   │   ├── auth.ts        # PKCE flow: redirect, callback, token refresh
│   │   ├── pkce.ts        # code_verifier / code_challenge helpers
│   │   └── storage.ts     # sessionStorage-backed token persistence
│   ├── api/
│   │   ├── client.ts      # Authenticated HTTP client, 429 backoff, error handling
│   │   ├── playlists.ts   # Playlist & track API calls with full pagination
│   │   └── types.ts       # Spotify API response type definitions
│   ├── views/
│   │   ├── playlistList.ts    # Playlist grid view
│   │   ├── playlistDetail.ts  # Track table + duplicate detection
│   │   └── compare.ts         # Side-by-side comparison + transfer
│   ├── router.ts          # Minimal in-memory router
│   ├── main.ts            # App entry point
│   └── style.css          # Global dark-theme styles
├── index.html
├── .env.example           # Environment variable template
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Scopes Used

| Scope | Why |
|---|---|
| `playlist-read-private` | Read the user's private playlists |
| `playlist-read-collaborative` | Read collaborative playlists |
| `playlist-modify-public` | Add tracks to public playlists |
| `playlist-modify-private` | Add tracks to private playlists |

Only the minimum scopes required for the implemented features are requested.

---

## Security Notes

- **PKCE** — No client secret is ever present in the browser bundle.
- **sessionStorage** — Tokens are cleared when the tab closes. Not persisted to `localStorage`.
- **CSRF protection** — A random `state` parameter is validated on every OAuth callback.
- **No hardcoded credentials** — All configuration is loaded from `.env` via `import.meta.env`.
- **HTTPS redirect URIs** — `http://127.0.0.1` is used for local dev per the Spotify requirements. Production deployments must use HTTPS.

---

## API Compliance

- Uses **Authorization Code with PKCE** (not Implicit Grant, which is deprecated).
- Pagination: reads `total` on the first page, fetches remaining pages in parallel.
- Uses `/playlists/{id}/items` (not the deprecated `/playlists/{id}/tracks`).
- Rate limiting: exponential backoff respecting the `Retry-After` header on HTTP 429.
- All paths and response schemas sourced from the [Spotify OpenAPI spec](https://developer.spotify.com/reference/web-api/open-api-schema.yaml).

---

## Attribution

Music data and authentication provided by **Spotify**. This application complies with the [Spotify Developer Terms of Service](https://developer.spotify.com/terms).
