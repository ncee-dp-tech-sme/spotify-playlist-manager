// vite.config.ts
// Changelog:
//   Thu Sep  3 23:37:25 CEST 2026 — set appType:'spa' so Vite serves index.html for all paths (SPA /callback support)
//   Thu Sep  3 23:43:17 CEST 2026 — pin dev server to port 5173 with strictPort so it always matches the Spotify redirect URI
//   Thu Sep  3 23:44:00 CEST 2026 — bind explicitly to 127.0.0.1 (IPv4) so the redirect URI host resolves correctly

import { defineConfig } from 'vite';

export default defineConfig({
  // env variables prefixed with VITE_ are exposed to the client bundle
  envPrefix: 'VITE_',
  // Serve index.html for all unmatched paths so the SPA router handles /callback
  appType: 'spa',
  server: {
    // Pin to 5173 so the dev URL always matches VITE_SPOTIFY_REDIRECT_URI.
    // strictPort: true makes Vite error instead of silently shifting to the
    // next free port (which would break the OAuth callback).
    port: 5173,
    strictPort: true,
    // Bind to IPv4 loopback explicitly. Without this, Vite binds to the IPv6
    // loopback (::1/localhost) on macOS, but the redirect URI uses 127.0.0.1
    // (IPv4), causing ERR_CONNECTION_REFUSED on the OAuth callback.
    host: '127.0.0.1',
  },
});
