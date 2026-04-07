import express, { Request, Response } from 'express';
import * as dotenv from 'dotenv';
import {
  handleOrderCreate,
  handleProductUpdate,
  handleInventoryUpdate,
  handleCartUpdate,
  handleCheckoutCreate,
} from './handlers';
import { handleInstall, handleCallback } from '../auth/oauth';
import { logger } from '../core/logger';

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

const PORT = Number(process.env.PORT ?? process.env.WEBHOOK_PORT ?? 3000);
app.listen(PORT, () => {
  logger.success(`Webhook server listening on port ${PORT}`);
});
