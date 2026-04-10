# Shopify product CSV column specification

## Exact column order (all 57 columns)

The CSV MUST contain these columns in this EXACT order. Do not rename, reorder, or omit any column.

```
Title
URL handle
Description
Vendor
Product category
Type
Tags
Published on online store
Status
SKU
Barcode
Option1 name
Option1 value
Option1 Linked To
Option2 name
Option2 value
Option2 Linked To
Option3 name
Option3 value
Option3 Linked To
Price
Compare-at price
Cost per item
Charge tax
Tax code
Unit price total measure
Unit price total measure unit
Unit price base measure
Unit price base measure unit
Inventory tracker
Inventory quantity
Continue selling when out of stock
Weight value (grams)
Weight unit for display
Requires shipping
Fulfillment service
Product image URL
Image position
Image alt text
Variant image URL
Gift card
SEO title
SEO description
Color (product.metafields.shopify.color-pattern)
Google Shopping / Google product category
Google Shopping / Gender
Google Shopping / Age group
Google Shopping / Manufacturer part number (MPN)
Google Shopping / Ad group name
Google Shopping / Ads labels
Google Shopping / Condition
Google Shopping / Custom product
Google Shopping / Custom label 0
Google Shopping / Custom label 1
Google Shopping / Custom label 2
Google Shopping / Custom label 3
Google Shopping / Custom label 4
```

## Column alias map for fuzzy matching

When reading messy input files, map these common column name variations to the correct Shopify column:

| Shopify column | Common aliases to match |
|---|---|
| Title | title, product title, product name, name, item name, item, product, اسم المنتج |
| Description | description, desc, product description, body, body html, body_html, details, الوصف |
| Vendor | vendor, brand, manufacturer, supplier, maker, المورد, العلامة التجارية |
| Product category | product category, category, product type category, الفئة |
| Type | type, product type, النوع |
| Tags | tags, keywords, labels, الكلمات المفتاحية |
| SKU | sku, item number, item code, product code, code, article number, رمز المنتج |
| Barcode | barcode, upc, ean, gtin, isbn, الباركود |
| Price | price, selling price, retail price, السعر |
| Compare-at price | compare at price, compare-at price, compare price, original price, was price, old price, msrp, السعر الأصلي |
| Cost per item | cost, cost per item, unit cost, cogs, التكلفة |
| Weight value (grams) | weight, weight grams, weight g, الوزن |
| Inventory quantity | inventory, inventory quantity, qty, quantity, stock, stock quantity, in stock, المخزون, الكمية |
| Product image URL | image, image url, photo, photo url, picture, main image, الصورة |
| Image alt text | alt text, image alt, alt, image description |
| Option1 name | option 1 name, option1, variant option 1 |
| Option1 value | option 1 value, option1 value, size, مقاس |
| Option2 name | option 2 name, option2, variant option 2 |
| Option2 value | option 2 value, option2 value, color, colour, لون |
| Option3 name | option 3 name, option3, variant option 3 |
| Option3 value | option 3 value, option3 value, material, خامة |
| SEO title | seo title, meta title, page title |
| SEO description | seo description, meta description, page description |

Also detect these as VARIANT indicators (column contains variant data that needs expansion):
- size, sizes, مقاس, مقاسات
- color, colors, colour, colours, لون, ألوان
- material, خامة
- style, نمط

## Auto-generation rules

| Field | Rule |
|---|---|
| URL handle | Slugify title: lowercase, replace spaces with hyphens, remove special chars except hyphens, remove consecutive hyphens, transliterate non-Latin chars. Example: "Blue Summer Dress (XL)" → "blue-summer-dress-xl" |
| SEO title | First 70 characters of Title. If title is shorter, use full title. |
| SEO description | First 160 characters of Description. If no description, use title. |
| Published on online store | TRUE |
| Status | Active |
| Charge tax | FALSE (user default — no taxes on products) |
| Tax code | (empty) |
| Unit price total measure | (empty) |
| Unit price total measure unit | (empty) |
| Unit price base measure | (empty) |
| Unit price base measure unit | (empty) |
| Inventory tracker | shopify |
| Continue selling when out of stock | DENY |
| Weight value (grams) | (empty — user default is no weight) |
| Weight unit for display | (empty — user default is no weight) |
| Requires shipping | TRUE |
| Fulfillment service | manual |
| Gift card | FALSE |
| Image position | Auto-increment starting at 1 per product |
| Option1/2/3 Linked To | (empty) |
| All Google Shopping columns | (empty) |
| Color metafield | (empty unless color data is available) |

## Variant expansion rules

### Single product, no variants
One row with all columns filled.

### Product with variants
**Row 1 (parent + first variant):**
- ALL product-level columns filled (Title, URL handle, Description, Vendor, etc.)
- First variant's specific data (Option values, SKU, Price, Qty, etc.)
- Option1 name, Option2 name, Option3 name filled on this row ONLY

**Row 2+ (additional variants):**
- URL handle = same as row 1 (this is how Shopify links variants to parent)
- Title = EMPTY
- Description = EMPTY
- Vendor = EMPTY
- All other product-level columns = EMPTY
- Option1/2/3 name = EMPTY (already defined in row 1)
- Option1/2/3 value = this variant's values
- SKU = this variant's SKU
- Price = this variant's price (or same as parent if no override)
- Compare-at price = this variant's (or same as parent)
- Cost per item = this variant's (or same as parent)
- Barcode = this variant's (if different)
- Inventory quantity = this variant's quantity
- Weight = this variant's weight (or same as parent)
- Variant image URL = this variant's image (if different)
- ALL other columns = EMPTY

### SKU auto-generation pattern
If no SKU provided: `{TitleAbbrev}-{Option1Abbrev}-{Option2Abbrev}`
Example: "Blue Summer Dress", Size "M", Color "Red" → `BSD-M-RED`
- TitleAbbrev = first letter of each word, uppercase, max 4 letters
- Option abbreviations = first 3 chars, uppercase

## Validation rules

### Errors (must fix before generating CSV)
- Missing Title → ERROR: "Product in row X has no title"
- Missing Price → ERROR: "Product '[title]' has no price"
- Negative Price → ERROR: "Product '[title]' has negative price"
- Compare-at price lower than price → ERROR: "Product '[title]' compare-at price is lower than selling price"
- More than 3 option types → ERROR: "Product '[title]' has more than 3 variant options. Shopify supports max 3."
- More than 100 variants per product → ERROR: "Product '[title]' has over 100 variants. Shopify limit is 100."

### Warnings (flag for review but proceed)
- Missing description → WARNING: "Product '[title]' has no description. SEO will suffer."
- Missing inventory quantity → WARNING: "Product '[title]' has no inventory count. Defaulting to 0."
- Duplicate SKU → WARNING: "Duplicate SKU '[sku]' found on products: [list]"
- Very high price (>10000) → WARNING: "Product '[title]' has a high price: [price]. Please verify."
- URL with spaces or special chars in image URL → WARNING: "Product '[title]' has a possibly invalid image URL"
- Missing image → WARNING: "Product '[title]' has no product image"

## CSV formatting requirements

- Encoding: UTF-8 with BOM (byte order mark) for Excel compatibility
- Line endings: CRLF (\r\n)
- Delimiter: comma
- Text qualifier: double quotes (wrap any field containing commas, newlines, or quotes)
- Escape quotes: double-double-quote ("" inside a quoted field)
- Boolean values: TRUE / FALSE (uppercase)
- Empty fields: leave empty (no space, no null, no N/A)

## Metafield columns

### What are metafields?
Metafields are custom product fields that extend Shopify's standard product data. They store additional information like ingredients, materials, care instructions, fragrance notes, etc.

### Column naming format
Metafield columns in Shopify CSV follow this EXACT pattern:
```
Display Name (product.metafields.namespace.key)
```

Examples:
```
fragrance_notes (product.metafields.custom.fragrance_notes)
Perfume performance (product.metafields.custom.perfume_performance)
Material (product.metafields.custom.material)
Care Instructions (product.metafields.custom.care_instructions)
Ingredients (product.metafields.custom.ingredients)
Country of Origin (product.metafields.custom.country_of_origin)
```

The most common namespace is `custom`. The key is usually a snake_case version of the display name.

### Detection regex
To identify metafield columns in source data:
```
\(product\.metafields\.[a-zA-Z_]+\.[a-zA-Z0-9_-]+\)
```

### IMPORTANT: Standard vs custom metafields
The column `Color (product.metafields.shopify.color-pattern)` is part of the STANDARD 57 columns (column #44). It is NOT a custom metafield. Do not duplicate it.

Only columns with `product.metafields.custom.*` or other non-standard namespaces are treated as custom metafield columns to be appended after column 57.

### Position in CSV
Custom metafield columns are placed AFTER all 57 standard columns, in the order they were found in the source data (or the order the user specified).

### Metafields in variant rows
Metafield data is PRODUCT-LEVEL only. In variant-expanded CSVs:
- Parent row (first row of a product): metafield values filled
- Variant rows (subsequent rows): metafield columns are EMPTY

### Converting unmatched columns to metafields
If a source file has columns that don't match any standard Shopify field, they may be metafields. Ask the user. If confirmed, format the column header as:
```
Original Column Name (product.metafields.custom.snake_case_key)
```
Where snake_case_key is the column name lowercased with spaces replaced by underscores.

### Common metafield column naming mistakes

The ONLY valid format is `Display Name (product.metafields.namespace.key)`. These other formats are WRONG and Shopify will ignore them:
- `Metafield: custom.key [type]` — WRONG (this is not Shopify's format)
- `custom.key` — WRONG (missing the full metafield path and display name)
- `product.metafields.custom.key` — WRONG (missing the display name wrapper)

Always use: `key_name (product.metafields.custom.key_name)`

### Metafield value types and formatting

Shopify metafields have different value types that determine how values should be formatted in the CSV cell:

**Single-value types:**
- `single_line_text_field` — Plain text, one line. Example: `Premium quality frame`
- `multi_line_text_field` — Multi-line text. Use newlines within the CSV cell (the CSV writer will auto-wrap in quotes). Example: `Line one\nLine two\nLine three`
- `number_integer` — Whole number. Example: `42`
- `number_decimal` — Decimal number. Example: `3.14`
- `boolean` — `true` or `false`
- `url` — Full URL. Example: `https://example.com`

**List types (multiple values in one cell):**
- `list.single_line_text_field` — Multiple text items, each on its own line within the cell. The CSV module handles quoting automatically.

Example for a `list.single_line_text_field` metafield with 3 items:
```
Sharp HD print with vivid colors
Sturdy lightweight frame
Available in multiple sizes
```
Each item is separated by a newline character (`\n`) inside the CSV cell. The Python `csv` module will automatically wrap the cell in double quotes.

**The column header format is the same regardless of value type** — just `Display Name (product.metafields.namespace.key)`. The type is defined in the Shopify admin metafield definitions, not in the CSV column header.
