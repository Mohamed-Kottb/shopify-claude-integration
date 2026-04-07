/**
 * Shared MCP tool definitions and handlers.
 * Used by both the stdio server (Claude Code CLI) and the HTTP server (Railway/Claude desktop app).
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { loadStore, listStores } from '../core/storeLoader';
import type { ShopifyVariant, ShopifyImage, ShopifyProduct } from '../core/types';
import { getOrders, getOrderCount } from '../shopify/orders';
import { getProducts, updateProduct, createProduct, deleteProduct } from '../shopify/products';
import { getCustomers, searchCustomers, updateCustomer } from '../shopify/customers';
import { getThemes, getActiveTheme } from '../shopify/themes';
import { uploadProductImage } from '../shopify/images';
import { listWebhooks } from '../shopify/webhooks';
import { getCollections, getCollectionProducts, createCollection } from '../shopify/collections';
import { getPriceRules, createDiscount } from '../shopify/discounts';
import { getLocations, getInventoryLevels, setInventoryLevel } from '../shopify/inventory';
import { cancelOrder, fulfillOrder, getRefunds } from '../shopify/fulfillments';
import { getProductMetafields, setProductMetafields } from '../shopify/metafields';

export function createShopifyMcpServer(): Server {
  const server = new Server(
    { name: 'shopify-claude-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      // ── Store ──────────────────────────────────────────────────────────────
      {
        name: 'list_stores',
        description: 'List all connected Shopify stores',
        inputSchema: { type: 'object', properties: {}, required: [] },
      },

      // ── Orders ─────────────────────────────────────────────────────────────
      {
        name: 'get_orders',
        description: 'Fetch recent orders from a Shopify store',
        inputSchema: {
          type: 'object',
          properties: {
            store: { type: 'string', description: 'Store name (folder name under stores/)' },
            limit: { type: 'number', description: 'Max orders to return (default 50)' },
            status: { type: 'string', enum: ['open', 'closed', 'cancelled', 'any'] },
          },
          required: ['store'],
        },
      },
      {
        name: 'cancel_order',
        description: 'Cancel an order',
        inputSchema: {
          type: 'object',
          properties: {
            store: { type: 'string', description: 'Store name' },
            order_id: { type: 'number', description: 'Shopify order ID' },
            reason: {
              type: 'string',
              enum: ['customer', 'fraud', 'inventory', 'declined', 'other'],
              description: 'Cancellation reason (optional)',
            },
          },
          required: ['store', 'order_id'],
        },
      },
      {
        name: 'fulfill_order',
        description: 'Mark an order as fulfilled (create a fulfillment)',
        inputSchema: {
          type: 'object',
          properties: {
            store: { type: 'string', description: 'Store name' },
            order_id: { type: 'number', description: 'Shopify order ID' },
            tracking_number: { type: 'string', description: 'Tracking number (optional)' },
            tracking_company: { type: 'string', description: 'Shipping carrier (optional)' },
            notify_customer: { type: 'boolean', description: 'Send notification email (default true)' },
          },
          required: ['store', 'order_id'],
        },
      },
      {
        name: 'get_order_refunds',
        description: 'Get refunds for a specific order',
        inputSchema: {
          type: 'object',
          properties: {
            store: { type: 'string', description: 'Store name' },
            order_id: { type: 'number', description: 'Shopify order ID' },
          },
          required: ['store', 'order_id'],
        },
      },

      // ── Products ───────────────────────────────────────────────────────────
      {
        name: 'get_products',
        description: 'Fetch products from a Shopify store',
        inputSchema: {
          type: 'object',
          properties: {
            store: { type: 'string', description: 'Store name' },
            limit: { type: 'number', description: 'Max products to return (default 50)' },
          },
          required: ['store'],
        },
      },
      {
        name: 'update_product',
        description: 'Update a product (title, status, price, description, tags, etc.)',
        inputSchema: {
          type: 'object',
          properties: {
            store: { type: 'string', description: 'Store name' },
            product_id: { type: 'number', description: 'Shopify product ID' },
            data: { type: 'object', description: 'Fields to update (e.g. { title, status, tags, variants })' },
          },
          required: ['store', 'product_id', 'data'],
        },
      },
      {
        name: 'create_product',
        description: 'Create a new product with full details including metafields. Status defaults to draft.',
        inputSchema: {
          type: 'object',
          properties: {
            store: { type: 'string', description: 'Store name' },
            title: { type: 'string', description: 'Product title' },
            body_html: { type: 'string', description: 'Product description (HTML allowed)' },
            vendor: { type: 'string', description: 'Brand / vendor name' },
            product_type: { type: 'string', description: 'Product type/category' },
            tags: { type: 'string', description: 'Comma-separated tags' },
            status: { type: 'string', enum: ['active', 'draft', 'archived'], description: 'Status (default: draft)' },
            variants: {
              type: 'array',
              description: 'Variants array. Each: { price, sku, inventory_quantity, compare_at_price, option1, option2, option3 }',
              items: { type: 'object' },
            },
            images: {
              type: 'array',
              description: 'Images array. e.g. [{ "src": "https://...", "alt": "..." }]',
              items: { type: 'object' },
            },
            metafields: {
              type: 'array',
              description: 'Metafields to set on creation. Each: { namespace, key, value, type }. type examples: single_line_text_field, multi_line_text_field, number_integer, boolean.',
              items: { type: 'object' },
            },
          },
          required: ['store', 'title'],
        },
      },
      {
        name: 'add_product_image',
        description: 'Add an image to an existing product from a public URL',
        inputSchema: {
          type: 'object',
          properties: {
            store: { type: 'string', description: 'Store name' },
            product_id: { type: 'number', description: 'Shopify product ID' },
            src: { type: 'string', description: 'Public image URL' },
            alt: { type: 'string', description: 'Alt text (optional)' },
          },
          required: ['store', 'product_id', 'src'],
        },
      },

      // ── Metafields ─────────────────────────────────────────────────────────
      {
        name: 'get_product_metafields',
        description: 'Get all metafields for a product',
        inputSchema: {
          type: 'object',
          properties: {
            store: { type: 'string', description: 'Store name' },
            product_id: { type: 'number', description: 'Shopify product ID' },
          },
          required: ['store', 'product_id'],
        },
      },
      {
        name: 'set_product_metafields',
        description: 'Create or update metafields on a product. Creates new ones, updates existing ones by namespace+key.',
        inputSchema: {
          type: 'object',
          properties: {
            store: { type: 'string', description: 'Store name' },
            product_id: { type: 'number', description: 'Shopify product ID' },
            metafields: {
              type: 'array',
              description: 'Array of metafield objects. Each needs: namespace (e.g. "custom"), key (e.g. "fragrance_notes"), value, type. Common types: "single_line_text_field", "multi_line_text_field", "number_integer", "boolean", "string", "json". For list types (e.g. "list.single_line_text_field"), value must be a JSON-encoded array string: "[\"item1\",\"item2\"]".',
              items: {
                type: 'object',
                properties: {
                  namespace: { type: 'string' },
                  key: { type: 'string' },
                  value: { type: 'string' },
                  type: { type: 'string' },
                },
                required: ['namespace', 'key', 'value', 'type'],
              },
            },
          },
          required: ['store', 'product_id', 'metafields'],
        },
      },
      {
        name: 'bulk_create_products',
        description: 'Create multiple products in one call. Each product object follows the same structure as create_product. Returns a summary of created products with IDs.',
        inputSchema: {
          type: 'object',
          properties: {
            store: { type: 'string', description: 'Store name' },
            products: {
              type: 'array',
              description: 'Array of product objects. Each can have: title (required), body_html, vendor, product_type, tags, status, variants (array with price/sku/inventory_quantity), images (array with src URLs).',
              items: { type: 'object' },
            },
          },
          required: ['store', 'products'],
        },
      },
      {
        name: 'delete_product',
        description: 'Permanently delete a product',
        inputSchema: {
          type: 'object',
          properties: {
            store: { type: 'string', description: 'Store name' },
            product_id: { type: 'number', description: 'Shopify product ID' },
          },
          required: ['store', 'product_id'],
        },
      },

      // ── Collections ────────────────────────────────────────────────────────
      {
        name: 'get_collections',
        description: 'List all collections (custom + smart) in a store',
        inputSchema: {
          type: 'object',
          properties: {
            store: { type: 'string', description: 'Store name' },
            limit: { type: 'number', description: 'Max per type (default 50)' },
          },
          required: ['store'],
        },
      },
      {
        name: 'get_collection_products',
        description: 'Get products in a specific collection',
        inputSchema: {
          type: 'object',
          properties: {
            store: { type: 'string', description: 'Store name' },
            collection_id: { type: 'number', description: 'Collection ID' },
            limit: { type: 'number', description: 'Max products (default 50)' },
          },
          required: ['store', 'collection_id'],
        },
      },
      {
        name: 'create_collection',
        description: 'Create a new custom collection',
        inputSchema: {
          type: 'object',
          properties: {
            store: { type: 'string', description: 'Store name' },
            title: { type: 'string', description: 'Collection title' },
            body_html: { type: 'string', description: 'Description HTML (optional)' },
          },
          required: ['store', 'title'],
        },
      },

      // ── Customers ──────────────────────────────────────────────────────────
      {
        name: 'get_customers',
        description: 'Fetch customers from a Shopify store',
        inputSchema: {
          type: 'object',
          properties: {
            store: { type: 'string', description: 'Store name' },
            limit: { type: 'number', description: 'Max customers to return (default 50)' },
          },
          required: ['store'],
        },
      },
      {
        name: 'search_customers',
        description: 'Search customers by name, email, or phone',
        inputSchema: {
          type: 'object',
          properties: {
            store: { type: 'string', description: 'Store name' },
            query: { type: 'string', description: 'Search query' },
          },
          required: ['store', 'query'],
        },
      },
      {
        name: 'update_customer',
        description: 'Update a customer record (tags, note, email, phone, etc.)',
        inputSchema: {
          type: 'object',
          properties: {
            store: { type: 'string', description: 'Store name' },
            customer_id: { type: 'number', description: 'Shopify customer ID' },
            data: { type: 'object', description: 'Fields to update (e.g. { tags, note, accepts_marketing })' },
          },
          required: ['store', 'customer_id', 'data'],
        },
      },

      // ── Discounts ──────────────────────────────────────────────────────────
      {
        name: 'get_discounts',
        description: 'List all discount/price rules in a store',
        inputSchema: {
          type: 'object',
          properties: {
            store: { type: 'string', description: 'Store name' },
            limit: { type: 'number', description: 'Max rules (default 50)' },
          },
          required: ['store'],
        },
      },
      {
        name: 'create_discount',
        description: 'Create a discount code (creates price rule + code in one step)',
        inputSchema: {
          type: 'object',
          properties: {
            store: { type: 'string', description: 'Store name' },
            title: { type: 'string', description: 'Internal label (e.g. "Summer Sale 10%")' },
            code: { type: 'string', description: 'Discount code customers enter (e.g. "SUMMER10")' },
            value_type: { type: 'string', enum: ['percentage', 'fixed_amount'], description: 'Discount type' },
            value: { type: 'string', description: 'Negative value: "-10.0" = 10% off, "-5.00" = $5 off' },
            usage_limit: { type: 'number', description: 'Max uses (optional, unlimited if omitted)' },
            ends_at: { type: 'string', description: 'Expiry date ISO 8601 (optional)' },
          },
          required: ['store', 'title', 'code', 'value_type', 'value'],
        },
      },

      // ── Inventory ──────────────────────────────────────────────────────────
      {
        name: 'get_locations',
        description: 'List all locations (warehouses, stores) for a Shopify store',
        inputSchema: {
          type: 'object',
          properties: {
            store: { type: 'string', description: 'Store name' },
          },
          required: ['store'],
        },
      },
      {
        name: 'get_inventory',
        description: 'Get inventory levels (optionally filtered by location)',
        inputSchema: {
          type: 'object',
          properties: {
            store: { type: 'string', description: 'Store name' },
            location_id: { type: 'number', description: 'Filter by location ID (optional)' },
            limit: { type: 'number', description: 'Max results (default 50)' },
          },
          required: ['store'],
        },
      },
      {
        name: 'set_inventory',
        description: 'Set inventory quantity for a variant at a specific location',
        inputSchema: {
          type: 'object',
          properties: {
            store: { type: 'string', description: 'Store name' },
            inventory_item_id: { type: 'number', description: 'Inventory item ID (from variant.inventory_item_id)' },
            location_id: { type: 'number', description: 'Location ID' },
            available: { type: 'number', description: 'New quantity to set' },
          },
          required: ['store', 'inventory_item_id', 'location_id', 'available'],
        },
      },

      // ── Analytics ──────────────────────────────────────────────────────────
      {
        name: 'get_analytics',
        description: 'Fetch combined analytics: orders, products, and customers in one call',
        inputSchema: {
          type: 'object',
          properties: {
            store: { type: 'string', description: 'Store name' },
          },
          required: ['store'],
        },
      },

      // ── Store settings ─────────────────────────────────────────────────────
      {
        name: 'get_themes',
        description: 'List themes and active theme for a store',
        inputSchema: {
          type: 'object',
          properties: {
            store: { type: 'string', description: 'Store name' },
          },
          required: ['store'],
        },
      },
      {
        name: 'get_webhooks',
        description: 'List registered webhooks for a store',
        inputSchema: {
          type: 'object',
          properties: {
            store: { type: 'string', description: 'Store name' },
          },
          required: ['store'],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    try {
      switch (name) {

        // ── Store ────────────────────────────────────────────────────────────
        case 'list_stores': {
          const stores = listStores();
          return text(stores.length > 0
            ? `Connected stores:\n${stores.map(s => `  • ${s}`).join('\n')}`
            : 'No stores connected yet.'
          );
        }

        // ── Orders ───────────────────────────────────────────────────────────
        case 'get_orders': {
          const config = loadStore(str(args, 'store'));
          const [orders, count] = await Promise.all([
            getOrders(config, (args['status'] as 'any') ?? 'any', num(args, 'limit', 50)),
            getOrderCount(config),
          ]);
          return text(`Total orders: ${count}\n\n${JSON.stringify(orders, null, 2)}`);
        }
        case 'cancel_order': {
          const config = loadStore(str(args, 'store'));
          const order = await cancelOrder(config, num(args, 'order_id'), args['reason'] as string | undefined);
          return text(`Order #${order.order_number} cancelled (ID: ${order.id})`);
        }
        case 'fulfill_order': {
          const config = loadStore(str(args, 'store'));
          const fulfillment = await fulfillOrder(config, num(args, 'order_id'), {
            tracking_number: args['tracking_number'] as string | undefined,
            tracking_company: args['tracking_company'] as string | undefined,
            notify_customer: args['notify_customer'] as boolean | undefined,
          });
          return text(`Fulfillment created (ID: ${fulfillment.id}) — status: ${fulfillment.status}`);
        }
        case 'get_order_refunds': {
          const config = loadStore(str(args, 'store'));
          const refunds = await getRefunds(config, num(args, 'order_id'));
          return text(`${refunds.length} refund(s)\n\n${JSON.stringify(refunds, null, 2)}`);
        }

        // ── Products ─────────────────────────────────────────────────────────
        case 'get_products': {
          const config = loadStore(str(args, 'store'));
          const products = await getProducts(config, num(args, 'limit', 50));
          return text(`Total products: ${products.length}\n\n${JSON.stringify(products, null, 2)}`);
        }
        case 'update_product': {
          const config = loadStore(str(args, 'store'));
          const updated = await updateProduct(config, num(args, 'product_id'), args['data'] as Record<string, unknown>);
          return text(`Product updated: ${updated.title} (ID: ${updated.id})\n\n${JSON.stringify(updated, null, 2)}`);
        }
        case 'create_product': {
          const config = loadStore(str(args, 'store'));
          const product = await createProduct(config, {
            title: str(args, 'title'),
            body_html: args['body_html'] as string | undefined,
            vendor: args['vendor'] as string | undefined,
            product_type: args['product_type'] as string | undefined,
            tags: args['tags'] as string | undefined,
            status: (args['status'] as string | undefined) ?? 'draft',
            variants: args['variants'] as ShopifyVariant[] | undefined,
            images: args['images'] as ShopifyImage[] | undefined,
            metafields: args['metafields'] as Array<{ namespace: string; key: string; value: string; type: string }> | undefined,
          });
          return text(`Product created: ${product.title} (ID: ${product.id}) — status: ${product.status}`);
        }
        case 'add_product_image': {
          const config = loadStore(str(args, 'store'));
          const { rest } = (await import('../shopify/client.js')).createShopifyClient(config);
          const { DataType } = await import('@shopify/shopify-api');
          const response = await rest.post({
            path: `products/${num(args, 'product_id')}/images`,
            data: { image: { src: str(args, 'src'), alt: args['alt'] as string | undefined } },
            type: DataType.JSON,
          });
          const img = (response.body as { image: { id: number; src: string } }).image;
          return text(`Image added to product ${num(args, 'product_id')} — image ID: ${img.id}\n${img.src}`);
        }

        // ── Metafields ───────────────────────────────────────────────────────
        case 'get_product_metafields': {
          const config = loadStore(str(args, 'store'));
          const metafields = await getProductMetafields(config, num(args, 'product_id'));
          return text(`${metafields.length} metafield(s)\n\n${JSON.stringify(metafields, null, 2)}`);
        }
        case 'set_product_metafields': {
          const config = loadStore(str(args, 'store'));
          const mfs = args['metafields'] as Array<{ namespace: string; key: string; value: string; type: string }>;
          if (!Array.isArray(mfs) || mfs.length === 0) throw new Error('metafields must be a non-empty array');
          const results = await setProductMetafields(config, num(args, 'product_id'), mfs);
          return text(
            `Set ${results.length} metafield(s) on product ${num(args, 'product_id')}:\n` +
            results.map(m => `  • ${m.namespace}.${m.key} = "${m.value}" (${m.type})`).join('\n')
          );
        }
        case 'bulk_create_products': {
          const config = loadStore(str(args, 'store'));
          const products = args['products'] as Array<Record<string, unknown>>;
          if (!Array.isArray(products) || products.length === 0) {
            throw new Error('products must be a non-empty array');
          }
          const results: Array<{ id: number; title: string; status: string }> = [];
          const errors: string[] = [];
          for (const p of products) {
            try {
              const created = await createProduct(config, p as Partial<ShopifyProduct>);
              results.push({ id: created.id, title: created.title, status: created.status });
            } catch (err) {
              errors.push(`"${String(p['title'] ?? '?')}": ${err instanceof Error ? err.message : String(err)}`);
            }
          }
          const summary = [
            `Created ${results.length}/${products.length} products:`,
            ...results.map(p => `  ✓ ${p.title} (ID: ${p.id}) — ${p.status}`),
            ...(errors.length ? ['', `Errors (${errors.length}):`, ...errors.map(e => `  ✗ ${e}`)] : []),
          ].join('\n');
          return text(summary);
        }
        case 'delete_product': {
          const config = loadStore(str(args, 'store'));
          await deleteProduct(config, num(args, 'product_id'));
          return text(`Product ${num(args, 'product_id')} deleted`);
        }

        // ── Collections ──────────────────────────────────────────────────────
        case 'get_collections': {
          const config = loadStore(str(args, 'store'));
          const collections = await getCollections(config, num(args, 'limit', 50));
          return text(`${collections.length} collection(s)\n\n${JSON.stringify(collections, null, 2)}`);
        }
        case 'get_collection_products': {
          const config = loadStore(str(args, 'store'));
          const products = await getCollectionProducts(config, num(args, 'collection_id'), num(args, 'limit', 50));
          return text(`${products.length} product(s)\n\n${JSON.stringify(products, null, 2)}`);
        }
        case 'create_collection': {
          const config = loadStore(str(args, 'store'));
          const collection = await createCollection(config, {
            title: str(args, 'title'),
            body_html: args['body_html'] as string | undefined,
          });
          return text(`Collection created: ${collection.title} (ID: ${collection.id})`);
        }

        // ── Customers ────────────────────────────────────────────────────────
        case 'get_customers': {
          const config = loadStore(str(args, 'store'));
          const customers = await getCustomers(config, num(args, 'limit', 50));
          return text(`Total customers: ${customers.length}\n\n${JSON.stringify(customers, null, 2)}`);
        }
        case 'search_customers': {
          const config = loadStore(str(args, 'store'));
          const customers = await searchCustomers(config, str(args, 'query'));
          return text(`Found ${customers.length} customer(s)\n\n${JSON.stringify(customers, null, 2)}`);
        }
        case 'update_customer': {
          const config = loadStore(str(args, 'store'));
          const updated = await updateCustomer(config, num(args, 'customer_id'), args['data'] as Record<string, unknown>);
          return text(`Customer updated: ${updated.first_name} ${updated.last_name} (ID: ${updated.id})`);
        }

        // ── Discounts ────────────────────────────────────────────────────────
        case 'get_discounts': {
          const config = loadStore(str(args, 'store'));
          const rules = await getPriceRules(config, num(args, 'limit', 50));
          return text(`${rules.length} price rule(s)\n\n${JSON.stringify(rules, null, 2)}`);
        }
        case 'create_discount': {
          const config = loadStore(str(args, 'store'));
          const result = await createDiscount(config, {
            title: str(args, 'title'),
            code: str(args, 'code'),
            value_type: str(args, 'value_type') as 'percentage' | 'fixed_amount',
            value: str(args, 'value'),
            usage_limit: args['usage_limit'] as number | undefined,
            ends_at: args['ends_at'] as string | undefined,
          });
          return text(
            `Discount created!\n` +
            `  Code: ${result.discount_code.code}\n` +
            `  Type: ${result.price_rule.value_type} ${result.price_rule.value}\n` +
            `  Rule ID: ${result.price_rule.id}\n` +
            `  Code ID: ${result.discount_code.id}`
          );
        }

        // ── Inventory ────────────────────────────────────────────────────────
        case 'get_locations': {
          const config = loadStore(str(args, 'store'));
          const locations = await getLocations(config);
          return text(`${locations.length} location(s)\n\n${JSON.stringify(locations, null, 2)}`);
        }
        case 'get_inventory': {
          const config = loadStore(str(args, 'store'));
          const levels = await getInventoryLevels(
            config,
            args['location_id'] as number | undefined,
            num(args, 'limit', 50)
          );
          return text(`${levels.length} inventory level(s)\n\n${JSON.stringify(levels, null, 2)}`);
        }
        case 'set_inventory': {
          const config = loadStore(str(args, 'store'));
          const level = await setInventoryLevel(
            config,
            num(args, 'inventory_item_id'),
            num(args, 'location_id'),
            num(args, 'available')
          );
          return text(`Inventory updated: item ${level.inventory_item_id} at location ${level.location_id} → ${level.available} units`);
        }

        // ── Analytics ────────────────────────────────────────────────────────
        case 'get_analytics': {
          const config = loadStore(str(args, 'store'));
          const [orders, products, customers, count] = await Promise.all([
            getOrders(config, 'any', 50),
            getProducts(config, 50),
            getCustomers(config, 50),
            getOrderCount(config),
          ]);
          return text(JSON.stringify({
            summary: { totalOrders: count, totalProducts: products.length, totalCustomers: customers.length },
            orders, products, customers,
          }, null, 2));
        }

        // ── Store settings ───────────────────────────────────────────────────
        case 'get_themes': {
          const config = loadStore(str(args, 'store'));
          const [themes, active] = await Promise.all([getThemes(config), getActiveTheme(config)]);
          return text(`Active theme: ${active?.name ?? 'unknown'}\n\n${JSON.stringify(themes, null, 2)}`);
        }
        case 'get_webhooks': {
          const config = loadStore(str(args, 'store'));
          const webhooks = await listWebhooks(config);
          return text(`${webhooks.length} webhook(s) registered\n\n${JSON.stringify(webhooks, null, 2)}`);
        }

        default:
          return text(`Unknown tool: ${name}`);
      }
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  });

  return server;
}

function text(content: string) {
  return { content: [{ type: 'text' as const, text: content }] };
}

function str(args: Record<string, unknown>, key: string): string {
  const val = args[key];
  if (typeof val !== 'string' || !val) throw new Error(`Missing required parameter: ${key}`);
  return val;
}

function num(args: Record<string, unknown>, key: string, fallback?: number): number {
  const val = args[key];
  if (val === undefined || val === null) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required parameter: ${key}`);
  }
  return Number(val);
}

// Also export uploadProductImage for the stdio server
export { uploadProductImage };
