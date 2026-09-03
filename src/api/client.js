// src/api/client.ts
// Core HTTP client for the Spotify Web API.
// Handles Authorization headers, HTTP error mapping, and 429 backoff.
// Thu Sep  3 23:19:57 CEST 2026
import { getValidAccessToken, logout } from '../auth/auth.js';
const BASE_URL = 'https://api.spotify.com/v1';
/** Custom error class carrying the Spotify status code and message. */
export class SpotifyError extends Error {
    constructor(status, message) {
        super(message);
        Object.defineProperty(this, "status", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: status
        });
        this.name = 'SpotifyError';
    }
}
/**
 * Perform an authenticated GET request against the Spotify Web API.
 * Retries once on 401 (token refresh), and respects Retry-After on 429.
 */
export async function spotifyGet(path) {
    return spotifyRequest('GET', path);
}
/**
 * Perform an authenticated POST request against the Spotify Web API.
 * `body` will be serialised as JSON.
 */
export async function spotifyPost(path, body) {
    return spotifyRequest('POST', path, body);
}
/**
 * Perform an authenticated DELETE request against the Spotify Web API.
 * `body` will be serialised as JSON if provided.
 * Fri Sep  4 00:51:35 CEST 2026
 */
export async function spotifyDelete(path, body) {
    return spotifyRequest('DELETE', path, body);
}
// ── Internal ──────────────────────────────────────────────────────────────────
/** Maximum number of exponential-backoff retries on 429. */
const MAX_RETRIES = 5;
async function spotifyRequest(method, path, body, retryCount = 0) {
    const token = await getValidAccessToken();
    const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
    const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
    const response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    // ── 429 Rate limit ────────────────────────────────────────────────────────
    if (response.status === 429) {
        if (retryCount >= MAX_RETRIES) {
            throw new SpotifyError(429, 'Rate limit exceeded. Please try again later.');
        }
        const retryAfter = Number(response.headers.get('Retry-After') ?? '1');
        // Exponential backoff: use Retry-After as the base, doubling each retry
        const delay = retryAfter * 1000 * Math.pow(2, retryCount);
        await sleep(delay);
        return spotifyRequest(method, path, body, retryCount + 1);
    }
    // ── 401 Unauthorised — token may have just expired ────────────────────────
    if (response.status === 401) {
        // getValidAccessToken already tried to refresh; if still 401, the session
        // is genuinely invalid — clear auth state and surface a clear error.
        logout();
        throw new SpotifyError(401, 'Session expired. Please log in again.');
    }
    // ── Other non-2xx errors ──────────────────────────────────────────────────
    if (!response.ok) {
        let message = `Spotify API error ${response.status}`;
        try {
            const json = (await response.json());
            message = json.error?.message ?? message;
        }
        catch {
            // response body was not JSON — use the status-based message
        }
        throw new SpotifyError(response.status, message);
    }
    // ── 204 No Content ────────────────────────────────────────────────────────
    if (response.status === 204) {
        return undefined;
    }
    return response.json();
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
