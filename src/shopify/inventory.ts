import { DataType } from '@shopify/shopify-api';
import { createShopifyClient } from './client';
import { StoreConfig, ShopifyLocation, ShopifyInventoryLevel } from '../core/types';

export async function getLocations(config: StoreConfig): Promise<ShopifyLocation[]> {
  const { rest } = createShopifyClient(config);
  const response = await rest.get({ path: 'locations' });
  return (response.body as { locations: ShopifyLocation[] }).locations;
}

export async function getInventoryLevels(
  config: StoreConfig,
  locationId?: number,
  limit = 50
): Promise<ShopifyInventoryLevel[]> {
  const { rest } = createShopifyClient(config);
  const query: Record<string, string> = { limit: String(limit) };
  if (locationId) query['location_ids'] = String(locationId);
  const response = await rest.get({ path: 'inventory_levels', query });
  return (response.body as { inventory_levels: ShopifyInventoryLevel[] }).inventory_levels;
}

export async function setInventoryLevel(
  config: StoreConfig,
  inventoryItemId: number,
  locationId: number,
  available: number
): Promise<ShopifyInventoryLevel> {
  const { rest } = createShopifyClient(config);
  const response = await rest.post({
    path: 'inventory_levels/set',
    data: {
      inventory_item_id: inventoryItemId,
      location_id: locationId,
      available,
    },
    type: DataType.JSON,
  });
  return (response.body as { inventory_level: ShopifyInventoryLevel }).inventory_level;
}
