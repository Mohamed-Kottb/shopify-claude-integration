import { DataType } from '@shopify/shopify-api';
import { createShopifyClient } from './client';
import { StoreConfig, ShopifyCustomer } from '../core/types';

export async function getCustomers(config: StoreConfig, limit = 50): Promise<ShopifyCustomer[]> {
  const { rest } = createShopifyClient(config);
  const response = await rest.get({ path: 'customers', query: { limit: String(limit) } });
  return (response.body as { customers: ShopifyCustomer[] }).customers;
}

export async function getCustomer(config: StoreConfig, customerId: number): Promise<ShopifyCustomer> {
  const { rest } = createShopifyClient(config);
  const response = await rest.get({ path: `customers/${customerId}` });
  return (response.body as { customer: ShopifyCustomer }).customer;
}

export async function searchCustomers(config: StoreConfig, query: string): Promise<ShopifyCustomer[]> {
  const { rest } = createShopifyClient(config);
  const response = await rest.get({ path: 'customers/search', query: { query } });
  return (response.body as { customers: ShopifyCustomer[] }).customers;
}

export async function updateCustomer(
  config: StoreConfig,
  customerId: number,
  data: Partial<ShopifyCustomer>
): Promise<ShopifyCustomer> {
  const { rest } = createShopifyClient(config);
  const response = await rest.put({
    path: `customers/${customerId}`,
    data: { customer: data },
    type: DataType.JSON,
  });
  return (response.body as { customer: ShopifyCustomer }).customer;
}
