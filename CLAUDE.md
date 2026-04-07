# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-store Shopify management system. Connects stores via OAuth, and exposes **27 MCP tools** so Claude has direct Shopify access in every session — no copy-paste, no API costs for analysis.

**Two MCP modes:**
- **stdio** — Claude Code CLI (registered in `~/.claude.json`)
- **HTTP** — Claude desktop app connector (POST `/mcp?key=ADMIN_KEY` on Railway)

**Deployed:** Railway (permanent server, auto-deploys on push)
**GitHub:** `https://github.com/Mohamed-Kottb/shopify-claude-integration`

Meta integration is Phase 2 (stubs in `webhooks/handlers.ts`).

## Commands

```bash
npm run build                                          # Compile TypeScript → dist/
npm run fetch -- <store> <command>                     # Fetch live data from a store (local)
npm run upload -- <store> <command> [args]             # Upload images / create products (local)
npm run stores:list                                    # List locally connected stores
npm run mcp                                            # Start MCP server manually (auto-started by Claude)
```

### Fetch commands
```bash
npm run fetch -- <store-name> orders
npm run fetch -- <store-name> products
npm run fetch -- <store-name> customers
npm run fetch -- <store-name> analytics
npm run fetch -- <store-name> themes
npm run fetch -- <store-name> webhooks
```

### Upload commands (local files — no external URLs needed)
```bash
npm run upload -- <store-name> image <product-id> ~/Desktop/photo.jpg
npm run upload -- <store-name> images <product-id> ~/img1.jpg ~/img2.jpg
npm run upload -- <store-name> product "Product Title" ~/Desktop/photo.jpg
```
New products created via `upload product` are set to **draft** automatically.

## Architecture

```
src/
├── core/
│   ├── types.ts          # All shared TypeScript interfaces
│   ├── logger.ts         # Structured console logger
│   └── storeLoader.ts    # Loads store .env (config.json optional) by folder name
├── shopify/
│   ├── client.ts         # Creates Shopify REST + GraphQL clients per store
│   ├── products.ts       # Product CRUD + delete
│   ├── orders.ts         # Order read/update/count
│   ├── customers.ts      # Customer read/search/update
│   ├── themes.ts         # Theme asset read/write
│   ├── images.ts         # Product image upload (base64 from local file)
│   ├── webhooks.ts       # Register / list / delete webhooks
│   ├── collections.ts    # Custom + smart collections CRUD
│   ├── discounts.ts      # Price rules + discount code creation
│   ├── inventory.ts      # Locations + inventory levels read/set
│   ├── fulfillments.ts   # Fulfill order / cancel order / refunds
│   └── metafields.ts     # Product metafield get / set (create-or-update) / delete
├── auth/
│   ├── oauth.ts          # OAuth install + callback — auto-registers webhooks on connect
│   └── generate-link.ts  # CLI: generate install links (local only, no nonce)
├── cli/
│   ├── fetch.ts          # CLI data fetcher
│   └── upload.ts         # CLI uploader — base64 image upload + product creation
├── mcp/
│   ├── server.ts         # stdio MCP server (Claude Code CLI)
│   └── tools.ts          # Shared tool definitions — 27 tools, used by both modes
├── webhooks/
│   ├── server.ts         # Express server — OAuth + webhook listeners + admin API + HTTP MCP
│   └── handlers.ts       # Per-event handlers (order, product, inventory, cart, checkout)
└── index.ts              # Lists connected stores
```

## MCP Tools (27 total)

| Category | Tools |
|----------|-------|
| Store | `list_stores` |
| Orders | `get_orders`, `cancel_order`, `fulfill_order`, `get_order_refunds` |
| Products | `get_products`, `update_product`, `create_product`, `delete_product`, `bulk_create_products`, `add_product_image` |
| Metafields | `get_product_metafields`, `set_product_metafields` |
| Collections | `get_collections`, `get_collection_products`, `create_collection` |
| Customers | `get_customers`, `search_customers`, `update_customer` |
| Discounts | `get_discounts`, `create_discount` |
| Inventory | `get_locations`, `get_inventory`, `set_inventory` |
| Analytics | `get_analytics` |
| Settings | `get_themes`, `get_webhooks` |

## Connecting a New Store

The Railway server handles OAuth permanently — no ngrok needed.

```bash
# 1. Open in browser (use your Railway URL):
https://<your-railway-url>/auth/install?shop=storename.myshopify.com

# 2. Store owner authorizes → credentials saved to Railway volume → webhooks auto-registered

# 3. Pull credentials to local machine:
curl "https://<your-railway-url>/admin/stores/<name>/env?key=YOUR_ADMIN_KEY" > stores/<name>/.env

# 4. Verify
npm run fetch -- <name> orders
```

**Important:** Always use the Railway `/auth/install?shop=` URL — NOT `npm run install:store`. The CLI script generates a link without a nonce which causes "Missing required OAuth parameters".

## Railway Deployment

- **Server:** Always running, auto-deploys on GitHub push
- **Volume:** `/data/stores` — store credentials persist across deploys
- **Variables:** `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `WEBHOOK_CALLBACK_URL`, `STORES_DIR=/data/stores`, `WEBHOOK_PORT`, `ADMIN_KEY`
- **Health check:** `GET /health`

### Admin API (protected by ADMIN_KEY)
```
GET    /admin/stores?key=KEY              # List connected stores on Railway
GET    /admin/stores/<name>/env?key=KEY   # Download store .env to local machine
DELETE /admin/stores/<name>?key=KEY       # Remove a store folder from Railway volume
```

## MCP Server Setup

### Claude Code CLI (stdio)
```bash
npm run build
claude mcp add shopify node "/path/to/dist/mcp/server.js" -e "STORES_DIR=/path/to/stores"
```
Restart Claude Code after registering.

### Claude Desktop App (HTTP connector)
In Claude desktop → Customize → Connectors → Add custom connector:
```
https://<your-railway-url>/mcp?key=YOUR_ADMIN_KEY
```

## Key Patterns

- **Store isolation**: `storeLoader.ts` calls `dotenv.config({ path: stores/<name>/.env })` per store — env vars never shared between stores.
- **config.json optional**: `storeLoader` uses defaults if `config.json` is absent — stores connected via OAuth work without it.
- **DataType.JSON**: All Shopify REST POST/PUT calls use `type: DataType.JSON` (from `@shopify/shopify-api`).
- **Webhook response**: `server.ts` responds `200 OK` immediately before async processing — Shopify drops connections after 5s.
- **Auto webhook registration**: `oauth.ts` calls `registerWebhooks()` automatically after OAuth callback.
- **MCP sessions**: HTTP MCP uses `StreamableHTTPServerTransport` with `enableJsonResponse: true` (plain JSON, no SSE) stored in a session map. Sessions reset on Railway redeploy — Claude desktop reconnects automatically.
- **listStores filter**: Only directories with a `.env` file are returned — empty/partial OAuth folders are hidden.

## Environment Variables

Root `.env` (local only — never committed):
```
SHOPIFY_API_KEY=
SHOPIFY_API_SECRET=
WEBHOOK_PORT=3000
WEBHOOK_CALLBACK_URL=https://your-railway-url.up.railway.app
ADMIN_KEY=
```

Per-store `stores/<name>/.env` (auto-created on OAuth — never committed):
```
SHOPIFY_STORE_URL=
SHOPIFY_ACCESS_TOKEN=
SHOPIFY_API_KEY=
SHOPIFY_API_SECRET=
SHOPIFY_WEBHOOK_SECRET=
```

## Skills

Claude desktop personal skills that work with this MCP connector (in `~/.claude/skills/`):

| Skill | Trigger |
|-------|---------|
| `shopify-product-manager` | Preparing/uploading product data, CSV conversion, variant expansion |
| `shopify-theme-editor` | Editing Liquid files, CSS, JS in Shopify themes |
| `shopify-cro` | Conversion rate analysis and optimization |
| `shopify-analytics` | Revenue trends, cohort analysis, best sellers |
| `shopify-customer-care` | Customer lookup, order history, issue resolution |

Skills use MCP tools directly — no CSV export needed for product uploads.

**Metafield types used in this store:**
- `custom.*` — `single_line_text_field`, `list.single_line_text_field` (value = JSON array string)
- `global.description_tag` / `global.title_tag` — `string` (SEO fields)
- `shopify.occasion` / `shopify.season` — `list.metaobject_reference` (GID values, set via admin only)

## Phase 2 — Meta Integration

Stubs in `handlers.ts`: `handleProductUpdate` (catalog sync), `handleCartUpdate`, `handleCheckoutCreate` (remarketing). Meta config per store in `stores/<name>/config.json` under `meta` key (`pixelId`, `catalogId`, `accessToken`).
