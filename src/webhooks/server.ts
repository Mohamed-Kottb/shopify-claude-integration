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
      enableJsonResponse: true,   // plain JSON responses — avoids SSE timeout issues on Railway CDN
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
      // MCP spec: 404 for unknown/expired sessions — client should POST initialize to start a new session
      res.status(404).json({ error: 'Session not found. POST /mcp with an initialize request to start a new session.' });
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

// Admin UI — store management dashboard
app.get('/admin', (req, res) => {
  if (!requireAdminKey(req, res)) return;
  const stores = listStores();
  const key = req.query['key'] as string;
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shopify Claude — Admin</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f6f6f7; color: #1a1a2e; }
    .header { background: #1a1a2e; color: white; padding: 20px 32px; display: flex; align-items: center; gap: 12px; }
    .header h1 { font-size: 20px; font-weight: 600; }
    .badge { background: #5c6ac4; color: white; font-size: 11px; padding: 2px 8px; border-radius: 12px; }
    .container { max-width: 900px; margin: 32px auto; padding: 0 24px; }
    .card { background: white; border-radius: 12px; padding: 24px; margin-bottom: 24px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
    .card h2 { font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #1a1a2e; }
    .stores-grid { display: grid; gap: 10px; }
    .store-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: #f6f6f7; border-radius: 8px; }
    .store-name { font-weight: 500; font-size: 15px; }
    .store-actions { display: flex; gap: 8px; }
    .btn { padding: 6px 14px; border-radius: 6px; border: none; cursor: pointer; font-size: 13px; font-weight: 500; text-decoration: none; }
    .btn-danger { background: #fef0f0; color: #d72c0d; }
    .btn-danger:hover { background: #ffd7d5; }
    .empty { color: #666; font-size: 14px; }
    form { display: grid; gap: 14px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    label { font-size: 13px; font-weight: 500; color: #444; display: block; margin-bottom: 4px; }
    input { width: 100%; padding: 9px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; }
    input:focus { outline: none; border-color: #5c6ac4; box-shadow: 0 0 0 2px rgba(92,106,196,0.15); }
    .btn-primary { background: #5c6ac4; color: white; padding: 10px 20px; font-size: 14px; border-radius: 8px; border: none; cursor: pointer; font-weight: 500; }
    .btn-primary:hover { background: #4959bd; }
    .msg { padding: 10px 14px; border-radius: 6px; font-size: 13px; margin-bottom: 16px; }
    .msg.ok { background: #e3f1df; color: #1b6b2f; }
    .msg.err { background: #fef0f0; color: #d72c0d; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Shopify Claude Integration</h1>
    <span class="badge">${stores.length} stores</span>
  </div>
  <div class="container">
    ${req.query['ok'] ? `<div class="msg ok">✓ Store "${req.query['ok']}" connected successfully.</div>` : ''}
    ${req.query['deleted'] ? `<div class="msg ok">✓ Store "${req.query['deleted']}" removed.</div>` : ''}
    ${req.query['err'] ? `<div class="msg err">✗ ${req.query['err']}</div>` : ''}

    <div class="card">
      <h2>Connected Stores</h2>
      <div class="stores-grid">
        ${stores.length === 0 ? '<p class="empty">No stores connected yet.</p>' : stores.map(s => `
        <div class="store-row">
          <span class="store-name">🏪 ${s}</span>
          <div class="store-actions">
            <form method="POST" action="/admin/stores/${s}/delete?key=${key}" onsubmit="return confirm('Remove ${s}?')">
              <button type="submit" class="btn btn-danger">Remove</button>
            </form>
          </div>
        </div>`).join('')}
      </div>
    </div>

    <div class="card">
      <h2>Connect a New Store</h2>
      <p style="font-size:13px;color:#666;margin-bottom:16px;">
        <strong>Legacy apps (created before Jan 2026):</strong> Shopify admin → Settings → Apps → Develop apps → your app → API credentials. Send Client ID, Client secret, and Admin API access token.<br><br>
        <strong>New Dev Dashboard apps (after Jan 2026):</strong> dev.shopify.com → your app → Client ID and Client secret only. Leave the access token blank — the system will fetch it automatically using the client credentials grant.
      </p>
      <form method="POST" action="/admin/connect?key=${key}">
        <div class="form-row">
          <div>
            <label>Store name (your label)</label>
            <input name="name" placeholder="artify-walls" required>
          </div>
          <div>
            <label>Store URL</label>
            <input name="storeUrl" placeholder="https://zvm0hg-mh.myshopify.com" required>
          </div>
        </div>
        <div>
          <label>Admin API access token <span style="color:#888;font-weight:400">(shpat_... — legacy apps only; leave blank for new Dev Dashboard apps)</span></label>
          <input name="accessToken" placeholder="shpat_xxxxxxxxxxxx (optional)">
        </div>
        <div class="form-row">
          <div>
            <label>Client ID <span style="color:#888;font-weight:400">(from their app)</span></label>
            <input name="apiKey" placeholder="Client ID" required>
          </div>
          <div>
            <label>Client secret <span style="color:#888;font-weight:400">(from their app)</span></label>
            <input name="apiSecret" placeholder="Client secret" required>
          </div>
        </div>
        <div>
          <button type="submit" class="btn-primary">Connect Store</button>
        </div>
      </form>
    </div>
  </div>
</body>
</html>`;
  res.type('html').send(html);
});

// Handle form submission from admin UI
app.post('/admin/connect', express.urlencoded({ extended: false }), express.json(), (req, res) => {
  if (!requireAdminKey(req, res)) return;
  const { name, storeUrl, accessToken, apiKey, apiSecret } = req.body as Record<string, string>;
  const key = req.query['key'] as string;
  if (!name || !storeUrl || !apiKey || !apiSecret) {
    res.redirect(`/admin?key=${key}&err=Store+name%2C+URL%2C+Client+ID+and+Client+secret+are+required`);
    return;
  }
  const storePath = path.join(STORES_DIR, name);
  fs.mkdirSync(storePath, { recursive: true });
  const envContent = [
    `SHOPIFY_STORE_URL=${storeUrl}`,
    accessToken ? `SHOPIFY_ACCESS_TOKEN=${accessToken}` : '',
    `SHOPIFY_API_KEY=${apiKey}`,
    `SHOPIFY_API_SECRET=${apiSecret}`,
  ].filter(Boolean).join('\n') + '\n';
  fs.writeFileSync(path.join(storePath, '.env'), envContent);
  res.redirect(`/admin?key=${key}&ok=${name}`);
});

// Handle store removal from admin UI
app.post('/admin/stores/:name/delete', (req, res) => {
  if (!requireAdminKey(req, res)) return;
  const name = req.params['name'] ?? '';
  const key = req.query['key'] as string;
  const storePath = path.join(STORES_DIR, name);
  if (fs.existsSync(storePath)) fs.rmSync(storePath, { recursive: true, force: true });
  res.redirect(`/admin?key=${key}&deleted=${name}`);
});

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

// Manually connect a store by providing credentials directly (no OAuth needed)
// POST /admin/stores/:name/connect?key=ADMIN_KEY
// Body: { storeUrl, accessToken, apiKey, apiSecret, webhookSecret? }
app.post('/admin/stores/:name/connect', express.json(), (req, res) => {
  if (!requireAdminKey(req, res)) return;
  const name = req.params['name'] ?? '';
  const { storeUrl, accessToken, apiKey, apiSecret, webhookSecret } = req.body as {
    storeUrl?: string; accessToken?: string; apiKey?: string; apiSecret?: string; webhookSecret?: string;
  };
  if (!storeUrl || !apiKey || !apiSecret) {
    res.status(400).json({ error: 'Required: storeUrl, apiKey, apiSecret. accessToken is optional for Dev Dashboard apps.' });
    return;
  }
  const storePath = path.join(STORES_DIR, name);
  fs.mkdirSync(storePath, { recursive: true });
  const envContent = [
    `SHOPIFY_STORE_URL=${storeUrl}`,
    `SHOPIFY_ACCESS_TOKEN=${accessToken}`,
    `SHOPIFY_API_KEY=${apiKey}`,
    `SHOPIFY_API_SECRET=${apiSecret}`,
    webhookSecret ? `SHOPIFY_WEBHOOK_SECRET=${webhookSecret}` : '',
  ].filter(Boolean).join('\n') + '\n';
  fs.writeFileSync(path.join(storePath, '.env'), envContent);
  res.json({ connected: name, storeUrl });
});

// Rename a store
// POST /admin/stores/:name/rename?key=ADMIN_KEY
// Body: { newName }
app.post('/admin/stores/:name/rename', express.json(), (req, res) => {
  if (!requireAdminKey(req, res)) return;
  const oldName = req.params['name'] ?? '';
  const { newName } = req.body as { newName?: string };
  if (!newName) { res.status(400).json({ error: 'Required: newName' }); return; }
  const oldPath = path.join(STORES_DIR, oldName);
  const newPath = path.join(STORES_DIR, newName);
  if (!fs.existsSync(oldPath)) { res.status(404).send('Store not found'); return; }
  if (fs.existsSync(newPath)) { res.status(409).json({ error: `Store "${newName}" already exists` }); return; }
  fs.renameSync(oldPath, newPath);
  res.json({ renamed: { from: oldName, to: newName } });
});

const PORT = Number(process.env.PORT ?? process.env.WEBHOOK_PORT ?? 3000);
app.listen(PORT, () => {
  logger.success(`Webhook server listening on port ${PORT}`);
});
