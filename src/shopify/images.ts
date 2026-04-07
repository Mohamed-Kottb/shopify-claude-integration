import * as fs from 'fs';
import * as path from 'path';
import { DataType } from '@shopify/shopify-api';
import { createShopifyClient } from './client';
import { StoreConfig } from '../core/types';

interface ShopifyProductImage {
  id: number;
  product_id: number;
  src: string;
  filename: string;
  position: number;
  created_at: string;
}

export async function uploadProductImage(
  config: StoreConfig,
  productId: number,
  imagePath: string
): Promise<ShopifyProductImage> {
  if (!fs.existsSync(imagePath)) {
    throw new Error(`File not found: ${imagePath}`);
  }

  const filename = path.basename(imagePath);
  const attachment = fs.readFileSync(imagePath).toString('base64');

  const { rest } = createShopifyClient(config);
  const response = await rest.post({
    path: `products/${productId}/images`,
    data: { image: { attachment, filename } },
    type: DataType.JSON,
  });

  return (response.body as { image: ShopifyProductImage }).image;
}

export async function uploadMultipleImages(
  config: StoreConfig,
  productId: number,
  imagePaths: string[]
): Promise<ShopifyProductImage[]> {
  const results: ShopifyProductImage[] = [];

  for (const imagePath of imagePaths) {
    const image = await uploadProductImage(config, productId, imagePath);
    results.push(image);
  }

  return results;
}

export async function getProductImages(
  config: StoreConfig,
  productId: number
): Promise<ShopifyProductImage[]> {
  const { rest } = createShopifyClient(config);
  const response = await rest.get({ path: `products/${productId}/images` });
  return (response.body as { images: ShopifyProductImage[] }).images;
}

export async function deleteProductImage(
  config: StoreConfig,
  productId: number,
  imageId: number
): Promise<void> {
  const { rest } = createShopifyClient(config);
  await rest.delete({ path: `products/${productId}/images/${imageId}` });
}
