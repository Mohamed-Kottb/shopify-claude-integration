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

export interface MetafieldDefinition {
  id: number;
  name: string;
  namespace: string;
  key: string;
  type: { name: string };
  description: string | null;
  owner_type: string;
}

const OWNER_TYPE_MAP: Record<string, string> = {
  product: 'PRODUCT',
  variant: 'PRODUCTVARIANT',
  collection: 'COLLECTION',
  customer: 'CUSTOMER',
  order: 'ORDER',
};

export async function getMetafieldDefinitions(
  config: StoreConfig,
  ownerType: 'product' | 'variant' | 'collection' | 'customer' | 'order' = 'product'
): Promise<MetafieldDefinition[]> {
  const { graphql } = createShopifyClient(config);
  const gqlOwnerType = OWNER_TYPE_MAP[ownerType] ?? 'PRODUCT';

  const response = await graphql.query({
    data: `{
      metafieldDefinitions(ownerType: ${gqlOwnerType}, first: 250) {
        nodes {
          id
          name
          namespace
          key
          type { name }
          description
          ownerType
        }
      }
    }`,
  });

  const body = response.body as unknown as {
    data: { metafieldDefinitions: { nodes: Array<{
      id: string; name: string; namespace: string; key: string;
      type: { name: string }; description: string | null; ownerType: string;
    }> } }
  };

  return body.data.metafieldDefinitions.nodes.map(n => ({
    id: parseInt(n.id.split('/').pop() ?? '0'),
    name: n.name,
    namespace: n.namespace,
    key: n.key,
    type: n.type,
    description: n.description,
    owner_type: n.ownerType,
  }));
}

export async function deleteProductMetafield(
  config: StoreConfig,
  productId: number,
  metafieldId: number
): Promise<void> {
  const { rest } = createShopifyClient(config);
  await rest.delete({ path: `products/${productId}/metafields/${metafieldId}` });
}
