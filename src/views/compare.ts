// src/views/compare.ts
// Compare Two Playlists view — side-by-side diff with track transfer.
// Thu Sep  3 23:19:57 CEST 2026
// Changelog:
//   Thu Sep  3 23:37:25 CEST 2026 — replaced insertAdjacentHTML/outerHTML with DOMParser+replaceWith/appendChild to fix XSS finding
//   Fri Sep  4 00:51:35 CEST 2026 — filter compare selectors to owned playlists and disable transfer to unowned playlists
//   Fri Sep  4 01:03:31 CEST 2026 — add option to hide songs in both, add select all per column, ensure non-destructive copy on transfer

import {
  addTracksToPlaylist,
  fetchAllPlaylistItems,
  fetchAllUserPlaylists,
  getCurrentUserProfile,
} from '../api/playlists.js';
import type { PlaylistItem, SimplifiedPlaylist, SpotifyUserProfile } from '../api/types.js';
import { navigate } from '../router.js';
import { escapeHtml, errorMessage } from './playlistList.js';

/** Render the Compare view. */
export async function renderCompare(container: HTMLElement): Promise<void> {
  container.innerHTML = `
    <header class="app-header">
      <button id="btn-back" class="btn btn-ghost">← Back</button>
      <h1>Compare Playlists</h1>
    </header>
    <main>
      <div class="loading">Loading your playlists…</div>
    </main>
  `;

  container.querySelector('#btn-back')!.addEventListener('click', () => navigate('list'));

  const main = container.querySelector('main')!;
  let allPlaylists: SimplifiedPlaylist[] = [];
  let currentUser: SpotifyUserProfile | null = null;

  try {
    const [fetchedPlaylists, userProfile] = await Promise.all([
      fetchAllUserPlaylists(),
      getCurrentUserProfile(),
    ]);
    allPlaylists = fetchedPlaylists;
    currentUser = userProfile;
  } catch (err) {
    main.innerHTML = `<div class="error">${escapeHtml(errorMessage(err))}</div>`;
    return;
  }

  const ownedPlaylists = currentUser
    ? allPlaylists.filter((p) => p.owner.id === currentUser.id)
    : allPlaylists;

  renderSelectors(main, ownedPlaylists);
}

/** Render the two playlist selector dropdowns. */
function renderSelectors(main: HTMLElement, playlists: SimplifiedPlaylist[]): void {
  const options = playlists
    .map((pl) => `<option value="${escapeHtml(pl.id)}">${escapeHtml(pl.name)}</option>`)
    .join('');

  main.innerHTML = `
    <div class="compare-selectors">
      <div class="selector-group">
        <label for="sel-a">Playlist A</label>
        <select id="sel-a"><option value="">— choose —</option>${options}</select>
      </div>
      <div class="selector-group">
        <label for="sel-b">Playlist B</label>
        <select id="sel-b"><option value="">— choose —</option>${options}</select>
      </div>
      <button id="btn-compare-go" class="btn btn-primary">Compare</button>
    </div>
    <div id="compare-result"></div>
  `;

  main.querySelector('#btn-compare-go')!.addEventListener('click', async () => {
    const selA = (main.querySelector<HTMLSelectElement>('#sel-a'))!.value;
    const selB = (main.querySelector<HTMLSelectElement>('#sel-b'))!.value;

    if (!selA || !selB) {
      showNotice(main, 'Please select two playlists.', 'warn');
      return;
    }
    if (selA === selB) {
      showNotice(main, 'Please select two different playlists.', 'warn');
      return;
    }

    const plA = playlists.find((p) => p.id === selA)!;
    const plB = playlists.find((p) => p.id === selB)!;
    await runComparison(main, plA, plB);
  });
}

/** Fetch both playlists in parallel and render the comparison. */
async function runComparison(
  main: HTMLElement,
  plA: SimplifiedPlaylist,
  plB: SimplifiedPlaylist,
): Promise<void> {
  const resultEl = main.querySelector<HTMLElement>('#compare-result')!;
  resultEl.innerHTML = '<div class="loading">Loading both playlists…</div>';

  let itemsA: PlaylistItem[], itemsB: PlaylistItem[];
  try {
    [itemsA, itemsB] = await Promise.all([
      fetchAllPlaylistItems(plA.id),
      fetchAllPlaylistItems(plB.id),
    ]);
  } catch (err) {
    resultEl.innerHTML = `<div class="error">${escapeHtml(errorMessage(err))}</div>`;
    return;
  }

  // Build ID → item maps for fast lookup
  const idsA = new Set(itemsA.map((i) => i.item?.id).filter(Boolean) as string[]);
  const idsB = new Set(itemsB.map((i) => i.item?.id).filter(Boolean) as string[]);

  renderCompareResult(resultEl, plA, plB, itemsA, itemsB, idsA, idsB);
}

/**
 * Render the side-by-side comparison result with filter toggle and select-all actions.
 * Fri Sep  4 01:03:31 CEST 2026
 */
function renderCompareResult(
  container: HTMLElement,
  plA: SimplifiedPlaylist,
  plB: SimplifiedPlaylist,
  itemsA: PlaylistItem[],
  itemsB: PlaylistItem[],
  idsA: Set<string>,
  idsB: Set<string>,
): void {
  const onlyA = itemsA.filter((i) => i.item?.id && !idsB.has(i.item.id));
  const onlyB = itemsB.filter((i) => i.item?.id && !idsA.has(i.item.id));
  const inBoth = itemsA.filter((i) => i.item?.id && idsB.has(i.item.id));

  container.innerHTML = `
    <div class="compare-controls-bar">
      <div class="compare-legend">
        <span class="legend-a">■ Only in "${escapeHtml(plA.name)}"</span>
        <span class="legend-b">■ Only in "${escapeHtml(plB.name)}"</span>
        <span class="legend-both">■ In both</span>
      </div>
      <div class="compare-view-options">
        <label class="toggle-label">
          <input type="checkbox" id="toggle-hide-both" />
          Hide songs in both playlists
        </label>
      </div>
    </div>
    <div class="compare-columns">
      <div class="compare-col" id="col-a">
        <div class="col-header">
          <strong>${escapeHtml(plA.name)}</strong>
          <span class="badge badge-col-a">${itemsA.length}</span>
          <div class="col-header-actions">
            <button id="btn-select-all-a" class="btn btn-ghost btn-sm" ${onlyA.length === 0 ? 'disabled' : ''}>Select All</button>
            <button id="btn-deselect-all-a" class="btn btn-ghost btn-sm" ${onlyA.length === 0 ? 'disabled' : ''}>Deselect All</button>
          </div>
        </div>
        ${buildCompareTable(itemsA, idsB, 'a', false)}
      </div>
      <div class="compare-col" id="col-b">
        <div class="col-header">
          <strong>${escapeHtml(plB.name)}</strong>
          <span class="badge badge-col-b">${itemsB.length}</span>
          <div class="col-header-actions">
            <button id="btn-select-all-b" class="btn btn-ghost btn-sm" ${onlyB.length === 0 ? 'disabled' : ''}>Select All</button>
            <button id="btn-deselect-all-b" class="btn btn-ghost btn-sm" ${onlyB.length === 0 ? 'disabled' : ''}>Deselect All</button>
          </div>
        </div>
        ${buildCompareTable(itemsB, idsA, 'b', false)}
      </div>
    </div>
    <div class="transfer-panel">
      <div class="transfer-summary">
        ${onlyA.length} exclusive to A · ${onlyB.length} exclusive to B · ${inBoth.length} shared
      </div>
      <div class="transfer-actions">
        <button id="btn-transfer-a-to-b" class="btn btn-primary" ${onlyA.length === 0 ? 'disabled' : ''}>
          Copy selected from A → ${escapeHtml(plB.name)}
        </button>
        <button id="btn-transfer-b-to-a" class="btn btn-primary" ${onlyB.length === 0 ? 'disabled' : ''}>
          Copy selected from B → ${escapeHtml(plA.name)}
        </button>
      </div>
      <div id="transfer-status"></div>
    </div>
  `;

  // Filter toggle: Hide/Show songs In Both
  const hideBothCheckbox = container.querySelector<HTMLInputElement>('#toggle-hide-both')!;
  hideBothCheckbox.addEventListener('change', () => {
    const hide = hideBothCheckbox.checked;
    updateCompareVisibility(container, hide);
  });

  // Select all / Deselect all for A
  container.querySelector('#btn-select-all-a')?.addEventListener('click', () => {
    setColumnCheckboxes(container, 'a', true);
  });
  container.querySelector('#btn-deselect-all-a')?.addEventListener('click', () => {
    setColumnCheckboxes(container, 'a', false);
  });

  // Select all / Deselect all for B
  container.querySelector('#btn-select-all-b')?.addEventListener('click', () => {
    setColumnCheckboxes(container, 'b', true);
  });
  container.querySelector('#btn-deselect-all-b')?.addEventListener('click', () => {
    setColumnCheckboxes(container, 'b', false);
  });

  // Wire transfer buttons (Copy selected to target playlist without deleting from source)
  container.querySelector('#btn-transfer-a-to-b')!.addEventListener('click', () =>
    handleTransfer(container, plB.id, 'a', plA, plB, idsA, idsB),
  );
  container.querySelector('#btn-transfer-b-to-a')!.addEventListener('click', () =>
    handleTransfer(container, plA.id, 'b', plA, plB, idsA, idsB),
  );
}

/**
 * Toggle visibility of rows containing tracks present in both playlists.
 * Fri Sep  4 01:03:31 CEST 2026
 */
function updateCompareVisibility(container: HTMLElement, hideInBoth: boolean): void {
  const bothRows = container.querySelectorAll<HTMLElement>('.row-both');
  for (const row of bothRows) {
    row.style.display = hideInBoth ? 'none' : '';
  }
}

/**
 * Set all selectable checkboxes on a given comparison column.
 * Fri Sep  4 01:03:31 CEST 2026
 */
function setColumnCheckboxes(container: HTMLElement, side: 'a' | 'b', checked: boolean): void {
  const checkboxes = container.querySelectorAll<HTMLInputElement>(
    `.track-checkbox[data-side="${side}"]`,
  );
  for (const cb of checkboxes) {
    cb.checked = checked;
  }
}

/**
 * Build the track table for one side of the comparison.
 * Fri Sep  4 01:03:31 CEST 2026
 */
function buildCompareTable(
  items: PlaylistItem[],
  otherIds: Set<string>,
  side: 'a' | 'b',
  hideInBoth = false,
): string {
  if (items.length === 0) return '<p class="empty">No tracks.</p>';

  const rows = items
    .map((item, idx) => {
      const track = item.item;
      if (!track) return '';
      const inBoth = otherIds.has(track.id);
      const exclusive = !inBoth;
      const rowClass = inBoth ? 'row-both' : `row-exclusive-${side}`;
      const artists = track.artists.map((a) => escapeHtml(a.name)).join(', ');
      const hideStyle = inBoth && hideInBoth ? ' style="display:none"' : '';

      return `
        <tr class="compare-row ${rowClass}"${hideStyle} data-track-id="${escapeHtml(track.id)}" data-track-uri="${escapeHtml(track.uri)}" data-side="${side}">
          <td>
            ${exclusive ? `<input type="checkbox" class="track-checkbox" data-uri="${escapeHtml(track.uri)}" data-side="${side}" />` : ''}
          </td>
          <td>${idx + 1}</td>
          <td class="col-title" title="${escapeHtml(track.name)}">${escapeHtml(track.name)}</td>
          <td class="col-artist" title="${artists}">${artists}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <div class="table-wrapper">
      <table class="track-table compare-table">
        <thead>
          <tr><th></th><th>#</th><th>Title</th><th>Artist(s)</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

/** Handle the "add selected tracks" transfer action. */
async function handleTransfer(
  container: HTMLElement,
  toPlaylistId: string,
  sourceSide: 'a' | 'b',
  plA: SimplifiedPlaylist,
  plB: SimplifiedPlaylist,
  idsA: Set<string>,
  idsB: Set<string>,
): Promise<void> {
  const checkboxes = container.querySelectorAll<HTMLInputElement>(
    `.track-checkbox[data-side="${sourceSide}"]:checked`,
  );
  const uris = [...checkboxes].map((cb) => cb.dataset['uri']!).filter(Boolean);

  if (uris.length === 0) {
    showTransferStatus(container, 'No tracks selected.', 'warn');
    return;
  }

  const statusEl = container.querySelector<HTMLElement>('#transfer-status')!;
  statusEl.innerHTML = `<div class="loading">Adding ${uris.length} track(s)…</div>`;

  try {
    // Spotify allows max 100 URIs per request — batch if needed
    const BATCH = 100;
    for (let i = 0; i < uris.length; i += BATCH) {
      await addTracksToPlaylist(toPlaylistId, uris.slice(i, i + BATCH));
    }
  } catch (err) {
    statusEl.innerHTML = `<div class="error">${escapeHtml(errorMessage(err))}</div>`;
    return;
  }

  showTransferStatus(container, `✓ ${uris.length} track(s) added successfully.`, 'success');

  // Refresh the destination playlist column
  const toName = toPlaylistId === plA.id ? plA : plB;
  const toSide = toPlaylistId === plA.id ? 'a' : 'b';
  await refreshColumn(container, toName, toSide === 'a' ? idsB : idsA, toSide);
}

/** Refresh one column after a transfer by re-fetching its items. */
async function refreshColumn(
  container: HTMLElement,
  playlist: SimplifiedPlaylist,
  otherIds: Set<string>,
  side: 'a' | 'b',
): Promise<void> {
  const col = container.querySelector<HTMLElement>(`#col-${side}`)!;
  const tableWrapper = col.querySelector('.table-wrapper');
  if (tableWrapper) tableWrapper.innerHTML = '<div class="loading">Refreshing…</div>';

  try {
    const items = await fetchAllPlaylistItems(playlist.id);
    const hideBothCheckbox = container.querySelector<HTMLInputElement>('#toggle-hide-both');
    const hideInBoth = hideBothCheckbox?.checked ?? false;
    const newTable = buildCompareTable(items, otherIds, side, hideInBoth);
    // Parse the HTML string into a DOM node to avoid insertAdjacentHTML / outerHTML XSS risk
    const parsed = new DOMParser().parseFromString(newTable, 'text/html').body.firstElementChild!;
    if (tableWrapper) {
      tableWrapper.replaceWith(parsed);
    } else {
      col.appendChild(parsed);
    }
    // Update badge
    const badge = col.querySelector(`.badge-col-${side}`);
    if (badge) badge.textContent = String(items.length);
  } catch (err) {
    if (tableWrapper) {
      tableWrapper.innerHTML = `<div class="error">${escapeHtml(errorMessage(err))}</div>`;
    }
  }
}

function showNotice(main: HTMLElement, message: string, type: 'warn' | 'error'): void {
  const existing = main.querySelector('.inline-notice');
  if (existing) existing.remove();
  const div = document.createElement('div');
  div.className = `inline-notice ${type === 'warn' ? 'notice-warn' : 'error'}`;
  div.textContent = message;
  main.querySelector('.compare-selectors')?.appendChild(div);
}

function showTransferStatus(
  container: HTMLElement,
  message: string,
  type: 'success' | 'warn' | 'error',
): void {
  const el = container.querySelector<HTMLElement>('#transfer-status')!;
  el.innerHTML = `<div class="notice-${type}">${escapeHtml(message)}</div>`;
}
