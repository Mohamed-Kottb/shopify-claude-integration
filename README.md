# Shopify Claude Integration

Connect multiple Shopify stores to Claude. Manage products, orders, customers, collections, discounts, inventory, and more — directly from Claude via MCP tools.

Built with Node.js + TypeScript. Deployed on Railway. Supports both legacy custom apps (permanent tokens) and new Dev Dashboard apps (auto-refreshing 24h tokens via client credentials grant).

---

## How it works

```
Shopify Store → credentials saved to Railway volume → Claude has 27 Shopify tools
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

### 2. Deploy to Railway

1. Fork this repo → connect to Railway → **New Project → Deploy from GitHub**
2. Set environment variables:
   ```
   WEBHOOK_CALLBACK_URL=https://your-railway-url.up.railway.app
   ADMIN_KEY=choose_a_secret_key
   ```
3. Add a **Volume** mounted at `/data/stores`, set `STORES_DIR=/data/stores`
4. Deploy — your permanent URL is live

> `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET` are only needed if you use the OAuth flow (your own Partner app). For manually connected client stores, they're not required.

### 3. Connect a store

#### New Dev Dashboard app (post-Jan 2026) — no permanent token needed

Ask the store owner to:
1. Go to **dev.shopify.com** → Create app → set scopes → Install on their store
2. Send you: Store URL + Client ID + Client secret

Then open the admin UI:
```
https://your-railway-url.up.railway.app/admin?key=YOUR_ADMIN_KEY
```
Fill in the form (leave Admin API access token blank). The system fetches tokens automatically.

#### Legacy custom app (created before Jan 2026)

Store owner goes to **Shopify admin → Settings → Apps → Develop apps → their app → API credentials** and sends you all 4 values (Client ID, Client secret, Admin API access token, Store URL).

Fill in the admin UI form with all 4 fields.

#### Verify connection
```
GET https://your-railway-url.up.railway.app/admin/stores/<name>/test?key=YOUR_ADMIN_KEY
```
Returns `{ "ok": true, "tokenPrefix": "shpca_..." }` when working.

### 4. Set up MCP (Claude Code CLI)

```bash
npm run build
claude mcp add shopify node "$(pwd)/dist/mcp/server.js" -e "STORES_DIR=$(pwd)/stores"
```

Restart Claude Code. Claude now has direct Shopify tools in every session.

### 5. Set up connector (Claude desktop app)

In Claude desktop → **Customize → Connectors → Add custom connector**:
```
https://your-railway-url.up.railway.app/mcp?key=YOUR_ADMIN_KEY
```

> After Railway redeploys (e.g. after a code push), disconnect and reconnect the connector to reset the MCP session.

---

## Available MCP Tools (27)

| Category | Tool | Description |
|----------|------|-------------|
| Store | `list_stores` | List all connected stores |
| Orders | `get_orders` | Fetch orders (filter by status) |
| | `cancel_order` | Cancel an order |
| | `fulfill_order` | Create a fulfillment with optional tracking |
| | `get_order_refunds` | View refunds for an order |
| Products | `get_products` | List products (GraphQL) |
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
| | `create_discount` | Create a discount code |
| Inventory | `get_locations` | List warehouse/store locations |
| | `get_inventory` | Get inventory levels |
| | `set_inventory` | Set quantity at a specific location |
| Analytics | `get_analytics` | Orders + products + customers summary |
| Settings | `get_themes` | List themes, show active theme |
| | `get_webhooks` | List registered webhooks |

---

## Local CLI Commands

```bash
npm run fetch -- <store> orders          # Recent orders
npm run fetch -- <store> products        # Products
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
GET    /admin                             # Admin UI dashboard
GET    /admin/stores                      # List connected stores
GET    /admin/stores/<name>/env           # Download store credentials
GET    /admin/stores/<name>/test          # Test token resolution (diagnose auth issues)
DELETE /admin/stores/<name>               # Remove a store
POST   /admin/stores/<name>/connect       # Connect a store via JSON body
POST   /admin/stores/<name>/rename        # Rename a store
GET    /health                            # Health check
```

### Connect a store via REST (no UI)

```bash
curl -X POST "https://your-railway-url.up.railway.app/admin/stores/my-store/connect?key=YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "storeUrl": "my-store.myshopify.com",
    "apiKey": "client_id",
    "apiSecret": "client_secret"
  }'
```

`accessToken` is optional — omit it for Dev Dashboard apps (token fetched automatically).

---

## Architecture

```
src/
├── core/          # Types, logger, store loader (async), token cache
├── shopify/       # Products (GraphQL), orders, customers, collections,
│                  # discounts, inventory, fulfillments, themes, images, webhooks, metafields
├── auth/          # OAuth install + callback
├── cli/           # fetch.ts + upload.ts (run locally)
├── mcp/           # server.ts (stdio) + tools.ts (27 shared tools)
└── webhooks/      # Express server + event handlers

stores/
└── <store-name>/
    ├── .env        # Credentials — never committed, Railway volume only
    └── config.json # Per-store settings (optional)

skills/
├── shopify-product-uploader/SKILL.md
└── shopify-product-manager/SKILL.md
```

**Key patterns:**
- Store credentials isolated per folder — `storeLoader.ts` uses `dotenv.parse()` so stores never share env vars
- `SHOPIFY_ACCESS_TOKEN` is optional — if absent, system uses client credentials grant (Dev Dashboard apps)
- Token cache: 24h client credentials tokens cached in memory, refreshed 5 min before expiry
- Products use GraphQL (`productCreate`, `productUpdate`, `productDelete`, `products` query) — REST products API deprecated by Shopify
- Webhook server responds `200 OK` immediately, processes async (Shopify 5s limit)
- MCP HTTP uses `enableJsonResponse: true` — plain JSON, reliable on Railway CDN

---

## Environment Variables

### Railway Variables (global)

| Variable | Required | Description |
|----------|----------|-------------|
| `ADMIN_KEY` | Yes | Protects admin + MCP endpoints |
| `STORES_DIR` | Yes | Path to stores volume (`/data/stores`) |
| `WEBHOOK_CALLBACK_URL` | Yes | Your Railway URL |
| `SHOPIFY_API_KEY` | OAuth only | Partner app Client ID |
| `SHOPIFY_API_SECRET` | OAuth only | Partner app Client Secret |
| `PORT` / `WEBHOOK_PORT` | No | Server port (Railway sets `PORT` automatically) |

### Per-store `.env` (in Railway volume)

```
SHOPIFY_STORE_URL=my-store.myshopify.com
SHOPIFY_API_KEY=client_id_from_their_app
SHOPIFY_API_SECRET=client_secret_from_their_app
SHOPIFY_ACCESS_TOKEN=shpat_xxx   # optional — legacy apps only
SHOPIFY_WEBHOOK_SECRET=          # optional
```

---

## Claude Skills

The `skills/` folder contains Claude desktop skills:

| Skill | What it does |
|-------|-------------|
| `shopify-product-uploader` | Add a single product through conversation |
| `shopify-product-manager` | Transform Excel/CSV files into Shopify-ready imports, or upload directly via MCP |

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
