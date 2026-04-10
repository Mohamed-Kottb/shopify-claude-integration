# Claude Skills for Shopify Integration

These skills work with the Claude desktop app + the Shopify MCP connector.

## Skills included

| Skill | Purpose | Trigger |
|-------|---------|---------|
| `shopify-product-uploader` | Upload a single product through conversation | "add a product", "upload a product", "أضف منتج" |
| `shopify-product-manager` | Bulk product import from Excel/CSV | "I have a spreadsheet", "bulk upload", "convert this CSV" |

## How to install

### Option 1 — Copy to Claude desktop skills folder (manual)

Find your Claude desktop skills directory:
- **Mac:** `~/Library/Application Support/Claude/local-agent-mode-sessions/skills-plugin/<session-id>/<session-id>/skills/`
- The session IDs change — look for the folder with the most recent timestamp

Copy each skill folder into that directory:
```bash
cp -r skills/shopify-product-uploader "<your-skills-path>/"
cp -r skills/shopify-product-manager "<your-skills-path>/"
```

Restart Claude desktop. The skills appear automatically.

### Option 2 — Use skill-creator (recommended, survives session resets)

In Claude desktop, start a new conversation and say:

> /skill-creator

Paste the contents of the SKILL.md file when prompted. The skill-creator saves it permanently so it won't be wiped on session reset.

## Requirements

- Claude desktop app with the Shopify MCP connector added as a custom connector
- Your Railway server URL and admin key (see main README for setup)
- The connector URL format: `https://your-railway-url.up.railway.app/mcp?key=YOUR_ADMIN_KEY`
