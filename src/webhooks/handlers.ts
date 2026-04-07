import { logger } from '../core/logger';
import { ShopifyOrder, ShopifyProduct } from '../core/types';

export async function handleOrderCreate(order: ShopifyOrder, storeDomain: string): Promise<void> {
  logger.info(`New order #${order.order_number}`, { store: storeDomain, id: order.id, total: order.total_price });
}

export async function handleProductUpdate(product: ShopifyProduct, storeDomain: string): Promise<void> {
  logger.info(`Product updated: ${product.title}`, { store: storeDomain, id: product.id });
  // Meta catalog sync — Phase 2
}

export async function handleInventoryUpdate(
  inventoryLevel: { inventory_item_id: number; available: number; location_id: number },
  storeDomain: string
): Promise<void> {
  logger.info('Inventory updated', { store: storeDomain, ...inventoryLevel });

  if (inventoryLevel.available <= 5) {
    logger.warn(`Low stock alert`, { store: storeDomain, ...inventoryLevel });
  }
}

export async function handleCartUpdate(
  cart: Record<string, unknown>,
  storeDomain: string
): Promise<void> {
  logger.info('Cart updated', { store: storeDomain, cartId: cart['id'] });
  // Remarketing trigger — Phase 2
}

export async function handleCheckoutCreate(
  checkout: Record<string, unknown>,
  storeDomain: string
): Promise<void> {
  logger.info('Checkout created', { store: storeDomain, checkoutId: checkout['id'] });
  // Abandoned cart remarketing — Phase 2
}
