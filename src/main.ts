// src/main.ts
// Application entry point — bootstraps auth, then drives the router.
// Thu Sep  3 23:19:57 CEST 2026
// Changelog:
//   Thu Sep  3 23:37:25 CEST 2026 — tightened callback detection to require pathname '/callback' to prevent false-positive token exchanges

import { handleCallback, logout, redirectToSpotifyAuth, validateEnv } from './auth/auth.js';
import { loadTokens } from './auth/storage.js';
import { registerRouteHandler } from './router.js';
import { renderCompare } from './views/compare.js';
import { renderPlaylistDetail } from './views/playlistDetail.js';
import { renderPlaylistList } from './views/playlistList.js';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app')!;

async function main(): Promise<void> {
  // 1. Validate environment configuration at startup
  try {
    validateEnv();
  } catch (err) {
    renderFatal(err instanceof Error ? err.message : String(err));
    return;
  }

  // 2. Register the route handler
  registerRouteHandler(async (route) => {
    switch (route.name) {
      case 'list':
        await renderPlaylistList(app);
        break;
      case 'detail':
        await renderPlaylistDetail(app, route.playlistId);
        break;
      case 'compare':
        await renderCompare(app);
        break;
      case 'logout':
        logout();
        renderLogin();
        break;
    }
  });

  // 3. Determine the initial view based on URL + stored tokens
  const url = new URL(window.location.href);
  const isCallback =
    url.pathname === '/callback' &&
    (url.searchParams.has('code') || url.searchParams.has('error'));

  if (isCallback) {
    // OAuth callback: exchange code for tokens
    app.innerHTML = '<div class="loading">Completing sign-in…</div>';
    try {
      await handleCallback();
      // Remove the code/state from the URL to avoid re-use on refresh
      window.history.replaceState({}, '', '/');
    } catch (err) {
      renderError(err instanceof Error ? err.message : String(err));
      return;
    }
    await renderPlaylistList(app);
    return;
  }

  // 4. Check for an existing session
  const tokens = loadTokens();
  if (tokens) {
    await renderPlaylistList(app);
  } else {
    renderLogin();
  }
}

function renderLogin(): void {
  app.innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <div class="spotify-logo">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="#1DB954" aria-label="Spotify">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.495 17.316a.75.75 0 01-1.03.248c-2.82-1.723-6.37-2.112-10.553-1.157a.75.75 0 11-.334-1.462c4.577-1.046 8.502-.596 11.67 1.34a.75.75 0 01.247 1.031zm1.467-3.261a.937.937 0 01-1.287.31c-3.226-1.983-8.145-2.558-11.963-1.4a.937.937 0 11-.545-1.793c4.362-1.326 9.786-.683 13.486 1.596a.937.937 0 01.309 1.287zm.126-3.397c-3.868-2.297-10.245-2.509-13.937-1.388a1.124 1.124 0 11-.652-2.153c4.247-1.287 11.305-1.038 15.76 1.606a1.124 1.124 0 01-1.17 1.935z"/>
          </svg>
        </div>
        <h1>Spotify Playlist Manager</h1>
        <p>View, compare, and manage your Spotify playlists.</p>
        <p class="login-attribution">Powered by <strong>Spotify</strong></p>
        <button id="btn-login" class="btn btn-primary btn-large">Connect with Spotify</button>
      </div>
    </div>
  `;
  document.querySelector('#btn-login')!.addEventListener('click', () => {
    redirectToSpotifyAuth();
  });
}

function renderError(message: string): void {
  app.innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <div class="error">${escapeText(message)}</div>
        <button id="btn-retry" class="btn btn-primary" style="margin-top:1rem">Try Again</button>
      </div>
    </div>
  `;
  document.querySelector('#btn-retry')!.addEventListener('click', () => renderLogin());
}

function renderFatal(message: string): void {
  app.innerHTML = `<div class="login-screen"><div class="login-card"><div class="error"><strong>Configuration error:</strong><br>${escapeText(message)}</div></div></div>`;
}

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

main();
