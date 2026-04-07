# Shopify Claude Integration

Connect multiple Shopify stores to Claude AI. Manage products, orders, customers, themes, and images — all from your terminal using natural language. No API costs for analysis.

Built with Node.js + TypeScript. Uses Shopify's OAuth for secure multi-store access.

---

## How it works

```
Shopify Store → OAuth install → Token saved → Claude Code analyzes data
```

- Fetch live data from any connected store with one command
- Ask Claude Code to analyze, suggest, or act on the data
- Update products, upload images, manage themes — all from terminal
- Webhooks listen for store events in real-time

---

## Quick Start

### 1. Clone and install
```bash
git clone https://github.com/YOUR_USERNAME/claude-shopify-meta
cd claude-shopify-meta
npm install
```

### 2. Create a Shopify Partner app
1. Go to [partners.shopify.com](https://partners.shopify.com)
2. Create an app → get **Client ID** and **Client Secret**
3. Add redirect URL: `https://YOUR-SERVER-URL/auth/callback`
4. Set distribution to **Custom**

### 3. Configure environment
```bash
cp .env.example .env
```
Fill in `.env`:
```
SHOPIFY_API_KEY=your_client_id
SHOPIFY_API_SECRET=your_client_secret
WEBHOOK_CALLBACK_URL=https://your-server-url.com
```

### 4. Start the server
```bash
npm run webhook
```

### 5. Connect a store
```bash
npm run install:store -- storename.myshopify.com
```
Open the link → store owner authorizes → credentials saved automatically.

### 6. Fetch and analyze
```bash
npm run fetch -- storename orders
npm run fetch -- storename products
npm run fetch -- storename analytics
```
Paste output into Claude Code and ask anything.

---

## Commands

| Command | Description |
|---------|-------------|
| `npm run fetch -- <store> orders` | Recent orders |
| `npm run fetch -- <store> products` | Products + inventory |
| `npm run fetch -- <store> customers` | Customer list |
| `npm run fetch -- <store> analytics` | Orders + products + customers |
| `npm run fetch -- <store> themes` | Theme list |
| `npm run fetch -- <store> webhooks` | Registered webhooks |
| `npm run upload -- <store> image <id> <path>` | Upload image from local file |
| `npm run upload -- <store> images <id> <p1> <p2>` | Upload multiple images |
| `npm run upload -- <store> product <title> <path>` | Create product with image |
| `npm run install:store -- <store.myshopify.com>` | Generate OAuth install link |
| `npm run stores:list` | List connected stores |
| `npm run webhook` | Start OAuth + webhook server |

---

## Deploy to Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)

1. Fork this repo on GitHub
2. Connect to Railway → **New Project → Deploy from GitHub**
3. Add environment variables (same as `.env`)
4. Add a **Volume** mounted at `/data/stores` and set `STORES_DIR=/data/stores`
5. Done — your permanent URL is ready

---

## Architecture

```
src/
├── core/          # Types, logger, store loader
├── shopify/       # Products, orders, customers, themes, images, webhooks
├── auth/          # OAuth install + callback flow
├── cli/           # fetch.ts + upload.ts — run locally
└── webhooks/      # Express server + event handlers

stores/
└── <store-name>/
    ├── .env        # Credentials (never committed)
    └── config.json # Per-store settings
```

**Key patterns:**
- All Shopify REST POST/PUT calls use `DataType.JSON` from `@shopify/shopify-api`
- Store credentials are isolated — loaded per store via `dotenv.config({ path })`
- Webhook server responds `200 OK` immediately, processes async (Shopify 5s timeout)
- On Railway: set `STORES_DIR=/data/stores` with a mounted volume for persistence

---

## Adding more stores

Repeat for each store:
```bash
npm run install:store -- newstore.myshopify.com
# Send link → authorize → store folder auto-created
npm run fetch -- newstore orders   # verify
```

---

## Phase 2 — Meta Integration

Placeholder hooks exist in `src/webhooks/handlers.ts` for:
- Product catalog sync to Meta
- Abandoned cart remarketing
- Checkout event tracking

Meta config per store lives in `stores/<name>/config.json` under the `meta` key.

---

## License

MIT — free to use, modify, and distribute.
