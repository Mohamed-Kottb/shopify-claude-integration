# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-store Shopify management system. Connects client stores via OAuth, fetches live data on demand, and uses **Claude Code (this terminal)** for all analysis — no Anthropic API calls, no API cost.

**Deployed:** Railway at `https://shopify-claude-integration-production.up.railway.app`
**GitHub:** `https://github.com/Mohamed-Kottb/shopify-claude-integration`
**MCP Server:** Registered in `~/.claude.json` — Claude has direct Shopify tools in every session.

Meta integration is Phase 2 (stubs exist in `webhooks/handlers.ts`).

## Commands

```bash
npm run fetch -- <store> <command>                     # Fetch live data from a store
npm run upload -- <store> <command> [args]             # Upload images or create products
npm run build                                          # Compile TypeScript → dist/
npm run stores:list                                    # List locally connected stores
npm run install:store -- <store.myshopify.com>         # Generate OAuth install link (local only)
npm run mcp                                            # Start MCP server (normally auto-started by Claude)
```

### Fetch commands
```bash
npm run fetch -- torath orders
npm run fetch -- torath products
npm run fetch -- torath customers
npm run fetch -- torath analytics
npm run fetch -- torath themes
npm run fetch -- torath webhooks
```

### Upload commands (local files — no external URLs needed)
```bash
npm run upload -- torath image <product-id> ~/Desktop/photo.jpg
npm run upload -- torath images <product-id> ~/img1.jpg ~/img2.jpg
npm run upload -- torath product "عطر جديد" ~/Desktop/photo.jpg
```
New products created via `upload product` are set to **draft** automatically.

## Architecture

```
src/
├── core/
│   ├── types.ts          # All shared TypeScript interfaces
│   ├── logger.ts         # Structured console logger
│   └── storeLoader.ts    # Loads store .env + config.json by folder name
├── shopify/
│   ├── client.ts         # Creates Shopify REST + GraphQL clients per store
│   ├── products.ts       # Product CRUD
│   ├── orders.ts         # Order read/update/count
│   ├── customers.ts      # Customer read/search/update
│   ├── themes.ts         # Theme asset read/write
│   ├── images.ts         # Product image upload (base64 from local file)
│   └── webhooks.ts       # Register / list / delete webhooks
├── auth/
│   ├── oauth.ts          # OAuth install + callback — auto-registers webhooks on connect
│   └── generate-link.ts  # CLI: generate install links (local only, no nonce)
├── cli/
│   ├── fetch.ts          # CLI data fetcher
│   └── upload.ts         # CLI uploader — base64 image upload + product creation
├── mcp/
│   └── server.ts         # MCP server — exposes 11 Shopify tools directly to Claude
├── webhooks/
│   ├── server.ts         # Express server — OAuth routes + webhook listeners + admin API
│   └── handlers.ts       # Per-event handlers (order, product, inventory, cart, checkout)
└── index.ts              # Lists connected stores
```

## Connecting a New Store

The Railway server handles OAuth permanently — no ngrok needed.

```bash
# Open this URL in browser (replace with actual store domain):
https://shopify-claude-integration-production.up.railway.app/auth/install?shop=storename.myshopify.com

# After authorize → credentials saved to Railway volume → webhooks auto-registered
# Pull credentials to local machine:
curl "https://shopify-claude-integration-production.up.railway.app/admin/stores/<name>/env?key=ADMIN_KEY" > stores/<name>/.env

# Verify
npm run fetch -- <name> orders
```

**Important:** Always use the Railway `/auth/install?shop=` URL — NOT the link from `npm run install:store`. The CLI script generates a direct link without a nonce, which causes "Missing required OAuth parameters" error.

## Store Setup

Current stores:
- `stores/torath/` — live store (`hkiw6r-ug.myshopify.com`), credentials valid ✅

Store folder naming: use a human-friendly name for the folder (e.g. `torath`). The `.env` inside contains the actual `SHOPIFY_STORE_URL=xxx.myshopify.com`.

## Railway Deployment

- **Server:** Always running, auto-deploys on GitHub push
- **Volume:** `/data/stores` — store credentials persist across deploys
- **Variables:** `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `WEBHOOK_CALLBACK_URL`, `STORES_DIR=/data/stores`, `WEBHOOK_PORT`, `ADMIN_KEY`
- **Health check:** `GET /health`

### Admin API (protected by ADMIN_KEY)
```
GET /admin/stores?key=ADMIN_KEY                    # List connected stores on Railway
GET /admin/stores/<name>/env?key=ADMIN_KEY         # Download store .env to local machine
```

## Key Patterns

- **Store isolation**: `storeLoader.ts` calls `dotenv.config({ path: stores/<name>/.env })` per store — env vars never shared between stores.
- **DataType.JSON**: All Shopify REST POST/PUT calls use `type: DataType.JSON` (from `@shopify/shopify-api`) — never the string `'application/json'`.
- **Webhook response**: `server.ts` responds `200 OK` immediately before async processing — Shopify drops connections after 5s.
- **Auto webhook registration**: `oauth.ts` calls `registerWebhooks()` automatically after OAuth callback succeeds.
- **MCP tools**: `src/mcp/server.ts` exposes 11 tools — `list_stores`, `get_orders`, `get_products`, `get_customers`, `search_customers`, `get_analytics`, `get_themes`, `update_product`, `create_product`, `upload_image`, `get_webhooks`.

## Environment Variables

Root `.env` (local only):
```
SHOPIFY_API_KEY=
SHOPIFY_API_SECRET=
WEBHOOK_PORT=3000
WEBHOOK_CALLBACK_URL=https://shopify-claude-integration-production.up.railway.app
```

Per-store `stores/<name>/.env` (auto-created on OAuth):
```
SHOPIFY_STORE_URL=
SHOPIFY_ACCESS_TOKEN=
SHOPIFY_API_KEY=
SHOPIFY_API_SECRET=
SHOPIFY_WEBHOOK_SECRET=
```

## MCP Server Setup (one-time per machine)

The MCP server is registered in `~/.claude.json`. To register on a new machine:
```bash
npm run build
claude mcp add shopify node "/path/to/dist/mcp/server.js" -e "STORES_DIR=/path/to/stores"
```
Restart Claude Code after registering. Claude then has direct Shopify tools — no `npm run fetch` needed.

## Phase 2 — Meta Integration

Stubs in `handlers.ts`: `handleProductUpdate` (catalog sync), `handleCartUpdate`, `handleCheckoutCreate` (remarketing). Meta config per store in `stores/<name>/config.json` under `meta` key (`pixelId`, `catalogId`, `accessToken`).
