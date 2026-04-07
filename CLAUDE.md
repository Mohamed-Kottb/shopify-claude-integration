# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-store Shopify management system. Connects up to ~10 client stores via OAuth, fetches live data on demand, and uses **Claude Code (this terminal)** for all analysis — no Anthropic API calls, no API cost.

Meta integration is Phase 2 (placeholders exist in `webhooks/handlers.ts`).

## Commands

```bash
npm run fetch -- <store> <command>                     # Fetch live data from a store (see below)
npm run upload -- <store> <command> [args]             # Upload images or create products from local files
npm run webhook                                        # Start OAuth + webhook server (port 3000)
npm run install:store -- <store.myshopify.com>         # Generate OAuth install link for a client
npm run stores:list                                    # List all connected stores
npm run build                                          # Compile TypeScript → dist/
```

### Fetch commands
```bash
npm run fetch -- torath orders      # Recent orders
npm run fetch -- torath products    # Products + inventory
npm run fetch -- torath customers   # Customers
npm run fetch -- torath analytics   # Orders + products + customers combined
npm run fetch -- torath themes      # Theme list and active theme
npm run fetch -- torath webhooks    # Registered webhooks
```

### Upload commands (local files — no external URLs needed)
```bash
npm run upload -- torath image <product-id> ~/Desktop/photo.jpg        # Upload one image
npm run upload -- torath images <product-id> ~/img1.jpg ~/img2.jpg     # Upload multiple images
npm run upload -- torath product "عطر جديد" ~/Desktop/photo.jpg        # Create product with image
```
New products created via `upload product` are set to **draft** automatically.

## Architecture

```
src/
├── core/
│   ├── types.ts          # All shared TypeScript interfaces (ShopifyOrder, ShopifyProduct, etc.)
│   ├── logger.ts         # Structured console logger
│   └── storeLoader.ts    # Loads store .env + config.json by folder name
├── shopify/
│   ├── client.ts         # Creates Shopify REST + GraphQL clients per store session
│   ├── products.ts       # Product CRUD
│   ├── orders.ts         # Order read/update
│   ├── customers.ts      # Customer read/search/update
│   ├── themes.ts         # Theme asset read/write
│   ├── images.ts         # Product image upload (base64 from local file), get, delete
│   └── webhooks.ts       # Register / list / delete webhooks
├── auth/
│   ├── oauth.ts          # OAuth install + callback handlers, token save logic
│   └── generate-link.ts  # CLI script to generate install links
├── cli/
│   ├── fetch.ts          # CLI data fetcher — all npm run fetch commands live here
│   └── upload.ts         # CLI uploader — local image upload + product creation via base64
├── webhooks/
│   ├── server.ts         # Express server — OAuth routes + webhook listeners
│   └── handlers.ts       # Per-event handlers (order, product, inventory, cart, checkout)
└── index.ts              # Lists connected stores and available commands
```

## Connecting a New Store

Requires ngrok (or a real server) running and `npm run webhook` active.

```bash
# 1. Generate the install link
npm run install:store -- clientstore.myshopify.com

# 2. Send link to client (or open yourself if you have admin access)
# 3. Client authorizes → OAuth callback fires → stores/clientstore/.env auto-created
# 4. Verify
npm run fetch -- clientstore orders
```

The OAuth callback (`/auth/callback`) validates HMAC, exchanges code for token, and writes:
- `stores/<store-name>/.env` — credentials
- `stores/<store-name>/config.json` — copied from `store-template`

## Key Patterns

- **Store isolation**: `storeLoader.ts` calls `dotenv.config({ path: stores/<name>/.env })` per store. Env vars are loaded fresh per store — never shared.
- **DataType.JSON**: All Shopify REST POST/PUT calls use `type: DataType.JSON` (imported from `@shopify/shopify-api`) — not the string `'application/json'`.
- **Webhook response**: `server.ts` responds `200 OK` immediately before async processing — Shopify drops connections after 5s.
- **Analysis workflow**: Run `npm run fetch` to pull data, then ask Claude Code to analyze it in this terminal. No Anthropic API is used.

## Environment Variables

Root `.env`:
```
SHOPIFY_API_KEY=          # Partner Dashboard → App → API credentials (Client ID)
SHOPIFY_API_SECRET=       # Partner Dashboard → App → API credentials (Client Secret)
WEBHOOK_PORT=3000
WEBHOOK_CALLBACK_URL=     # ngrok or Railway URL (no trailing slash)
```

Per-store `stores/<name>/.env` (auto-created on OAuth, or manual):
```
SHOPIFY_STORE_URL=
SHOPIFY_ACCESS_TOKEN=
SHOPIFY_API_KEY=
SHOPIFY_API_SECRET=
SHOPIFY_WEBHOOK_SECRET=
```

## Running the Server (required for OAuth installs)

```bash
# Terminal 1 — tunnel
ngrok http 3000

# Terminal 2 — server
npm run webhook
```

ngrok free plan generates a new URL on each restart. Update `WEBHOOK_CALLBACK_URL` in root `.env` and the Redirect URL in Shopify Partner Dashboard → App → Versions when this happens.

## Phase 2 — Meta Integration

Hooks exist in `handlers.ts`: `handleProductUpdate` (catalog sync), `handleCartUpdate` and `handleCheckoutCreate` (remarketing). Meta config per store lives in `stores/<name>/config.json` under the `meta` key (`pixelId`, `catalogId`, `accessToken`).
