import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { StoreConfig } from './types';
import { resolveAccessToken } from './tokenCache';

// On Railway: mount a volume at /data/stores for persistence across deploys
// Locally: falls back to ./stores
const STORES_DIR = process.env.STORES_DIR ?? path.join(process.cwd(), 'stores');

export async function loadStore(storeName: string): Promise<StoreConfig> {
  const storePath = path.join(STORES_DIR, storeName);

  if (!fs.existsSync(storePath)) {
    throw new Error(`Store "${storeName}" not found in stores/`);
  }

  // Parse the store's .env directly — never inherit from process.env or other stores
  const envPath = path.join(storePath, '.env');
  const envVars = fs.existsSync(envPath)
    ? dotenv.parse(fs.readFileSync(envPath, 'utf-8'))
    : {};

  const configPath = path.join(storePath, 'config.json');
  const fileConfig: Partial<StoreConfig> = fs.existsSync(configPath)
    ? (JSON.parse(fs.readFileSync(configPath, 'utf-8')) as Partial<StoreConfig>)
    : {};

  const storeUrl  = envVars['SHOPIFY_STORE_URL'];
  const apiKey    = envVars['SHOPIFY_API_KEY'];
  const apiSecret = envVars['SHOPIFY_API_SECRET'];
  // staticToken may be absent for Dev Dashboard apps (post-Jan 2026)
  const staticToken = envVars['SHOPIFY_ACCESS_TOKEN'] || undefined;

  if (!storeUrl || !apiKey || !apiSecret) {
    throw new Error(
      `Store "${storeName}" is missing required env vars: SHOPIFY_STORE_URL, SHOPIFY_API_KEY, SHOPIFY_API_SECRET`
    );
  }

  // Resolve access token — uses static shpat_ token if present,
  // otherwise fetches a 24-hour client credentials token from Shopify.
  const accessToken = await resolveAccessToken(storeName, storeUrl, apiKey, apiSecret, staticToken);

  return {
    name: storeName,
    storeUrl,
    apiKey,
    apiSecret,
    accessToken,
    webhookSecret: envVars['SHOPIFY_WEBHOOK_SECRET'],
    commands: fileConfig.commands ?? { enabled: [] },
    meta: fileConfig.meta,
  };
}

export function listStores(): string[] {
  if (!fs.existsSync(STORES_DIR)) return [];

  return fs
    .readdirSync(STORES_DIR)
    .filter(name => {
      const full = path.join(STORES_DIR, name);
      return (
        fs.statSync(full).isDirectory() &&
        !name.startsWith('.') &&
        fs.existsSync(path.join(full, '.env'))
      );
    });
}
