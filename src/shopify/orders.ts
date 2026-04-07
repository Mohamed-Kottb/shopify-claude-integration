import { DataType } from '@shopify/shopify-api';
import { createShopifyClient } from './client';
import { StoreConfig, ShopifyOrder } from '../core/types';

type OrderStatus = 'open' | 'closed' | 'cancelled' | 'any';

export async function getOrders(
  config: StoreConfig,
  status: OrderStatus = 'any',
  limit = 50
): Promise<ShopifyOrder[]> {
  const { rest } = createShopifyClient(config);
  const response = await rest.get({
    path: 'orders',
    query: { status, limit: String(limit) },
  });
  return (response.body as { orders: ShopifyOrder[] }).orders;
}

export async function getOrder(config: StoreConfig, orderId: number): Promise<ShopifyOrder> {
  const { rest } = createShopifyClient(config);
  const response = await rest.get({ path: `orders/${orderId}` });
  return (response.body as { order: ShopifyOrder }).order;
}

export async function updateOrder(
  config: StoreConfig,
  orderId: number,
  data: Partial<ShopifyOrder>
): Promise<ShopifyOrder> {
  const { rest } = createShopifyClient(config);
  const response = await rest.put({
    path: `orders/${orderId}`,
    data: { order: data },
    type: DataType.JSON,
  });
  return (response.body as { order: ShopifyOrder }).order;
}

export async function getOrderCount(config: StoreConfig, status: OrderStatus = 'any'): Promise<number> {
  const { rest } = createShopifyClient(config);
  const response = await rest.get({ path: 'orders/count', query: { status } });
  return (response.body as { count: number }).count;
}
