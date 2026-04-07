import { DataType } from '@shopify/shopify-api';
import { createShopifyClient } from './client';
import { StoreConfig } from '../core/types';

interface ShopifyTheme {
  id: number;
  name: string;
  role: 'main' | 'unpublished' | 'demo';
  created_at: string;
  updated_at: string;
}

interface ThemeAsset {
  key: string;
  value?: string;
  attachment?: string;
  content_type: string;
  size: number;
  updated_at: string;
}

export async function getThemes(config: StoreConfig): Promise<ShopifyTheme[]> {
  const { rest } = createShopifyClient(config);
  const response = await rest.get({ path: 'themes' });
  return (response.body as { themes: ShopifyTheme[] }).themes;
}

export async function getActiveTheme(config: StoreConfig): Promise<ShopifyTheme | undefined> {
  const themes = await getThemes(config);
  return themes.find(t => t.role === 'main');
}

export async function getThemeAsset(
  config: StoreConfig,
  themeId: number,
  key: string
): Promise<ThemeAsset> {
  const { rest } = createShopifyClient(config);
  const response = await rest.get({
    path: `themes/${themeId}/assets`,
    query: { 'asset[key]': key },
  });
  return (response.body as { asset: ThemeAsset }).asset;
}

export async function updateThemeAsset(
  config: StoreConfig,
  themeId: number,
  key: string,
  value: string
): Promise<ThemeAsset> {
  const { rest } = createShopifyClient(config);
  const response = await rest.put({
    path: `themes/${themeId}/assets`,
    data: { asset: { key, value } },
    type: DataType.JSON,
  });
  return (response.body as { asset: ThemeAsset }).asset;
}

export async function listThemeAssets(config: StoreConfig, themeId: number): Promise<ThemeAsset[]> {
  const { rest } = createShopifyClient(config);
  const response = await rest.get({ path: `themes/${themeId}/assets` });
  return (response.body as { assets: ThemeAsset[] }).assets;
}
