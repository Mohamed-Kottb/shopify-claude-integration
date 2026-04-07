import { DataType } from '@shopify/shopify-api';
import { createShopifyClient } from './client';
import { StoreConfig, ShopifyProduct } from '../core/types';

export async function getProducts(config: StoreConfig, limit = 50): Promise<ShopifyProduct[]> {
  const { rest } = createShopifyClient(config);
  const response = await rest.get({ path: 'products', query: { limit: String(limit) } });
  return (response.body as { products: ShopifyProduct[] }).products;
}

export async function getProduct(config: StoreConfig, productId: number): Promise<ShopifyProduct> {
  const { rest } = createShopifyClient(config);
  const response = await rest.get({ path: `products/${productId}` });
  return (response.body as { product: ShopifyProduct }).product;
}

export async function createProduct(
  config: StoreConfig,
  data: Partial<ShopifyProduct>
): Promise<ShopifyProduct> {
  const { rest } = createShopifyClient(config);
  const response = await rest.post({
    path: 'products',
    data: { product: data },
    type: DataType.JSON,
  });
  return (response.body as { product: ShopifyProduct }).product;
}

export async function updateProduct(
  config: StoreConfig,
  productId: number,
  data: Partial<ShopifyProduct>
): Promise<ShopifyProduct> {
  const { rest } = createShopifyClient(config);
  const response = await rest.put({
    path: `products/${productId}`,
    data: { product: data },
    type: DataType.JSON,
  });
  return (response.body as { product: ShopifyProduct }).product;
}

export async function deleteProduct(config: StoreConfig, productId: number): Promise<void> {
  const { rest } = createShopifyClient(config);
  await rest.delete({ path: `products/${productId}` });
}
