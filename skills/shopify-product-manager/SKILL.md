---
name: shopify-product-manager
description: "Shopify BULK product data management skill for CSV and file-based workflows. Use this skill ONLY when the user has: an Excel file, a CSV file, a spreadsheet, a list of MULTIPLE products, or wants to generate a Shopify import CSV. Triggers on: product CSV, Excel sheet, spreadsheet, bulk upload, multiple products, product import file, fix CSV, clean spreadsheet, variant expansion across many products. DO NOT trigger for adding a single product through conversation — that is handled by shopify-product-uploader. This skill takes files or bulk data as input and produces a Shopify-ready CSV as output."
---

# Shopify Product Manager

Transform any product data (messy Excel, CSV, text, lists, or typed info) into a perfect Shopify-compatible product import CSV.

## Quick reference

Read `references/shopify-columns.md` BEFORE processing any product data — it contains the exact 57-column Shopify CSV spec, auto-generation rules, variant expansion logic, and validation rules.

## Core workflow

### Step 1: Identify input type

Determine what the user has provided:

- **Uploaded file** (xlsx, csv, tsv) → Read with pandas, inspect columns and rows
- **Pasted text or list** → Parse product info from unstructured text
- **Typed product details** → Extract fields from natural language
- **Mix of the above** → Handle each input, merge results

### Step 2: Check for a project profile

Ask: "Is this for an existing project, or should we set up a new one?"

Project profiles store defaults that persist via Claude's memory. A profile includes:
- Project/store name
- Default vendor
- Default tags pattern
- Default product type
- Default weight (grams) — NOTE: user's base default is NO weight (leave empty)
- Tax settings (charge tax: yes/no) — NOTE: user's base default is FALSE (no tax)
- Shipping settings (requires shipping: yes/no)
- Fulfillment service (default: manual)
- Any custom metafield mappings
- Currency

**User's global defaults (apply to ALL projects unless overridden by a project profile):**
- Charge tax = FALSE
- Weight = (empty / not used)
- Weight unit = (empty)

If the user has a profile saved in memory, apply those defaults automatically. If not, offer to create one.

### Step 3: Map and clean the data

**For uploaded files:**
1. Read all columns and show the user a summary: "I found X products with these columns: [list]. Here is how I will map them to Shopify fields:"
2. Auto-map columns using fuzzy matching (see `references/shopify-columns.md` for the column alias map)
3. Detect metafield columns (see Step 3.5 below)
4. Show the mapping table and ask user to confirm before proceeding
5. Flag any columns that could not be mapped

**For text/list input:**
1. Extract product information (title, price, description, variants, etc.)
2. Show what was extracted and ask user to confirm or correct
3. Ask user if there are any metafields to include

### Step 3.5: Detect and handle metafields

Metafields are custom product fields in Shopify. They appear as EXTRA columns in the CSV beyond the standard 57.

**Auto-detection from uploaded files:**
Scan all column names for metafield patterns. Shopify metafield columns follow this format:
```
Display Name (product.metafields.namespace.key)
```
Examples:
- `fragrance_notes (product.metafields.custom.fragrance_notes)`
- `Perfume performance (product.metafields.custom.perfume_performance)`
- `Material (product.metafields.custom.material)`
- `Color (product.metafields.shopify.color-pattern)`

Detection regex: any column matching `(product.metafields.` somewhere in the name.

NOTE: The standard column `Color (product.metafields.shopify.color-pattern)` is ALREADY part of the 57 base columns — do not treat it as a custom metafield. Only columns with patterns OTHER than `product.metafields.shopify.color-pattern` are custom metafields.

**If metafield columns are detected in the source file:**
1. List them and show the user: "I found these metafield columns: [list]. I'll include them in the output."
2. Keep them exactly as-is — same column header format, same data
3. These columns are appended AFTER the standard 57 columns in the output CSV

**If NO metafield columns are detected:**
Ask the user: "Are there any custom metafields you want to include for these products?"
- If YES: ask for each metafield:
  - Display name (what it's called, e.g., "Fragrance Notes")
  - Namespace.key (the Shopify metafield identifier, e.g., `custom.fragrance_notes`)
  - The column header will be formatted as: `Display Name (product.metafields.namespace.key)`
  - Then ask for the values (or if they'll provide them separately)
- If NO: proceed without metafields

**If the source file has columns that LOOK like metafields but don't follow Shopify format:**
For columns that don't match any standard Shopify field AND don't have the `(product.metafields.*)` pattern:
1. Show these unmatched columns to the user
2. Ask: "These columns don't match standard Shopify fields. Are any of them metafields?"
3. If yes, ask for the Shopify metafield namespace.key for each one
4. Format them as proper metafield columns: `Column Name (product.metafields.namespace.key)`

**Metafield data in variant rows:**
- Metafield values appear ONLY on the first row of a product (the parent row)
- Variant rows leave metafield columns EMPTY (metafields are product-level, not variant-level)

### Step 4: Validate data

Run these validation checks on every product:
- Title is present (REQUIRED)
- Price is present and numeric (REQUIRED)
- Price is not negative
- Compare-at price (if present) is higher than price
- Weight is numeric (if present)
- Inventory quantity is a whole number (if present)
- Image URLs are valid URLs (if present)
- SKU has no duplicates across all products
- No empty rows or garbage data

### Step 5: Auto-generate missing fields

Apply these rules (see full spec in `references/shopify-columns.md`):
- **URL handle**: slugify title (lowercase, spaces→hyphens, remove special chars, transliterate non-Latin)
- **SEO title**: first 70 characters of title
- **SEO description**: first 160 characters of description
- **Status**: Active
- **Published on online store**: TRUE
- **Charge tax**: TRUE (or from project profile)
- **Inventory tracker**: shopify
- **Continue selling when out of stock**: DENY
- **Weight unit**: g
- **Requires shipping**: TRUE (or from project profile)
- **Fulfillment service**: manual (or from project profile)
- **Gift card**: FALSE
- **Image position**: auto-number starting at 1
- **Google Shopping fields**: all empty
- **All "Linked To" columns**: empty

Apply project profile defaults for: Vendor, Tags, Type, Weight, Tax, Shipping.

### Step 6: Expand variants

If products have variants (size, color, material, etc.):

1. Identify variant columns in the source data
2. First CSV row for a product: ALL product-level data + first variant data
3. Each additional variant: new row with ONLY these columns filled:
   - URL handle (same as parent — this links variants to the product)
   - Option1/2/3 values
   - SKU
   - Price, Compare-at price, Cost per item
   - Barcode (if different per variant)
   - Inventory quantity
   - Weight (if different per variant)
   - Variant image URL (if different per variant)
   - ALL other columns are EMPTY for variant rows
4. Option1 name, Option2 name, Option3 name appear ONLY on the first row

### Step 7: Generate output — CSV or Direct API Upload

**Check if the Shopify MCP connector is active** (look for the "Claude Shopify Integ" connector in the conversation). If it is:

**Option A — Direct API Upload (preferred when MCP is available):**
1. Ask: "I can push these products directly to your Shopify store via the MCP connector. Which store? Or should I generate a CSV instead?"
2. If direct upload chosen:
   - Convert the validated/expanded product data into an array of product objects (title, body_html, vendor, product_type, tags, status, variants with price/sku/inventory_quantity, images with src URLs)
   - If products have metafields, include a `metafields` array in each product object: `[{ namespace, key, value, type }]` — these are created inline with the product
   - Call `bulk_create_products` with the store name and the products array
   - Present the creation summary (IDs, titles, any errors)
   - After creation, if any additional metafields need to be set on existing products, use `set_product_metafields` tool
3. After upload, remind user: all products are created as **draft** by default — go to Shopify admin to publish

**Option B — Shopify CSV (when MCP is not available or user prefers it):**
1. **Generate the Shopify CSV** with:
   - All 57 standard columns in exact order (see reference)
   - Any metafield columns APPENDED after the 57th column
   - Metafield column headers must follow the format: `Display Name (product.metafields.namespace.key)`
   - Metafield values only on parent product rows, empty on variant rows
2. **Generate a report** summarizing:
   - Total products processed
   - Total variants generated
   - Fields that were auto-generated
   - Metafields included (list each one with its namespace.key)
   - Issues found and how they were resolved
   - Items flagged for user review (with specific details)
3. **Present both files** to the user

## Project profile management

When user says "set up a project profile" or "save defaults for [store name]":

1. Ask for: store/project name, default vendor, default tags, product type, weight, currency, tax settings, shipping settings
2. Summarize the profile and ask user to confirm
3. Tell the user to save this as a memory so it persists across conversations

When user says "use [project name] profile" or mentions a known project:
- Apply all saved defaults automatically
- Mention which defaults were applied

## Handling edge cases

**Multi-language product names**: Keep original language. For URL handle generation, transliterate non-Latin characters (Arabic → romanized, Chinese → pinyin, etc.) using a best-effort approach.

**Missing prices**: Flag as ERROR — do not guess. Ask user to provide.

**Duplicate SKUs**: Flag as WARNING — show which products have duplicates and ask user to resolve.

**Products with 3+ option types**: Shopify supports max 3 options (Option1, Option2, Option3). If source has more, flag as ERROR and ask user which 3 to keep.

**Very large files (100+ products)**: Process in batches, show progress updates.

**Images as file uploads (not URLs)**: Inform user that Shopify CSV requires URLs. Suggest they upload images to their Shopify admin or a reliable image hosting service first, then provide URLs. See the Image Hosting section below for why Google Drive won't work.

**Competitor content for metafields**: When the user provides screenshots or text from a competitor's product page and asks you to "rephrase" or "paraphrase" it for metafields, keep the exact same structure — same number of bullet points, same meaning — and just reword it. Do not invent extra items, expand bullet lists, or add new categories that the original didn't have. The user wants their version of the competitor's content, not entirely new content.

## Image hosting for Shopify CSV

This is one of the most common pain points in Shopify CSV imports. Shopify's importer fetches images from URLs server-side (not the user's browser). The image host must serve the raw image file to any anonymous HTTP request — no authentication, no redirect to login pages, no confirmation screens.

### Google Drive does NOT work

Google Drive is what most users try first, and it consistently fails. Even when a Drive folder is shared as "Anyone with the link", Google's redirect chain adds `authuser=0` parameters that require an authenticated browser session. Shopify's server isn't logged into anyone's Google account, so it gets blocked.

All of these Google Drive URL formats have been tested and fail for Shopify import:
- `https://drive.google.com/uc?export=view&id=FILE_ID` — auth redirect
- `https://drive.google.com/uc?export=download&confirm=t&id=FILE_ID` — auth redirect
- `https://drive.google.com/thumbnail?id=FILE_ID&sz=w1000` — 404
- `https://lh3.googleusercontent.com/d/FILE_ID` — returns HTML, not image

The confusing part is that some images may appear to work while others fail in the same folder, due to Google's inconsistent caching behavior. This makes it look like a per-file issue when it's actually a systemic problem.

**If the user already has images on Google Drive**, tell them upfront that these URLs won't work reliably for Shopify import and recommend alternatives.

### Recommended image hosts (in order of preference)

1. **Shopify Files** (Settings → Files in Shopify admin) — Most reliable. Images live on Shopify's own CDN (`cdn.shopify.com/s/files/...`). Upload via admin or Shopify API.
2. **imgbb.com** — Free, simple, supports bulk upload. Returns direct `i.ibb.co` URLs that any server can fetch.
3. **Cloudinary** — Free tier with 25GB, has API for bulk upload. Good for large catalogs.
4. **AWS S3 / Google Cloud Storage (public bucket)** — More technical, but bulletproof for large stores.

## Collections and product organization

Shopify's product CSV import does NOT automatically assign products to collections. This is a very common misconception — a "Custom Collections" column in the products CSV will at best create empty collection shells. Products won't appear inside those collections after import.

### How to properly set up collections

The recommended approach uses **Tags in the CSV + Smart Collections in Shopify admin**:

1. **In the CSV**: Set the `Tags` column for each product to match the desired collection name (e.g., "Anime", "Football", "Gym"). Tags import correctly with the products CSV.

2. **After import, in Shopify admin**: For each collection, go to Products → Collections → click the collection → change type from "Manual" to "Automated" → set condition to "Product tag is equal to [tag name]" → Save.

This is better than manual collections because products are auto-assigned based on tags, new products with the same tag are auto-included, and there's no need to manually place hundreds of products.

Always walk the user through the Smart Collection setup steps so they know exactly what to do after importing.

### Products in multiple collections

A product can belong to multiple collections. Give it multiple comma-separated tags in the CSV (e.g., "Art, Group Frames"), then create a Smart Collection for each with its own tag rule.

### Folder-to-collection mapping

When the user's source data is organized in folders (Google Drive, local filesystem), use the folder names as both Tags and collection names. This creates a clean 1:1 mapping. Always tell the user which collection names were derived from folders so they can verify.

## Important rules

- ALWAYS read `references/shopify-columns.md` before generating any CSV
- ALWAYS show the user a mapping preview before processing
- ALWAYS validate before generating output
- NEVER guess at prices — always ask
- NEVER skip the report — users need to know what was changed
- The CSV column order must be EXACT — Shopify will reject files with wrong column order
- Use UTF-8 encoding with BOM for Excel compatibility
- Wrap fields containing commas in double quotes
