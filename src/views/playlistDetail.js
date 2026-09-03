// src/views/playlistDetail.ts
// Playlist Detail View — shows all tracks, with duplicate detection toggle and remove duplicates option.
// Thu Sep  3 23:19:57 CEST 2026
// Fri Sep  4 00:51:35 CEST 2026 — add remove duplicates button and flow
import { fetchAllPlaylistItems, removeDuplicateTracksFromPlaylist } from '../api/playlists.js';
import { navigate } from '../router.js';
import { escapeHtml, errorMessage } from './playlistList.js';
/** Render the playlist detail view for the given playlistId. */
export async function renderPlaylistDetail(container, playlistId) {
    container.innerHTML = `
    <header class="app-header">
      <button id="btn-back" class="btn btn-ghost">← Back</button>
      <h1>Playlist Tracks</h1>
      <div class="header-actions">
        <label class="toggle-label">
          <input type="checkbox" id="toggle-dupes" />
          Show Duplicates Only
        </label>
        <button id="btn-remove-dupes" class="btn btn-secondary" style="display: none;">Remove Duplicates</button>
      </div>
    </header>
    <main>
      <div class="loading">Loading tracks…</div>
    </main>
  `;
    container.querySelector('#btn-back').addEventListener('click', () => navigate('list'));
    await loadAndRenderDetails(container, playlistId);
}
/**
 * Load playlist tracks and render the table view with duplicate actions.
 * Fri Sep  4 00:51:35 CEST 2026
 */
async function loadAndRenderDetails(container, playlistId) {
    const main = container.querySelector('main');
    let items = [];
    try {
        items = await fetchAllPlaylistItems(playlistId);
    }
    catch (err) {
        main.innerHTML = `<div class="error">${escapeHtml(errorMessage(err))}</div>`;
        return;
    }
    // Identify duplicate track IDs (appear more than once in the playlist)
    const idCount = new Map();
    for (const item of items) {
        const id = item.item?.id;
        if (id)
            idCount.set(id, (idCount.get(id) ?? 0) + 1);
    }
    const duplicateIds = new Set([...idCount.entries()].filter(([, count]) => count > 1).map(([id]) => id));
    const totalTracks = items.length;
    const duplicateGroupItemsCount = items.filter((i) => i.item?.id && duplicateIds.has(i.item.id)).length;
    const redundantDuplicatesCount = items.reduce((acc, item) => {
        const id = item.item?.id;
        return id && duplicateIds.has(id) ? acc + 1 : acc;
    }, 0) - duplicateIds.size;
    main.innerHTML = `
    <div class="section-title">
      ${totalTracks} track${totalTracks !== 1 ? 's' : ''}
      ${duplicateGroupItemsCount > 0 ? `<span class="badge badge-warn">${duplicateGroupItemsCount} in duplicate groups (${redundantDuplicatesCount} redundant)</span>` : ''}
    </div>
    <div id="detail-status"></div>
    <div class="table-wrapper">
      <table class="track-table" id="track-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Title</th>
            <th>Artist(s)</th>
            <th>Album</th>
            <th>Added</th>
          </tr>
        </thead>
        <tbody id="track-tbody"></tbody>
      </table>
    </div>
  `;
    const tbody = main.querySelector('#track-tbody');
    renderRows(tbody, items, duplicateIds, false);
    // Toggle: show only duplicate tracks
    const toggleDupes = container.querySelector('#toggle-dupes');
    toggleDupes.checked = false;
    toggleDupes.onchange = () => {
        renderRows(tbody, items, duplicateIds, toggleDupes.checked);
    };
    const removeDupesBtn = container.querySelector('#btn-remove-dupes');
    if (redundantDuplicatesCount > 0) {
        removeDupesBtn.style.display = 'inline-flex';
        removeDupesBtn.onclick = async () => {
            const confirmRemove = window.confirm(`Are you sure you want to remove ${redundantDuplicatesCount} duplicate track occurrence(s) from this playlist? Unique tracks will be kept in place.`);
            if (!confirmRemove)
                return;
            removeDupesBtn.disabled = true;
            const statusEl = main.querySelector('#detail-status');
            statusEl.innerHTML = '<div class="loading" style="padding: 1rem 1.5rem;">Removing duplicate tracks…</div>';
            try {
                await removeDuplicateTracksFromPlaylist(playlistId);
                statusEl.innerHTML = `<div class="notice-success" style="padding: 0.5rem 1.5rem;">✓ Removed ${redundantDuplicatesCount} duplicate track(s).</div>`;
                // Refresh playlist items
                await loadAndRenderDetails(container, playlistId);
            }
            catch (err) {
                statusEl.innerHTML = `<div class="error">${escapeHtml(errorMessage(err))}</div>`;
                removeDupesBtn.disabled = false;
            }
        };
    }
    else {
        removeDupesBtn.style.display = 'none';
    }
}
/** (Re)render table rows, optionally filtering to duplicates only. */
function renderRows(tbody, items, duplicateIds, dupesOnly) {
    const visible = dupesOnly
        ? items.filter((i) => i.item?.id && duplicateIds.has(i.item.id))
        : items;
    if (visible.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty">No tracks to display.</td></tr>`;
        return;
    }
    tbody.innerHTML = visible
        .map((item, idx) => buildTrackRow(item, idx + 1, duplicateIds))
        .join('');
}
/** Build a single <tr> HTML string for a playlist item. */
function buildTrackRow(item, index, duplicateIds) {
    const track = item.item;
    if (!track) {
        return `<tr class="track-unavailable"><td>${index}</td><td colspan="4"><em>Unavailable track</em></td></tr>`;
    }
    const isDupe = duplicateIds.has(track.id);
    const artists = track.artists.map((a) => escapeHtml(a.name)).join(', ');
    const addedAt = item.added_at ? formatDate(item.added_at) : '—';
    const rowClass = isDupe ? 'track-row track-duplicate' : 'track-row';
    return `
    <tr class="${rowClass}" data-track-id="${escapeHtml(track.id)}">
      <td class="col-num">${index}</td>
      <td class="col-title">
        ${isDupe ? '<span class="dupe-badge" title="Duplicate">⚠</span> ' : ''}
        ${escapeHtml(track.name)}
      </td>
      <td class="col-artist">${artists}</td>
      <td class="col-album">${escapeHtml(track.album.name)}</td>
      <td class="col-date">${addedAt}</td>
    </tr>
  `;
}
/** Format an ISO date string to a readable locale date. */
function formatDate(iso) {
    try {
        return new Date(iso).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    }
    catch {
        return iso;
    }
}
