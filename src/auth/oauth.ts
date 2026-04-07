import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Request, Response } from 'express';
import { logger } from '../core/logger';

const STORES_DIR = process.env.STORES_DIR ?? path.join(process.cwd(), 'stores');
const SCOPES = [
  'read_analytics',
  'read_customers', 'write_customers',
  'read_orders', 'write_orders',
  'read_products', 'write_products',
  'read_inventory', 'write_inventory',
  'read_themes', 'write_themes',
  'write_theme_code',
  'read_script_tags', 'write_script_tags',
  'read_pixels', 'write_pixels',
  'read_marketing_events', 'write_marketing_events',
  'read_discounts', 'write_discounts',
  'read_price_rules', 'write_price_rules',
  'read_metaobjects', 'write_metaobjects',
  'read_metaobject_definitions', 'write_metaobject_definitions',
  'read_content', 'write_content',
  'read_online_store_pages', 'write_online_store_pages',
  'read_reports', 'write_reports',
  'read_product_listings', 'write_product_listings',
  'read_publications', 'write_publications',
  'read_translations', 'write_translations',
  'read_locales', 'write_locales',
  'read_shipping', 'write_shipping',
  'read_fulfillments', 'write_fulfillments',
  'read_draft_orders', 'write_draft_orders',
  'read_checkouts', 'write_checkouts',
].join(',');

// In-memory nonce store (per process — fine for <10 stores)
const pendingNonces = new Map<string, string>();

function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

function validateHmac(query: Record<string, string>, secret: string): boolean {
  const { hmac, ...rest } = query;
  const message = Object.keys(rest)
    .sort()
    .map(k => `${k}=${rest[k]}`)
    .join('&');
  const digest = crypto.createHmac('sha256', secret).update(message).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmac));
}

function saveStoreCredentials(shop: string, accessToken: string): void {
  const storeName = shop.replace('.myshopify.com', '');
  const storeDir = path.join(STORES_DIR, storeName);
  const templateConfig = path.join(STORES_DIR, 'store-template', 'config.json');
  const storeConfig = path.join(storeDir, 'config.json');
  const storeEnv = path.join(storeDir, '.env');

  if (!fs.existsSync(storeDir)) {
    fs.mkdirSync(storeDir, { recursive: true });
  }

  // Copy template config if not already present
  if (!fs.existsSync(storeConfig) && fs.existsSync(templateConfig)) {
    fs.copyFileSync(templateConfig, storeConfig);
  }

  const envContent = [
    `SHOPIFY_STORE_URL=${shop}`,
    `SHOPIFY_ACCESS_TOKEN=${accessToken}`,
    `SHOPIFY_API_KEY=${process.env.SHOPIFY_API_KEY ?? ''}`,
    `SHOPIFY_API_SECRET=${process.env.SHOPIFY_API_SECRET ?? ''}`,
    `SHOPIFY_WEBHOOK_SECRET=`,
  ].join('\n') + '\n';

  fs.writeFileSync(storeEnv, envContent, 'utf-8');
  logger.success(`Store "${storeName}" credentials saved to ${storeEnv}`);
}

// GET /auth/install?shop=storename.myshopify.com
export function handleInstall(req: Request, res: Response): void {
  const shop = req.query['shop'] as string;

  if (!shop || !shop.endsWith('.myshopify.com')) {
    res.status(400).send('Missing or invalid shop parameter');
    return;
  }

  const apiKey = process.env.SHOPIFY_API_KEY;
  const callbackUrl = `${process.env.WEBHOOK_CALLBACK_URL}/auth/callback`;
  const nonce = generateNonce();

  pendingNonces.set(shop, nonce);

  const installUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${apiKey}` +
    `&scope=${SCOPES}` +
    `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
    `&state=${nonce}`;

  logger.info(`Redirecting ${shop} to OAuth install page`);
  res.redirect(installUrl);
}

// GET /auth/callback?code=xxx&shop=xxx&state=xxx&hmac=xxx
export async function handleCallback(req: Request, res: Response): Promise<void> {
  const { shop, code, state, hmac } = req.query as Record<string, string>;
  const apiSecret = process.env.SHOPIFY_API_SECRET ?? '';

  if (!shop || !code || !state || !hmac) {
    res.status(400).send('Missing required OAuth parameters');
    return;
  }

  // Validate nonce
  if (pendingNonces.get(shop) !== state) {
    res.status(403).send('Invalid state nonce');
    return;
  }
  pendingNonces.delete(shop);

  // Validate HMAC
  if (!validateHmac(req.query as Record<string, string>, apiSecret)) {
    res.status(403).send('HMAC validation failed');
    return;
  }

  // Exchange code for access token
  const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: apiSecret,
      code,
    }),
  });

  if (!tokenResponse.ok) {
    logger.error(`Token exchange failed for ${shop}: ${tokenResponse.statusText}`);
    res.status(500).send('Token exchange failed');
    return;
  }

  const { access_token } = await tokenResponse.json() as { access_token: string };
  saveStoreCredentials(shop, access_token);

  res.send(`
    <html><body style="font-family:sans-serif;text-align:center;padding:60px">
      <h2>✅ ${shop} connected successfully!</h2>
      <p>The store has been added to your system.</p>
      <p>You can close this tab.</p>
    </body></html>
  `);
}

// Generate an install link to share with a client
export function generateInstallLink(shop: string): string {
  const callbackUrl = `${process.env.WEBHOOK_CALLBACK_URL}/auth/callback`;
  const apiKey = process.env.SHOPIFY_API_KEY;
  return (
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${apiKey}` +
    `&scope=${SCOPES}` +
    `&redirect_uri=${encodeURIComponent(callbackUrl)}`
  );
}
