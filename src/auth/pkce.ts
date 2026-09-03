// src/auth/pkce.ts
// PKCE helper utilities: code_verifier generation, SHA-256 challenge derivation.
// Thu Sep  3 23:19:57 CEST 2026

/** Generate a cryptographically random code_verifier (43–128 chars, RFC 7636). */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/** Derive the code_challenge as BASE64URL(SHA-256(ASCII(code_verifier))). */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

/** BASE64URL encoding without padding (RFC 4648 §5). */
function base64UrlEncode(buffer: Uint8Array): string {
  return btoa(String.fromCharCode(...buffer))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
