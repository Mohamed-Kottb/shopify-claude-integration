import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { StoreConfig } from './types';

// On Railway: mount a volume at /data/stores for persistence across deploys
// Locally: falls back to ./stores
const STORES_DIR = process.env.STORES_DIR ?? path.join(process.cwd(), 'stores');

export function loadStore(storeName: string): StoreConfig {
  const storePath = path.join(STORES_DIR, storeName);

  if (!fs.existsSync(storePath)) {
    throw new Error(`Store "${storeName}" not found in stores/`);
  }

  dotenv.config({ path: path.join(storePath, '.env') });

  const configPath = path.join(storePath, 'config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(`config.json missing for store "${storeName}"`);
  }

  const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as Partial<StoreConfig>;

  const storeUrl = process.env.SHOPIFY_STORE_URL;
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
  const apiKey = process.env.SHOPIFY_API_KEY;
  const apiSecret = process.env.SHOPIFY_API_SECRET;

  if (!storeUrl || !accessToken || !apiKey || !apiSecret) {
    throw new Error(
      `Store "${storeName}" is missing required env vars: SHOPIFY_STORE_URL, SHOPIFY_ACCESS_TOKEN, SHOPIFY_API_KEY, SHOPIFY_API_SECRET`
    );
  }

  return {
    name: storeName,
    storeUrl,
    apiKey,
    apiSecret,
    accessToken,
    webhookSecret: process.env.SHOPIFY_WEBHOOK_SECRET,
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
      return fs.statSync(full).isDirectory() && !name.startsWith('.');
    });
}
