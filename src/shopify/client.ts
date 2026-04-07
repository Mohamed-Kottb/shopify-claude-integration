import '@shopify/shopify-api/adapters/node';
import { shopifyApi, ApiVersion, Session } from '@shopify/shopify-api';
import { StoreConfig } from '../core/types';

export function createShopifyClient(config: StoreConfig) {
  const shopify = shopifyApi({
    apiKey: config.apiKey,
    apiSecretKey: config.apiSecret,
    scopes: [
      'read_products', 'write_products',
      'read_inventory', 'write_inventory',
      'read_orders', 'write_orders', 'read_all_orders',
      'read_customers', 'write_customers',
      'read_product_listings', 'write_product_listings',
      'read_marketing_events', 'write_marketing_events',
      'read_collections', 'write_collections',
      'read_analytics', 'read_reports',
      'read_price_rules', 'write_price_rules',
      'read_discounts', 'write_discounts',
      'read_themes', 'write_themes',
      'read_script_tags', 'write_script_tags',
      'read_pixels', 'write_pixels',
      'read_customer_events',
      'read_metafields', 'write_metafields',
    ],
    hostName: process.env.WEBHOOK_CALLBACK_URL?.replace('https://', '') ?? 'localhost',
    apiVersion: ApiVersion.January25,
    isEmbeddedApp: false,
  });

  const session = new Session({
    id: `offline_${config.storeUrl}`,
    shop: config.storeUrl,
    state: 'active',
    isOnline: false,
    accessToken: config.accessToken,
  });

  return {
    rest: new shopify.clients.Rest({ session }),
    graphql: new shopify.clients.Graphql({ session }),
    session,
  };
}
