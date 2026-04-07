/**
 * CLI data fetcher — pulls Shopify data and prints it to terminal
 * so you can analyze it with Claude Code.
 *
 * Usage:
 *   npm run fetch -- <store> <command>
 *
 * Commands:
 *   orders       Fetch recent orders
 *   products     Fetch products + inventory
 *   customers    Fetch customers
 *   analytics    Fetch all of the above together
 *   themes       List themes and active theme
 *   webhooks     List registered webhooks
 */

import * as dotenv from 'dotenv';
import { loadStore } from '../core/storeLoader';
import { getOrders, getOrderCount } from '../shopify/orders';
import { getProducts } from '../shopify/products';
import { getCustomers } from '../shopify/customers';
import { getThemes, getActiveTheme } from '../shopify/themes';
import { listWebhooks } from '../shopify/webhooks';
import { logger } from '../core/logger';

dotenv.config();

const [, , storeName, command] = process.argv;

if (!storeName || !command) {
  console.log(`
Usage: npm run fetch -- <store-name> <command>

Commands:
  orders      Recent orders (last 50)
  products    Products + inventory levels
  customers   Customer list
  analytics   Orders + products + customers combined
  themes      Theme list and active theme
  webhooks    Registered webhooks
  `);
  process.exit(0);
}

async function run(): Promise<void> {
  const config = loadStore(storeName);
  logger.info(`Connected to: ${config.storeUrl}`);

  switch (command) {

    case 'orders': {
      const [orders, count] = await Promise.all([
        getOrders(config, 'any', 50),
        getOrderCount(config),
      ]);
      console.log('\n══ ORDERS ══════════════════════════════');
      console.log(`Total orders: ${count}`);
      console.log(JSON.stringify(orders, null, 2));
      break;
    }

    case 'products': {
      const products = await getProducts(config, 50);
      console.log('\n══ PRODUCTS + INVENTORY ════════════════');
      console.log(`Total products: ${products.length}`);
      console.log(JSON.stringify(products, null, 2));
      break;
    }

    case 'customers': {
      const customers = await getCustomers(config, 50);
      console.log('\n══ CUSTOMERS ═══════════════════════════');
      console.log(`Total customers fetched: ${customers.length}`);
      console.log(JSON.stringify(customers, null, 2));
      break;
    }

    case 'analytics': {
      const [orders, products, customers] = await Promise.all([
        getOrders(config, 'any', 50),
        getProducts(config, 50),
        getCustomers(config, 50),
      ]);
      console.log('\n══ FULL STORE ANALYTICS ════════════════');
      console.log(JSON.stringify({ orders, products, customers }, null, 2));
      break;
    }

    case 'themes': {
      const [themes, active] = await Promise.all([
        getThemes(config),
        getActiveTheme(config),
      ]);
      console.log('\n══ THEMES ══════════════════════════════');
      console.log('Active theme:', JSON.stringify(active, null, 2));
      console.log('All themes:', JSON.stringify(themes, null, 2));
      break;
    }

    case 'webhooks': {
      const webhooks = await listWebhooks(config);
      console.log('\n══ WEBHOOKS ════════════════════════════');
      console.log(JSON.stringify(webhooks, null, 2));
      break;
    }

    default:
      logger.error(`Unknown command: "${command}". Use: orders, products, customers, analytics, themes, webhooks`);
      process.exit(1);
  }
}

run().catch(err => {
  logger.error('Fetch failed', err);
  process.exit(1);
});
