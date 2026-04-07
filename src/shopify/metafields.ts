import { DataType } from '@shopify/shopify-api';
import { createShopifyClient } from './client';
import { StoreConfig, ShopifyMetafield } from '../core/types';

export type { ShopifyMetafield };

export async function getProductMetafields(
  config: StoreConfig,
  productId: number
): Promise<ShopifyMetafield[]> {
  const { rest } = createShopifyClient(config);
  const response = await rest.get({ path: `products/${productId}/metafields` });
  return (response.body as { metafields: ShopifyMetafield[] }).metafields;
}

export async function setProductMetafields(
  config: StoreConfig,
  productId: number,
  metafields: Array<{ namespace: string; key: string; value: string; type: string }>
): Promise<ShopifyMetafield[]> {
  const { rest } = createShopifyClient(config);

  // Fetch existing to detect IDs for updates vs creates
  const existingRes = await rest.get({ path: `products/${productId}/metafields` });
  const existing = (existingRes.body as { metafields: ShopifyMetafield[] }).metafields;
  const existingMap = new Map(existing.map(m => [`${m.namespace}.${m.key}`, m]));

  const results: ShopifyMetafield[] = [];

  for (const mf of metafields) {
    const key = `${mf.namespace}.${mf.key}`;
    const existing = existingMap.get(key);

    if (existing?.id) {
      // Update
      const res = await rest.put({
        path: `metafields/${existing.id}`,
        data: { metafield: { value: mf.value, type: mf.type } },
        type: DataType.JSON,
      });
      results.push((res.body as { metafield: ShopifyMetafield }).metafield);
    } else {
      // Create
      const res = await rest.post({
        path: `products/${productId}/metafields`,
        data: { metafield: mf },
        type: DataType.JSON,
      });
      results.push((res.body as { metafield: ShopifyMetafield }).metafield);
    }
  }

  return results;
}

export async function deleteProductMetafield(
  config: StoreConfig,
  productId: number,
  metafieldId: number
): Promise<void> {
  const { rest } = createShopifyClient(config);
  await rest.delete({ path: `products/${productId}/metafields/${metafieldId}` });
}
