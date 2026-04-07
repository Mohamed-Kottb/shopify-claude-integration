import express, { Request, Response } from 'express';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import {
  handleOrderCreate,
  handleProductUpdate,
  handleInventoryUpdate,
  handleCartUpdate,
  handleCheckoutCreate,
} from './handlers';
import { handleInstall, handleCallback } from '../auth/oauth';
import { listStores } from '../core/storeLoader';
import { logger } from '../core/logger';

const STORES_DIR = process.env.STORES_DIR ?? path.join(process.cwd(), 'stores');

dotenv.config();

const app = express();

// OAuth routes need query string parsing, not raw body
app.get('/auth/install', handleInstall);
app.get('/auth/callback', (req, res) => { void handleCallback(req, res); });

app.use(express.raw({ type: 'application/json' }));

function getStoreDomain(req: Request): string {
  return (req.headers['x-shopify-shop-domain'] as string) ?? 'unknown';
}

function parseBody(req: Request): Record<string, unknown> {
  return JSON.parse(req.body.toString()) as Record<string, unknown>;
}

function handler(
  fn: (data: Record<string, unknown>, domain: string) => Promise<void>
) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const domain = getStoreDomain(req);
      const data = parseBody(req);
      res.status(200).send('OK');           // Respond fast — Shopify requires <5s
      await fn(data, domain);
    } catch (err) {
      logger.error('Webhook handler error', err);
    }
  };
}

app.post('/webhooks/orders-create',           handler((d, s) => handleOrderCreate(d as never, s)));
app.post('/webhooks/orders-updated',          handler((d, s) => handleOrderCreate(d as never, s)));
app.post('/webhooks/products-update',         handler((d, s) => handleProductUpdate(d as never, s)));
app.post('/webhooks/inventory_levels-update', handler((d, s) => handleInventoryUpdate(d as never, s)));
app.post('/webhooks/carts-update',            handler(handleCartUpdate));
app.post('/webhooks/checkouts-create',        handler(handleCheckoutCreate));

app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// Admin endpoints — protected by ADMIN_KEY env var
function requireAdminKey(req: Request, res: Response): boolean {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) { res.status(403).send('ADMIN_KEY not configured'); return false; }
  if (req.query['key'] !== adminKey) { res.status(401).send('Unauthorized'); return false; }
  return true;
}

app.get('/admin/stores', (_req, res) => {
  if (!requireAdminKey(_req, res)) return;
  res.json({ stores: listStores() });
});

app.get('/admin/stores/:name/env', (req, res) => {
  if (!requireAdminKey(req, res)) return;
  const envPath = path.join(STORES_DIR, req.params['name'] ?? '', '.env');
  if (!fs.existsSync(envPath)) { res.status(404).send('Store not found'); return; }
  res.type('text/plain').send(fs.readFileSync(envPath, 'utf-8'));
});

const PORT = Number(process.env.PORT ?? process.env.WEBHOOK_PORT ?? 3000);
app.listen(PORT, () => {
  logger.success(`Webhook server listening on port ${PORT}`);
});
