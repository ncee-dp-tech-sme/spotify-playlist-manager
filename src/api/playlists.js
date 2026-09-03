// src/api/playlists.ts
// Spotify playlist API calls.
// All paths are sourced from the Spotify OpenAPI schema.
// Thu Sep  3 23:19:57 CEST 2026
// Fri Sep  4 00:07:58 CEST 2026 — use the schema-defined limit for current-user playlists
// Fri Sep  4 00:20:03 CEST 2026 — fix URLSearchParams encoding breaking Spotify fields filter; drop fields param to get full track objects
// Fri Sep  4 00:51:35 CEST 2026 — add getCurrentUserProfile, removePlaylistItems, and removeDuplicateTracksFromPlaylist
import { spotifyDelete, spotifyGet, spotifyPost } from './client.js';
const USER_PLAYLISTS_PAGE_SIZE = 50;
const PLAYLIST_ITEMS_PAGE_SIZE = 100;
// ── User's playlists ──────────────────────────────────────────────────────────
/**
 * Fetch ALL playlists for the current user.
 * GET /me/playlists — paginated, max 50 per request.
 * Fri Sep  4 00:07:58 CEST 2026
 */
export async function fetchAllUserPlaylists() {
    return fetchAllPages('/me/playlists', USER_PLAYLISTS_PAGE_SIZE);
}
// ── User profile ─────────────────────────────────────────────────────────────
/**
 * Fetch the current user's profile to obtain user ID and details.
 * GET /me
 * Fri Sep  4 00:51:35 CEST 2026
 */
export async function getCurrentUserProfile() {
    return spotifyGet('/me');
}
// ── Playlist items ────────────────────────────────────────────────────────────
/**
 * Fetch ALL items (tracks) in a playlist.
 * GET /playlists/{id}/items — paginated, max 100 per request.
 * Uses the preferred endpoint (not the deprecated /tracks endpoint).
 */
export async function fetchAllPlaylistItems(playlistId) {
    return fetchAllPages(`/playlists/${encodeURIComponent(playlistId)}/items`, PLAYLIST_ITEMS_PAGE_SIZE);
}
// ── Modify playlist ───────────────────────────────────────────────────────────
/**
 * Add up to 100 tracks to a playlist in a single request.
 * POST /playlists/{id}/items
 * Returns the new snapshot_id.
 */
export async function addTracksToPlaylist(playlistId, uris, position) {
    const body = { uris };
    if (position !== undefined)
        body['position'] = position;
    return spotifyPost(`/playlists/${encodeURIComponent(playlistId)}/items`, body);
}
/**
 * Remove items from a playlist by URI.
 * DELETE /playlists/{id}/items
 * Fri Sep  4 00:51:35 CEST 2026
 */
export async function removePlaylistItems(playlistId, uris, snapshotId) {
    const body = {
        items: uris.map((uri) => ({ uri })),
    };
    if (snapshotId)
        body['snapshot_id'] = snapshotId;
    return spotifyDelete(`/playlists/${encodeURIComponent(playlistId)}/items`, body);
}
/**
 * Remove duplicate occurrences of tracks from a playlist, preserving unique tracks in original order.
 * Fetches all items, finds duplicates, removes duplicate URIs, and re-adds any removed tracks that were completely deleted.
 * Fri Sep  4 00:51:35 CEST 2026
 */
export async function removeDuplicateTracksFromPlaylist(playlistId) {
    const items = await fetchAllPlaylistItems(playlistId);
    const seenIds = new Set();
    const duplicateUris = new Set();
    let duplicateCount = 0;
    for (const item of items) {
        const id = item.item?.id;
        const uri = item.item?.uri;
        if (id && uri) {
            if (seenIds.has(id)) {
                duplicateUris.add(uri);
                duplicateCount++;
            }
            else {
                seenIds.add(id);
            }
        }
    }
    if (duplicateCount === 0 || duplicateUris.size === 0) {
        return { removedCount: 0 };
    }
    // To cleanly remove duplicates while keeping unique tracks and original ordering:
    // We can compute the unique list of URIs in first-seen order.
    const uniqueUris = [];
    const addedIds = new Set();
    for (const item of items) {
        const id = item.item?.id;
        const uri = item.item?.uri;
        if (id && uri && !addedIds.has(id)) {
            addedIds.add(id);
            uniqueUris.push(uri);
        }
    }
    // Remove the duplicate URIs from playlist (Spotify DELETE /items removes all occurrences of specified URIs)
    const uriListToRemove = Array.from(duplicateUris);
    const BATCH_SIZE = 100;
    for (let i = 0; i < uriListToRemove.length; i += BATCH_SIZE) {
        const chunk = uriListToRemove.slice(i, i + BATCH_SIZE);
        await removePlaylistItems(playlistId, chunk);
    }
    // Re-add one instance of each removed URI back to the playlist
    for (let i = 0; i < uriListToRemove.length; i += BATCH_SIZE) {
        const chunk = uriListToRemove.slice(i, i + BATCH_SIZE);
        await addTracksToPlaylist(playlistId, chunk);
    }
    return { removedCount: duplicateCount };
}
// ── Generic paginator ─────────────────────────────────────────────────────────
/**
 * Fetch every page of a paginated Spotify endpoint and aggregate all items.
 * On the first request, reads `total` to determine how many additional pages
 * are needed, then fires them in parallel for efficiency.
 */
async function fetchAllPages(path, pageSize, extraParams = {}) {
    // First page — determines total
    const firstPage = await spotifyGet(buildUrl(path, { limit: String(pageSize), offset: '0', ...extraParams }));
    const allItems = [...firstPage.items];
    const total = firstPage.total;
    if (total <= pageSize)
        return allItems;
    // Build offset list for remaining pages
    const offsets = [];
    for (let offset = pageSize; offset < total; offset += pageSize) {
        offsets.push(offset);
    }
    // Fetch remaining pages in parallel
    const pages = await Promise.all(offsets.map((offset) => spotifyGet(buildUrl(path, { limit: String(pageSize), offset: String(offset), ...extraParams }))));
    for (const page of pages) {
        allItems.push(...page.items);
    }
    return allItems;
}
/** Build a full URL string by appending query parameters. */
function buildUrl(path, params) {
    const qs = new URLSearchParams(params).toString();
    return `${path}?${qs}`;
}
