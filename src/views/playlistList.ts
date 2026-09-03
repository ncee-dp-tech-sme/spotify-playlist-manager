// src/views/playlistList.ts
// Playlist List View — renders all user playlists with cover, name, track count.
// Thu Sep  3 23:19:57 CEST 2026
// Fri Sep  4 00:20:03 CEST 2026 — show playlist names as expandable list rows with inline tracks
// Fri Sep  4 00:51:35 CEST 2026 — mark playlists not owned by current user as "Owned by another user" and remove option to show details

import { fetchAllPlaylistItems, fetchAllUserPlaylists, getCurrentUserProfile } from '../api/playlists.js';
import type { PlaylistItem, SimplifiedPlaylist, SpotifyUserProfile } from '../api/types.js';
import { navigate } from '../router.js';

/** Render the playlist list into #app. Returns the playlist array for reuse. */
export async function renderPlaylistList(container: HTMLElement): Promise<SimplifiedPlaylist[]> {
  container.innerHTML = `
    <header class="app-header">
      <h1>🎵 Spotify Playlist Manager</h1>
      <div class="header-actions">
        <button id="btn-compare" class="btn btn-secondary">Compare Playlists</button>
        <button id="btn-logout" class="btn btn-ghost">Log out</button>
      </div>
    </header>
    <main>
      <div class="loading">Loading your playlists…</div>
    </main>
  `;

  const main = container.querySelector('main')!;

  // Wire header buttons before async work
  container.querySelector('#btn-logout')!.addEventListener('click', () => {
    navigate('logout');
  });
  container.querySelector('#btn-compare')!.addEventListener('click', () => {
    navigate('compare');
  });

  let playlists: SimplifiedPlaylist[] = [];
  let currentUser: SpotifyUserProfile | null = null;
  try {
    const [fetchedPlaylists, userProfile] = await Promise.all([
      fetchAllUserPlaylists(),
      getCurrentUserProfile(),
    ]);
    playlists = fetchedPlaylists;
    currentUser = userProfile;
  } catch (err) {
    main.innerHTML = `<div class="error">${escapeHtml(errorMessage(err))}</div>`;
    return [];
  }

  if (playlists.length === 0) {
    main.innerHTML = `<p class="empty">No playlists found in your library.</p>`;
    return [];
  }

  main.innerHTML = `
    <div class="section-title">Your Playlists <span class="badge">${playlists.length}</span></div>
    <div class="playlist-list" id="playlist-list"></div>
  `;

  const list = main.querySelector('#playlist-list')!;
  for (const pl of playlists) {
    list.appendChild(buildPlaylistRow(pl, currentUser));
  }

  return playlists;
}

/** Build a single playlist row with an expand/collapse toggle for tracks. */
function buildPlaylistRow(pl: SimplifiedPlaylist, currentUser: SpotifyUserProfile | null): HTMLElement {
  const row = document.createElement('div');
  row.className = 'playlist-row';
  row.dataset['playlistId'] = pl.id;

  const isOwned = !currentUser || pl.owner.id === currentUser.id;
  const imgUrl = (pl.images ?? [])[0]?.url ?? '';
  const trackCount = pl.items.total;

  row.innerHTML = `
    <div class="playlist-row-header">
      <div class="playlist-row-cover">
        ${imgUrl
          ? `<img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(pl.name)} cover" loading="lazy" />`
          : '<div class="no-cover-sm">♪</div>'}
      </div>
      <div class="playlist-row-info">
        <span class="playlist-row-name">${escapeHtml(pl.name)}</span>
        <span class="playlist-row-meta">
          ${trackCount} track${trackCount !== 1 ? 's' : ''}
          ${!isOwned ? '<span class="badge badge-unowned">Owned by another user</span>' : ''}
        </span>
      </div>
      <div class="playlist-row-actions">
        ${
          isOwned
            ? `<button class="btn btn-ghost btn-sm btn-expand" aria-expanded="false" title="Show tracks">▶</button>
               <button class="btn btn-ghost btn-sm btn-detail" title="Open playlist">Open</button>`
            : ''
        }
      </div>
    </div>
    ${isOwned ? '<div class="playlist-row-tracks" hidden></div>' : ''}
  `;

  if (isOwned) {
    const expandBtn = row.querySelector<HTMLButtonElement>('.btn-expand');
    const tracksEl = row.querySelector<HTMLElement>('.playlist-row-tracks');

    if (expandBtn && tracksEl) {
      expandBtn.addEventListener('click', async () => {
        const isOpen = expandBtn.getAttribute('aria-expanded') === 'true';
        if (isOpen) {
          expandBtn.setAttribute('aria-expanded', 'false');
          expandBtn.textContent = '▶';
          tracksEl.hidden = true;
        } else {
          expandBtn.setAttribute('aria-expanded', 'true');
          expandBtn.textContent = '▼';
          tracksEl.hidden = false;
          // Load tracks only on first expand
          if (!tracksEl.dataset['loaded']) {
            tracksEl.innerHTML = '<div class="loading loading-inline">Loading tracks…</div>';
            try {
              const items = await fetchAllPlaylistItems(pl.id);
              tracksEl.innerHTML = buildTrackList(items);
              tracksEl.dataset['loaded'] = '1';
            } catch (err) {
              tracksEl.innerHTML = `<div class="error">${escapeHtml(errorMessage(err))}</div>`;
            }
          }
        }
      });
    }

    const detailBtn = row.querySelector('.btn-detail');
    if (detailBtn) {
      detailBtn.addEventListener('click', () => {
        navigate('detail', { playlistId: pl.id });
      });
    }
  }

  return row;
}

/** Build a compact inline track list for the expanded row. */
function buildTrackList(items: PlaylistItem[]): string {
  if (items.length === 0) return '<p class="empty">No tracks in this playlist.</p>';

  const rows = items
    .map((item, idx) => {
      const track = item.item;
      if (!track) {
        return `<tr class="track-unavailable"><td class="col-num">${idx + 1}</td><td colspan="2"><em>Unavailable track</em></td></tr>`;
      }
      const artists = track.artists.map((a) => escapeHtml(a.name)).join(', ');
      return `
        <tr>
          <td class="col-num">${idx + 1}</td>
          <td class="col-title" title="${escapeHtml(track.name)}">${escapeHtml(track.name)}</td>
          <td class="col-artist" title="${artists}">${artists}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <div class="table-wrapper table-wrapper-inline">
      <table class="track-table">
        <thead><tr><th>#</th><th>Title</th><th>Artist(s)</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
