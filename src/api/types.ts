// src/api/types.ts
// Spotify Web API response type definitions.
// Derived from the Spotify OpenAPI schema:
// https://developer.spotify.com/reference/web-api/open-api-schema.yaml
// Thu Sep  3 23:19:57 CEST 2026
// Fri Sep  4 00:51:35 CEST 2026 — add SpotifyUserProfile interface

export interface SpotifyUserProfile {
  id: string;
  display_name: string | null;
  email?: string;
  uri?: string;
}

export interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

export interface SpotifyUser {
  id: string;
  display_name: string | null;
}

// ── Playlist ──────────────────────────────────────────────────────────────────

export interface SimplifiedPlaylist {
  id: string;
  name: string;
  description: string | null;
  images: SpotifyImage[] | null;  // some playlists return null instead of []
  owner: SpotifyUser;
  items: { href: string; total: number };  // live API returns "items", not "tracks"
  public: boolean | null;
  collaborative: boolean;
  snapshot_id: string;
}

// ── Paginated wrapper ─────────────────────────────────────────────────────────

export interface Paging<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  next: string | null;
  previous: string | null;
  href: string;
}

// ── Track ─────────────────────────────────────────────────────────────────────

export interface SpotifyArtist {
  id: string;
  name: string;
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  images: SpotifyImage[];
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
  duration_ms: number;
  explicit: boolean;
  uri: string;
  is_local: boolean;
}

/** Item as returned by GET /playlists/{id}/items */
export interface PlaylistItem {
  added_at: string | null;
  added_by: SpotifyUser | null;
  item: SpotifyTrack | null;  // live API uses "item" (singular), not "track"
  is_local: boolean;
}

// ── Error shape ───────────────────────────────────────────────────────────────

export interface SpotifyApiError {
  status: number;
  message: string;
}
