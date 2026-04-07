import express, { Request, Response } from 'express';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  handleOrderCreate,
  handleProductUpdate,
  handleInventoryUpdate,
  handleCartUpdate,
  handleCheckoutCreate,
} from './handlers';
import { handleInstall, handleCallback } from '../auth/oauth';
import { listStores } from '../core/storeLoader';
import { createShopifyMcpServer } from '../mcp/tools';
import { logger } from '../core/logger';

const STORES_DIR = process.env.STORES_DIR ?? path.join(process.cwd(), 'stores');

dotenv.config();

const app = express();

// MCP session store — keyed by session ID assigned on initialize
const mcpTransports: Record<string, StreamableHTTPServerTransport> = {};

// OAuth routes — must be before express.raw()
app.get('/auth/install', handleInstall);
app.get('/auth/callback', (req, res) => { void handleCallback(req, res); });

// MCP over HTTP — must be before express.raw() so JSON body parses correctly
// URL: https://shopify-claude-integration-production.up.railway.app/mcp?key=ADMIN_KEY
app.post('/mcp', express.json(), async (req: Request, res: Response): Promise<void> => {
  if (!requireAdminKey(req, res)) return;
  try {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (sessionId && mcpTransports[sessionId]) {
      // Existing session — reuse transport
      await mcpTransports[sessionId].handleRequest(req, res, req.body as Record<string, unknown>);
      return;
    }

    // New session — only allow initialize as the first message
    const body = req.body as Record<string, unknown>;
    if (body?.['method'] !== 'initialize') {
      res.status(400).json({ jsonrpc: '2.0', error: { code: -32000, message: 'No valid session. Send initialize first.' }, id: null });
      return;
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => { mcpTransports[id] = transport; },
    });
    transport.onclose = () => {
      if (transport.sessionId) delete mcpTransports[transport.sessionId];
    };
    const server = createShopifyMcpServer();
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  } catch (err) {
    logger.error('MCP HTTP error', err);
    if (!res.headersSent) res.status(500).json({ error: 'MCP server error' });
  }
});

app.get('/mcp', async (req: Request, res: Response): Promise<void> => {
  if (!requireAdminKey(req, res)) return;
  try {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !mcpTransports[sessionId]) {
      res.status(400).json({ error: 'Invalid or missing session ID' });
      return;
    }
    await mcpTransports[sessionId].handleRequest(req, res);
  } catch (err) {
    logger.error('MCP HTTP SSE error', err);
    if (!res.headersSent) res.status(500).json({ error: 'MCP server error' });
  }
});

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

app.delete('/admin/stores/:name', (req, res) => {
  if (!requireAdminKey(req, res)) return;
  const storePath = path.join(STORES_DIR, req.params['name'] ?? '');
  if (!fs.existsSync(storePath)) { res.status(404).send('Store not found'); return; }
  fs.rmSync(storePath, { recursive: true, force: true });
  res.json({ deleted: req.params['name'] });
});

const PORT = Number(process.env.PORT ?? process.env.WEBHOOK_PORT ?? 3000);
app.listen(PORT, () => {
  logger.success(`Webhook server listening on port ${PORT}`);
});
