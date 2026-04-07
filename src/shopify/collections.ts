import { DataType } from '@shopify/shopify-api';
import { createShopifyClient } from './client';
import { StoreConfig, ShopifyCollection, ShopifyProduct } from '../core/types';

export async function getCollections(config: StoreConfig, limit = 50): Promise<ShopifyCollection[]> {
  const { rest } = createShopifyClient(config);
  const [customRes, smartRes] = await Promise.all([
    rest.get({ path: 'custom_collections', query: { limit: String(limit) } }),
    rest.get({ path: 'smart_collections', query: { limit: String(limit) } }),
  ]);
  const customs = (customRes.body as { custom_collections: ShopifyCollection[] }).custom_collections;
  const smarts = (smartRes.body as { smart_collections: ShopifyCollection[] }).smart_collections;
  return [...customs, ...smarts];
}

export async function getCollectionProducts(
  config: StoreConfig,
  collectionId: number,
  limit = 50
): Promise<ShopifyProduct[]> {
  const { rest } = createShopifyClient(config);
  const response = await rest.get({
    path: 'products',
    query: { collection_id: String(collectionId), limit: String(limit) },
  });
  return (response.body as { products: ShopifyProduct[] }).products;
}

export async function createCollection(
  config: StoreConfig,
  data: { title: string; body_html?: string }
): Promise<ShopifyCollection> {
  const { rest } = createShopifyClient(config);
  const response = await rest.post({
    path: 'custom_collections',
    data: { custom_collection: data },
    type: DataType.JSON,
  });
  return (response.body as { custom_collection: ShopifyCollection }).custom_collection;
}
