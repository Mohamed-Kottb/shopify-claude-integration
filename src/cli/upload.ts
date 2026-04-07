/**
 * Upload images or create products from your local Mac.
 *
 * Usage:
 *   npm run upload -- <store> image <product-id> <image-path>
 *   npm run upload -- <store> images <product-id> <image1> <image2> ...
 *   npm run upload -- <store> product <title> <image-path>
 *
 * Examples:
 *   npm run upload -- <store> image <product-id> ~/Desktop/product.jpg
 *   npm run upload -- <store> images <product-id> ~/Desktop/img1.jpg ~/Desktop/img2.jpg
 *   npm run upload -- <store> product "Product Title" ~/Desktop/new-product.jpg
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { loadStore } from '../core/storeLoader';
import { uploadProductImage, uploadMultipleImages } from '../shopify/images';
import { createProduct } from '../shopify/products';
import { logger } from '../core/logger';

dotenv.config();

const [, , storeName, command, ...args] = process.argv;

function resolvePath(p: string): string {
  return p.startsWith('~') ? path.join(process.env.HOME ?? '', p.slice(1)) : path.resolve(p);
}

if (!storeName || !command) {
  console.log(`
Usage: npm run upload -- <store> <command> [args]

Commands:
  image   <product-id> <path>              Upload one image to a product
  images  <product-id> <path1> <path2>...  Upload multiple images to a product
  product <title> <image-path>             Create a new product with an image
  `);
  process.exit(0);
}

async function run(): Promise<void> {
  const config = loadStore(storeName);

  switch (command) {

    case 'image': {
      const [productId, imagePath] = args;
      if (!productId || !imagePath) {
        logger.error('Usage: npm run upload -- <store> image <product-id> <image-path>');
        process.exit(1);
      }
      const image = await uploadProductImage(config, Number(productId), resolvePath(imagePath));
      logger.success(`Image uploaded to product ${productId}`, { src: image.src });
      break;
    }

    case 'images': {
      const [productId, ...imagePaths] = args;
      if (!productId || imagePaths.length === 0) {
        logger.error('Usage: npm run upload -- <store> images <product-id> <path1> <path2>...');
        process.exit(1);
      }
      const images = await uploadMultipleImages(config, Number(productId), imagePaths.map(resolvePath));
      logger.success(`${images.length} image(s) uploaded to product ${productId}`);
      images.forEach(img => logger.info(img.filename, { src: img.src }));
      break;
    }

    case 'product': {
      const [title, imagePath] = args;
      if (!title || !imagePath) {
        logger.error('Usage: npm run upload -- <store> product <title> <image-path>');
        process.exit(1);
      }
      const product = await createProduct(config, { title, status: 'draft' });
      logger.success(`Product created: ${product.title} (ID: ${product.id})`);

      const image = await uploadProductImage(config, product.id, resolvePath(imagePath));
      logger.success(`Image uploaded`, { src: image.src });
      logger.info(`Product is in draft — edit details in Shopify admin then publish.`);
      break;
    }

    default:
      logger.error(`Unknown command: "${command}". Use: image, images, product`);
      process.exit(1);
  }
}

run().catch(err => {
  logger.error('Upload failed', err);
  process.exit(1);
});
