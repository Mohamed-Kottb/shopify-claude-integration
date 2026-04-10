---
name: shopify-product-uploader
description: "Upload a SINGLE product to Shopify through conversation. Use when the user says: add a product, upload a product, create a product, new product, I want to add [product name], أضف منتج, ارفع منتج. Requires the Claude Shopify Integ MCP connector. DO NOT trigger for CSV files, Excel sheets, spreadsheets, or multiple products — those go to shopify-product-manager."
---

# Shopify Product Uploader

Upload a single product to a Shopify store by having a conversation, then calling the MCP tools.

## Step 0 — List stores and ask which store

Call `list_stores`. If only one store, use it automatically. If multiple, ask: "Which store do you want to upload to?"

Also ask: "Is this one product or multiple?" — if multiple, stop and tell them to use the product manager skill instead.

## Step 1 — Read the store silently (no messages to user)

Call these 3 in parallel:
- `get_products` (store, limit: 5) — see how products look in this store
- `get_collections` (store) — available collections
- `get_metafield_definitions` (store, owner_type: "product") — all metafield definitions

Classify metafield definitions:
- **Ask user about:** `custom.*`, `descriptor.*`
- **Skip (app-managed):** `shopify.*`, `reviews.*`, `judgeme.*`, `vstar.*`, `mc-facebook.*`, `global.*`

Known skip list for torath store: `custom.bosta_product_id` (set by Bosta app automatically — never ask)

## Step 2 — Ask ALL questions in ONE message

Send a single message with every field you need. Format as a numbered list. Include:

1. Product title
2. Description (what the product is, its features)
3. Price
4. Compare-at price (original price, for sales — optional)
5. Vendor / brand
6. Product type
7. Tags (comma-separated — also used for collection assignment)
8. Status: Draft or Active?
9. Variants — does it have size/color/other options? If yes, list them with prices and SKUs
10. Images — do you have image URLs, or local files on your Mac?
11. For each user-fillable metafield found in Step 1: ask with its display name

**Never ask about:** Bosta ID, SEO fields (auto-generate these), app-managed metafields

## Step 3 — Confirm before creating

Show a summary of everything collected. Ask: "Looks good? Should I create the product?"

## Step 4 — ONE create_product call with complete data

Call `create_product` with:
- title, body_html, vendor, product_type, tags, status
- Full variants array — each variant must have: price, sku, inventory_quantity, option values
- Images (if URLs provided)
- metafields array for any custom.* or descriptor.* values collected

**CRITICAL: Never call create_product without complete variant data including prices.**

## Step 5 — Upload local images if needed

If user said they have local files (not URLs):
- Tell them: "I can't access local files directly through this interface. Please either: (a) upload the image to Shopify Files first and give me the URL, or (b) drag the image into this chat if the interface supports it."
- If they provide a URL after upload, call `add_product_image`

## Step 6 — SEO metafields (auto-generate, no need to ask)

After product is created, call `set_product_metafields` with:
- `global.title_tag` = first 70 chars of title
- `global.description_tag` = first 160 chars of description

## Step 7 — Done

Show the product ID and title. Remind: "The product was created as Draft. Go to Shopify admin to publish it when ready."
