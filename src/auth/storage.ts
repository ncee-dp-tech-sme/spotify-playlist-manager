// src/auth/storage.ts
// Secure token storage using sessionStorage (cleared when the tab closes).
// Never stores the client secret — PKCE flow does not require it client-side.
// Thu Sep  3 23:19:57 CEST 2026

const KEYS = {
  ACCESS_TOKEN: 'spm_access_token',
  REFRESH_TOKEN: 'spm_refresh_token',
  EXPIRES_AT: 'spm_expires_at',      // epoch ms
  CODE_VERIFIER: 'spm_code_verifier',
} as const;

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
}

/** Persist the token set received from the token endpoint. */
export function saveTokens(tokens: TokenSet): void {
  sessionStorage.setItem(KEYS.ACCESS_TOKEN, tokens.accessToken);
  sessionStorage.setItem(KEYS.REFRESH_TOKEN, tokens.refreshToken);
  sessionStorage.setItem(KEYS.EXPIRES_AT, String(tokens.expiresAt));
}

/** Retrieve the stored token set, or null if absent. */
export function loadTokens(): TokenSet | null {
  const accessToken = sessionStorage.getItem(KEYS.ACCESS_TOKEN);
  const refreshToken = sessionStorage.getItem(KEYS.REFRESH_TOKEN);
  const expiresAt = sessionStorage.getItem(KEYS.EXPIRES_AT);
  if (!accessToken || !refreshToken || !expiresAt) return null;
  return { accessToken, refreshToken, expiresAt: Number(expiresAt) };
}

/** Remove all stored token data (called on logout or auth failure). */
export function clearTokens(): void {
  sessionStorage.removeItem(KEYS.ACCESS_TOKEN);
  sessionStorage.removeItem(KEYS.REFRESH_TOKEN);
  sessionStorage.removeItem(KEYS.EXPIRES_AT);
}

/** Return true when the access token has less than 60 s remaining. */
export function isTokenExpired(tokens: TokenSet): boolean {
  return Date.now() >= tokens.expiresAt - 60_000;
}

/** Persist the PKCE code_verifier before the authorization redirect. */
export function saveCodeVerifier(verifier: string): void {
  sessionStorage.setItem(KEYS.CODE_VERIFIER, verifier);
}

/** Retrieve and immediately clear the stored code_verifier. */
export function consumeCodeVerifier(): string | null {
  const v = sessionStorage.getItem(KEYS.CODE_VERIFIER);
  sessionStorage.removeItem(KEYS.CODE_VERIFIER);
  return v;
}
