/**
 * Shopify MCP Server
 *
 * Exposes Shopify store management as Claude tools.
 * Claude can call these directly — no manual fetch/paste needed.
 *
 * Configure in ~/.claude/settings.json:
 * {
 *   "mcpServers": {
 *     "shopify": {
 *       "command": "node",
 *       "args": ["/path/to/dist/mcp/server.js"],
 *       "env": { "STORES_DIR": "/path/to/stores" }
 *     }
 *   }
 * }
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { loadStore, listStores } from '../core/storeLoader';
import { getOrders, getOrderCount } from '../shopify/orders';
import { getProducts, updateProduct, createProduct } from '../shopify/products';
import { getCustomers, searchCustomers } from '../shopify/customers';
import { getThemes, getActiveTheme } from '../shopify/themes';
import { uploadProductImage } from '../shopify/images';
import { listWebhooks } from '../shopify/webhooks';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const server = new Server(
  { name: 'shopify-claude-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// ── Tool definitions ──────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'list_stores',
      description: 'List all connected Shopify stores',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
      name: 'get_orders',
      description: 'Fetch recent orders from a Shopify store',
      inputSchema: {
        type: 'object',
        properties: {
          store: { type: 'string', description: 'Store name (e.g. torath)' },
          limit: { type: 'number', description: 'Max orders to return (default 50)' },
          status: { type: 'string', enum: ['open', 'closed', 'cancelled', 'any'], description: 'Order status filter (default any)' },
        },
        required: ['store'],
      },
    },
    {
      name: 'get_products',
      description: 'Fetch products and inventory from a Shopify store',
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
      name: 'update_product',
      description: 'Update a product (title, status, price, description, etc.)',
      inputSchema: {
        type: 'object',
        properties: {
          store: { type: 'string', description: 'Store name' },
          product_id: { type: 'number', description: 'Shopify product ID' },
          data: {
            type: 'object',
            description: 'Fields to update (e.g. { "status": "draft", "title": "New Title" })',
          },
        },
        required: ['store', 'product_id', 'data'],
      },
    },
    {
      name: 'create_product',
      description: 'Create a new product in a Shopify store (set to draft)',
      inputSchema: {
        type: 'object',
        properties: {
          store: { type: 'string', description: 'Store name' },
          title: { type: 'string', description: 'Product title' },
          image_path: { type: 'string', description: 'Local file path for product image (optional)' },
        },
        required: ['store', 'title'],
      },
    },
    {
      name: 'upload_image',
      description: 'Upload an image from a local file to a Shopify product',
      inputSchema: {
        type: 'object',
        properties: {
          store: { type: 'string', description: 'Store name' },
          product_id: { type: 'number', description: 'Shopify product ID' },
          image_path: { type: 'string', description: 'Absolute path to image file on local machine' },
        },
        required: ['store', 'product_id', 'image_path'],
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

// ── Tool handlers ─────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    switch (name) {

      case 'list_stores': {
        const stores = listStores();
        return text(stores.length > 0
          ? `Connected stores:\n${stores.map(s => `  • ${s}`).join('\n')}`
          : 'No stores connected yet. Run: npm run install:store -- storename.myshopify.com'
        );
      }

      case 'get_orders': {
        const config = loadStore(str(args, 'store'));
        const [orders, count] = await Promise.all([
          getOrders(config, (args['status'] as 'any') ?? 'any', num(args, 'limit', 50)),
          getOrderCount(config),
        ]);
        return text(`Total orders: ${count}\n\n${JSON.stringify(orders, null, 2)}`);
      }

      case 'get_products': {
        const config = loadStore(str(args, 'store'));
        const products = await getProducts(config, num(args, 'limit', 50));
        return text(`Total products: ${products.length}\n\n${JSON.stringify(products, null, 2)}`);
      }

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

      case 'get_analytics': {
        const config = loadStore(str(args, 'store'));
        const [orders, products, customers, count] = await Promise.all([
          getOrders(config, 'any', 50),
          getProducts(config, 50),
          getCustomers(config, 50),
          getOrderCount(config),
        ]);
        return text(JSON.stringify({ summary: { totalOrders: count, totalProducts: products.length, totalCustomers: customers.length }, orders, products, customers }, null, 2));
      }

      case 'get_themes': {
        const config = loadStore(str(args, 'store'));
        const [themes, active] = await Promise.all([getThemes(config), getActiveTheme(config)]);
        return text(`Active theme: ${active?.name ?? 'unknown'}\n\n${JSON.stringify(themes, null, 2)}`);
      }

      case 'update_product': {
        const config = loadStore(str(args, 'store'));
        const updated = await updateProduct(config, num(args, 'product_id'), args['data'] as Record<string, unknown>);
        return text(`Product updated: ${updated.title} (ID: ${updated.id})\n\n${JSON.stringify(updated, null, 2)}`);
      }

      case 'create_product': {
        const config = loadStore(str(args, 'store'));
        const product = await createProduct(config, { title: str(args, 'title'), status: 'draft' });
        let result = `Product created: ${product.title} (ID: ${product.id}) — status: draft`;

        if (args['image_path']) {
          const image = await uploadProductImage(config, product.id, str(args, 'image_path'));
          result += `\nImage uploaded: ${image.src}`;
        }

        return text(result);
      }

      case 'upload_image': {
        const config = loadStore(str(args, 'store'));
        const image = await uploadProductImage(config, num(args, 'product_id'), str(args, 'image_path'));
        return text(`Image uploaded to product ${String(args['product_id'])}\nURL: ${image.src}`);
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

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Start ─────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(err => {
  process.stderr.write(`MCP server error: ${String(err)}\n`);
  process.exit(1);
});
