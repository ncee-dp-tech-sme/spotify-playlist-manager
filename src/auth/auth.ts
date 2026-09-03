// src/auth/auth.ts
// Authorization Code with PKCE flow — redirect, callback exchange, token refresh.
// https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow
// Thu Sep  3 23:19:57 CEST 2026

import { generateCodeChallenge, generateCodeVerifier } from './pkce.js';
import {
  clearTokens,
  consumeCodeVerifier,
  isTokenExpired,
  loadTokens,
  saveCodeVerifier,
  saveTokens,
  type TokenSet,
} from './storage.js';

// ── Environment config (all loaded from .env via Vite's import.meta.env) ──────
const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string;
const REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI as string;
const SCOPES = import.meta.env.VITE_SPOTIFY_SCOPES as string;

const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';

/** Validate that required env vars are present at startup. */
export function validateEnv(): void {
  const missing: string[] = [];
  if (!CLIENT_ID) missing.push('VITE_SPOTIFY_CLIENT_ID');
  if (!REDIRECT_URI) missing.push('VITE_SPOTIFY_REDIRECT_URI');
  if (!SCOPES) missing.push('VITE_SPOTIFY_SCOPES');
  if (missing.length) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        'Copy .env.example to .env and fill in your Spotify app credentials.',
    );
  }
}

/**
 * Redirect the browser to Spotify's authorization endpoint.
 * Generates a fresh code_verifier / challenge pair and stores the verifier
 * in sessionStorage so it survives the redirect.
 */
export async function redirectToSpotifyAuth(): Promise<void> {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  saveCodeVerifier(verifier);

  // Use a cryptographically random state value to prevent CSRF
  const state = base64UrlRandom(16);
  sessionStorage.setItem('spm_oauth_state', state);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
    state,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });

  window.location.href = `${AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Handle the OAuth callback at REDIRECT_URI.
 * Validates the state, exchanges the code for tokens, and persists them.
 * Returns the TokenSet on success, throws on error.
 */
export async function handleCallback(): Promise<TokenSet> {
  const params = new URLSearchParams(window.location.search);
  const error = params.get('error');
  if (error) {
    throw new Error(`Spotify authorization denied: ${error}`);
  }

  const code = params.get('code');
  const state = params.get('state');
  const storedState = sessionStorage.getItem('spm_oauth_state');
  sessionStorage.removeItem('spm_oauth_state');

  if (!code) throw new Error('No authorization code returned by Spotify.');
  if (!state || state !== storedState) {
    throw new Error('OAuth state mismatch — possible CSRF attempt. Please try again.');
  }

  const verifier = consumeCodeVerifier();
  if (!verifier) throw new Error('Missing PKCE code_verifier. Please start the login flow again.');

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    code_verifier: verifier,
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${detail}`);
  }

  const json = await response.json();
  const tokens = parseTokenResponse(json);
  saveTokens(tokens);
  return tokens;
}

/**
 * Refresh an expired access token using the stored refresh token.
 * If the refresh token itself has expired (400/401), clears all tokens
 * so the caller can re-initiate the full auth flow.
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenSet> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    // Refresh token has expired or been revoked — user must re-authorize
    clearTokens();
    throw new Error('Session expired. Please log in again.');
  }

  const json = await response.json();
  // Spotify may or may not return a new refresh_token; keep the old one if absent
  const tokens = parseTokenResponse(json, refreshToken);
  saveTokens(tokens);
  return tokens;
}

/**
 * Return a valid access token, refreshing automatically if needed.
 * Throws if no session exists or if refresh fails.
 */
export async function getValidAccessToken(): Promise<string> {
  let tokens = loadTokens();
  if (!tokens) throw new Error('Not authenticated.');
  if (isTokenExpired(tokens)) {
    tokens = await refreshAccessToken(tokens.refreshToken);
  }
  return tokens.accessToken;
}

/** Logout: clear all stored tokens. */
export function logout(): void {
  clearTokens();
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Parse a token endpoint JSON response into a typed TokenSet. */
function parseTokenResponse(
  json: Record<string, unknown>,
  fallbackRefreshToken?: string,
): TokenSet {
  const accessToken = json['access_token'] as string;
  const expiresIn = json['expires_in'] as number; // seconds
  const refreshToken = (json['refresh_token'] as string | undefined) ?? fallbackRefreshToken ?? '';
  if (!accessToken) throw new Error('Token response missing access_token.');
  return {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + expiresIn * 1000,
  };
}

/** Generate a random base64url string of `byteLength` random bytes. */
function base64UrlRandom(byteLength: number): string {
  const buf = new Uint8Array(byteLength);
  crypto.getRandomValues(buf);
  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
