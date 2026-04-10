/**
 * Token cache for Shopify client credentials grant tokens.
 *
 * New Dev Dashboard apps (post-Jan 2026) have no permanent shpat_ token.
 * Instead they use Client ID + Client Secret to get short-lived tokens (24h).
 * This module fetches and caches those tokens, refreshing 5 minutes before expiry.
 *
 * Stores with a permanent shpat_ token bypass this entirely.
 */

interface CachedToken {
  token: string;
  expiresAt: number; // ms since epoch
}

const cache = new Map<string, CachedToken>();

async function fetchClientCredentialsToken(
  storeUrl: string,
  apiKey: string,
  apiSecret: string,
): Promise<CachedToken> {
  const url = `${storeUrl}/admin/oauth/access_token`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: apiKey,
      client_secret: apiSecret,
      grant_type: 'client_credentials',
    }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(
      `Shopify client credentials token request failed for ${storeUrl}: ${resp.status} ${resp.statusText}${body ? ` — ${body}` : ''}`
    );
  }

  const data = await resp.json() as { access_token: string; expires_in: number };
  return {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

/**
 * Returns a valid access token for the store.
 * - If a static token (shpat_...) is provided, returns it immediately.
 * - Otherwise, returns a cached client credentials token or fetches a fresh one.
 */
export async function resolveAccessToken(
  storeName: string,
  storeUrl: string,
  apiKey: string,
  apiSecret: string,
  staticToken?: string,
): Promise<string> {
  if (staticToken) return staticToken;

  const BUFFER_MS = 5 * 60 * 1000; // 5 minutes before expiry
  const cached = cache.get(storeName);
  if (cached && cached.expiresAt - Date.now() > BUFFER_MS) {
    return cached.token;
  }

  const fresh = await fetchClientCredentialsToken(storeUrl, apiKey, apiSecret);
  cache.set(storeName, fresh);
  return fresh.token;
}
