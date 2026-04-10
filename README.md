# Shopify Claude Integration

Connect multiple Shopify stores to Claude. Manage products, orders, customers, collections, discounts, inventory, and more — directly from Claude via MCP tools. No API costs for analysis.

Built with Node.js + TypeScript. Deployed on Railway. Uses Shopify OAuth for secure multi-store access.

---

## How it works

```
Shopify Store → OAuth install (Railway) → Credentials saved → Claude has 28 Shopify tools
```

**Two ways to use:**
- **Claude Code CLI** — MCP stdio server, registered once per machine
- **Claude desktop app** — Add as a custom connector via Railway URL

---

## Quick Start

### 1. Clone and install
```bash
git clone https://github.com/YOUR_USERNAME/shopify-claude-integration
cd shopify-claude-integration
npm install
```

### 2. Create a Shopify Partner app
1. Go to [partners.shopify.com](https://partners.shopify.com)
2. Create an app → get **Client ID** and **Client Secret**
3. Add redirect URL: `https://YOUR-RAILWAY-URL.up.railway.app/auth/callback`
4. Set distribution to **Custom** (or Public for multi-merchant)

### 3. Deploy to Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)

1. Fork this repo → connect to Railway → **New Project → Deploy from GitHub**
2. Set environment variables:
   ```
   SHOPIFY_API_KEY=your_client_id
   SHOPIFY_API_SECRET=your_client_secret
   WEBHOOK_CALLBACK_URL=https://your-railway-url.up.railway.app
   ADMIN_KEY=choose_a_secret_key
   ```
3. Add a **Volume** mounted at `/data/stores`, set `STORES_DIR=/data/stores`
4. Deploy — your permanent URL is live

### 4. Connect a store

Open in your browser:
```
https://your-railway-url.up.railway.app/auth/install?shop=storename.myshopify.com
```

Store owner authorizes → credentials saved to Railway volume → webhooks auto-registered.

Pull credentials to your local machine:
```bash
curl "https://your-railway-url.up.railway.app/admin/stores/<name>/env?key=YOUR_ADMIN_KEY" \
  > stores/<name>/.env
```

Verify:
```bash
npm run fetch -- <name> orders
```

### 5. Set up MCP (Claude Code CLI)

```bash
npm run build
claude mcp add shopify node "$(pwd)/dist/mcp/server.js" -e "STORES_DIR=$(pwd)/stores"
```

Restart Claude Code. Claude now has direct Shopify tools in every session.

### 6. Set up connector (Claude desktop app)

In Claude desktop → **Customize → Connectors → Add custom connector**:
```
https://your-railway-url.up.railway.app/mcp?key=YOUR_ADMIN_KEY
```

---

## Available MCP Tools (28)

| Category | Tool | Description |
|----------|------|-------------|
| Store | `list_stores` | List all connected stores |
| Orders | `get_orders` | Fetch orders (filter by status) |
| | `cancel_order` | Cancel an order |
| | `fulfill_order` | Create a fulfillment with optional tracking |
| | `get_order_refunds` | View refunds for an order |
| Products | `get_products` | List products |
| | `update_product` | Update title, price, status, tags, variants, etc. |
| | `create_product` | Create a new product (draft) |
| | `bulk_create_products` | Create multiple products in one call |
| | `add_product_image` | Add an image to an existing product |
| | `delete_product` | Permanently delete a product |
| Metafields | `get_product_metafields` | Get all metafields for a product |
| | `set_product_metafields` | Create or update metafields on a product |
| | `get_metafield_definitions` | List metafield definitions for a resource type |
| Collections | `get_collections` | List custom + smart collections |
| | `get_collection_products` | Products inside a collection |
| | `create_collection` | Create a custom collection |
| Customers | `get_customers` | List customers |
| | `search_customers` | Search by name, email, or phone |
| | `update_customer` | Update tags, notes, marketing preferences |
| Discounts | `get_discounts` | List all price rules |
| | `create_discount` | Create a discount code (price rule + code in one step) |
| Inventory | `get_locations` | List warehouse/store locations |
| | `get_inventory` | Get inventory levels (filter by location) |
| | `set_inventory` | Set quantity at a specific location |
| Analytics | `get_analytics` | Orders + products + customers summary in one call |
| Settings | `get_themes` | List themes, show active theme |
| | `get_webhooks` | List registered webhooks |

---

## Local CLI Commands

```bash
npm run fetch -- <store> orders          # Recent orders
npm run fetch -- <store> products        # Products + inventory
npm run fetch -- <store> customers       # Customer list
npm run fetch -- <store> analytics       # Combined summary
npm run fetch -- <store> themes          # Theme list
npm run fetch -- <store> webhooks        # Registered webhooks

npm run upload -- <store> image <id> <path>          # Upload single image
npm run upload -- <store> images <id> <p1> <p2>      # Upload multiple images
npm run upload -- <store> product "Title" <path>     # Create product with image (draft)

npm run stores:list                      # List locally connected stores
npm run build                            # Compile TypeScript → dist/
```

---

## Admin API

All endpoints require `?key=YOUR_ADMIN_KEY`.

```
GET    /admin/stores                      # List connected stores
GET    /admin/stores/<name>/env           # Download store credentials to local
DELETE /admin/stores/<name>              # Remove a store
POST   /admin/stores/<name>/connect      # Manually connect a store (no OAuth needed)
POST   /admin/stores/<name>/rename       # Rename a store
GET    /health                           # Health check
```

### Connect a store without OAuth

If you already have a Shopify access token (from a custom app), POST it directly:

```bash
curl -X POST "https://your-railway-url.up.railway.app/admin/stores/my-store/connect?key=YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "storeUrl": "https://my-store.myshopify.com",
    "accessToken": "shpat_xxxx",
    "apiKey": "your_api_key",
    "apiSecret": "your_api_secret"
  }'
```

The store is immediately available to all MCP tools — no OAuth flow, no store owner action needed.

### Rename a store

```bash
curl -X POST "https://your-railway-url.up.railway.app/admin/stores/old-name/rename?key=YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "newName": "new-name" }'
```

---

## Architecture

```
src/
├── core/          # Types, logger, store loader
├── shopify/       # Products, orders, customers, collections,
│                  # discounts, inventory, fulfillments, themes, images, webhooks
├── auth/          # OAuth install + callback
├── cli/           # fetch.ts + upload.ts (run locally)
├── mcp/           # server.ts (stdio) + tools.ts (28 shared tools)
└── webhooks/      # Express server + event handlers

stores/
└── <store-name>/
    ├── .env        # Credentials — never committed, Railway volume only
    └── config.json # Per-store settings (optional)
```

**Key patterns:**
- Store credentials isolated per folder, loaded via `dotenv.config({ path })`
- `config.json` is optional — stores connected via OAuth work without it
- All Shopify REST POST/PUT use `DataType.JSON` from `@shopify/shopify-api`
- Webhook server responds `200 OK` immediately, processes async (Shopify 5s limit)
- MCP HTTP uses `enableJsonResponse: true` — plain JSON, no SSE, reliable on Railway CDN
- Only store folders with a `.env` file are listed as connected

---

## Environment Variables

| Variable | Where | Description |
|----------|-------|-------------|
| `SHOPIFY_API_KEY` | Railway + local `.env` | Shopify Partner app Client ID |
| `SHOPIFY_API_SECRET` | Railway + local `.env` | Shopify Partner app Client Secret |
| `WEBHOOK_CALLBACK_URL` | Railway + local `.env` | Your Railway URL |
| `ADMIN_KEY` | Railway | Protects admin + MCP endpoints |
| `STORES_DIR` | Railway | Path to stores volume (`/data/stores`) |
| `PORT` / `WEBHOOK_PORT` | Railway | Server port (Railway sets `PORT` automatically) |

---

## Claude Skills

The `skills/` folder contains Claude desktop skills that work on top of the MCP connector:

| Skill | What it does |
|-------|-------------|
| `shopify-product-uploader` | Add a single product through conversation — asks you the questions, then calls the MCP tools |
| `shopify-product-manager` | Transform Excel/CSV files into Shopify-ready import CSVs, or upload directly via MCP |

See [`skills/README.md`](skills/README.md) for installation instructions.

---

## Phase 2 — Meta Integration

Placeholder hooks in `src/webhooks/handlers.ts`:
- Product catalog sync to Meta
- Abandoned cart remarketing
- Checkout event tracking

Meta config per store: `stores/<name>/config.json` → `meta` key (`pixelId`, `catalogId`, `accessToken`).

---

## License

MIT
