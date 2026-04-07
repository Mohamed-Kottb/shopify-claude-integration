import { DataType } from '@shopify/shopify-api';
import { createShopifyClient } from './client';
import { StoreConfig } from '../core/types';

type WebhookTopic =
  | 'orders/create'
  | 'orders/updated'
  | 'orders/cancelled'
  | 'products/create'
  | 'products/update'
  | 'products/delete'
  | 'customers/create'
  | 'customers/update'
  | 'inventory_levels/update'
  | 'carts/create'
  | 'carts/update'
  | 'checkouts/create'
  | 'checkouts/update';

interface ShopifyWebhook {
  id: number;
  topic: string;
  address: string;
  format: string;
  created_at: string;
}

const DEFAULT_TOPICS: WebhookTopic[] = [
  'orders/create',
  'orders/updated',
  'products/update',
  'inventory_levels/update',
  'customers/create',
  'carts/update',
  'checkouts/create',
];

export async function registerWebhooks(
  config: StoreConfig,
  callbackBaseUrl: string,
  topics: WebhookTopic[] = DEFAULT_TOPICS
): Promise<ShopifyWebhook[]> {
  const { rest } = createShopifyClient(config);

  const results = await Promise.all(
    topics.map(topic =>
      rest.post({
        path: 'webhooks',
        data: {
          webhook: {
            topic,
            address: `${callbackBaseUrl}/webhooks/${topic.replace('/', '-')}`,
            format: 'json',
          },
        },
        type: DataType.JSON,
      })
    )
  );

  return results.map(r => (r.body as { webhook: ShopifyWebhook }).webhook);
}

export async function listWebhooks(config: StoreConfig): Promise<ShopifyWebhook[]> {
  const { rest } = createShopifyClient(config);
  const response = await rest.get({ path: 'webhooks' });
  return (response.body as { webhooks: ShopifyWebhook[] }).webhooks;
}

export async function deleteWebhook(config: StoreConfig, webhookId: number): Promise<void> {
  const { rest } = createShopifyClient(config);
  await rest.delete({ path: `webhooks/${webhookId}` });
}

export async function deleteAllWebhooks(config: StoreConfig): Promise<void> {
  const webhooks = await listWebhooks(config);
  await Promise.all(webhooks.map(w => deleteWebhook(config, w.id)));
}
