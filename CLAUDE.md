# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-store Shopify management system. Connects stores via OAuth or manual credentials, and exposes **27 MCP tools** so Claude has direct Shopify access in every session — no copy-paste, no API costs for analysis.

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
│   ├── storeLoader.ts    # Async — parses store .env directly, resolves access token
│   └── tokenCache.ts     # In-memory cache for client credentials grant tokens (24h)
├── shopify/
│   ├── client.ts         # Creates Shopify REST + GraphQL clients per store
│   ├── products.ts       # Product CRUD via GraphQL (migrated from deprecated REST)
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
| Metafields | `get_product_metafields`, `set_product_metafields`, `get_metafield_definitions` |
| Collections | `get_collections`, `get_collection_products`, `create_collection` |
| Customers | `get_customers`, `search_customers`, `update_customer` |
| Discounts | `get_discounts`, `create_discount` |
| Inventory | `get_locations`, `get_inventory`, `set_inventory` |
| Analytics | `get_analytics` |
| Settings | `get_themes`, `get_webhooks` |

## Connecting a New Store

### Option A — Dev Dashboard app (post-Jan 2026, no static token)

1. Store owner goes to **dev.shopify.com** → Create app → set scopes → Install on store
2. Sends you: Store URL + Client ID + Client secret
3. You go to admin UI → Connect Store → fill in (leave access token blank)
4. System auto-fetches a 24h token via client credentials grant — refreshes automatically

### Option B — Legacy custom app (created before Jan 2026)

1. Store owner goes to **Shopify admin → Settings → Apps → Develop apps → their app → API credentials**
2. Sends you: Store URL + Client ID + Client secret + Admin API access token (`shpat_...`)
3. You go to admin UI → Connect Store → fill in all 4 fields

### Option C — OAuth flow (your own stores only)

Only works if the store is in the same Shopify Plus org as your Partner app.

```
https://<your-railway-url>/auth/install?shop=storename.myshopify.com
```

### Verify connection
```
GET https://<your-railway-url>/admin/stores/<name>/test?key=YOUR_ADMIN_KEY
```
Returns `{ ok: true, tokenPrefix: "shpca_..." }` if working.

## Railway Deployment

- **Server:** Always running, auto-deploys on GitHub push
- **Volume:** `/data/stores` — store credentials persist across deploys
- **Variables:** `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET` (Partner app, OAuth only), `WEBHOOK_CALLBACK_URL`, `STORES_DIR=/data/stores`, `WEBHOOK_PORT`, `ADMIN_KEY`
- **Health check:** `GET /health`

### Admin API (protected by ADMIN_KEY)
```
GET    /admin/stores?key=KEY                  # List connected stores
GET    /admin/stores/<name>/env?key=KEY       # Download store .env
GET    /admin/stores/<name>/test?key=KEY      # Test token resolution — use to diagnose auth issues
DELETE /admin/stores/<name>?key=KEY           # Remove a store
POST   /admin/stores/<name>/connect?key=KEY   # Connect store via REST (JSON body)
POST   /admin/stores/<name>/rename?key=KEY    # Rename a store folder
GET    /admin?key=KEY                         # Admin UI dashboard
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
After Railway redeploys, disconnect and reconnect the connector to reset the MCP session.

## Key Patterns

- **Store isolation**: `storeLoader.ts` uses `dotenv.parse()` to read each store's `.env` directly — env vars never bleed between stores (critical for multi-store).
- **Token resolution**: `loadStore()` is async. If `SHOPIFY_ACCESS_TOKEN` is absent, `tokenCache.ts` fetches a 24h client credentials token. Token is cached in memory with 5-min expiry buffer.
- **storeUrl format**: Stored with or without `https://` — `tokenCache.ts` normalises it before fetching. REST client also accepts both formats.
- **Products use GraphQL**: `products.ts` was migrated from the deprecated REST API to GraphQL (`productCreate`, `productUpdate`, `productDelete`, `products` query). All other modules still use REST.
- **GID ↔ numeric ID**: GraphQL returns `gid://shopify/Product/123` — `gidToId()` extracts the numeric part for type compatibility.
- **config.json optional**: `storeLoader` uses defaults if `config.json` is absent.
- **Webhook response**: `server.ts` responds `200 OK` immediately before async processing — Shopify drops connections after 5s.
- **MCP sessions**: HTTP MCP uses `StreamableHTTPServerTransport` with `enableJsonResponse: true`. Sessions reset on Railway redeploy.
- **listStores filter**: Only directories with a `.env` file are returned.

## Railway Variables — what they're for

| Variable | Purpose |
|---|---|
| `SHOPIFY_API_KEY` | Your Partner app Client ID — used ONLY for OAuth flow |
| `SHOPIFY_API_SECRET` | Your Partner app Client Secret — used ONLY for OAuth flow |
| `STORES_DIR` | Path to volume: `/data/stores` |
| `WEBHOOK_CALLBACK_URL` | Your Railway URL |
| `ADMIN_KEY` | Protects `/admin` and `/mcp` endpoints |

Per-store credentials (Client ID + Secret for each store's own app) go in the **volume** at `/data/stores/<name>/.env` — NOT in Railway Variables.

## Per-store .env format

```
SHOPIFY_STORE_URL=k21going.myshopify.com        # with or without https://
SHOPIFY_ACCESS_TOKEN=shpat_xxx                  # optional — legacy apps only
SHOPIFY_API_KEY=your_client_id                  # required
SHOPIFY_API_SECRET=your_client_secret           # required
SHOPIFY_WEBHOOK_SECRET=                         # optional
```

## Skills

Claude desktop personal skills that work with this MCP connector (in `skills/` folder in repo):

| Skill | Trigger |
|-------|---------|
| `shopify-product-uploader` | Add a single product through conversation |
| `shopify-product-manager` | Bulk product import from Excel/CSV, variant expansion |

**Metafield types used in this store:**
- `custom.*` — `single_line_text_field`, `list.single_line_text_field` (value = JSON array string)
- `global.description_tag` / `global.title_tag` — `string` (SEO fields)
- `shopify.occasion` / `shopify.season` — `list.metaobject_reference` (GID values, set via admin only)

## Phase 2 — Meta Integration

Stubs in `handlers.ts`: `handleProductUpdate` (catalog sync), `handleCartUpdate`, `handleCheckoutCreate` (remarketing). Meta config per store in `stores/<name>/config.json` under `meta` key (`pixelId`, `catalogId`, `accessToken`).
