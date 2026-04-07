import { DataType } from '@shopify/shopify-api';
import { createShopifyClient } from './client';
import { StoreConfig, ShopifyOrder, ShopifyFulfillment, ShopifyRefund } from '../core/types';

export async function cancelOrder(
  config: StoreConfig,
  orderId: number,
  reason?: string
): Promise<ShopifyOrder> {
  const { rest } = createShopifyClient(config);
  const response = await rest.post({
    path: `orders/${orderId}/cancel`,
    data: reason ? { reason } : {},
    type: DataType.JSON,
  });
  return (response.body as { order: ShopifyOrder }).order;
}

export async function fulfillOrder(
  config: StoreConfig,
  orderId: number,
  data: {
    tracking_number?: string;
    tracking_company?: string;
    notify_customer?: boolean;
  }
): Promise<ShopifyFulfillment> {
  const { rest } = createShopifyClient(config);

  // Get fulfillment orders for this order
  const foRes = await rest.get({ path: `orders/${orderId}/fulfillment_orders` });
  const fulfillmentOrders = (
    foRes.body as { fulfillment_orders: Array<{ id: number }> }
  ).fulfillment_orders;

  if (!fulfillmentOrders.length) throw new Error(`No fulfillment orders found for order ${orderId}`);

  const fulfillmentData: Record<string, unknown> = {
    line_items_by_fulfillment_order: fulfillmentOrders.map(fo => ({
      fulfillment_order_id: fo.id,
    })),
    notify_customer: data.notify_customer ?? true,
  };

  if (data.tracking_number) {
    fulfillmentData['tracking_info'] = {
      number: data.tracking_number,
      company: data.tracking_company ?? '',
    };
  }

  const response = await rest.post({
    path: 'fulfillments',
    data: { fulfillment: fulfillmentData },
    type: DataType.JSON,
  });
  return (response.body as { fulfillment: ShopifyFulfillment }).fulfillment;
}

export async function getRefunds(config: StoreConfig, orderId: number): Promise<ShopifyRefund[]> {
  const { rest } = createShopifyClient(config);
  const response = await rest.get({ path: `orders/${orderId}/refunds` });
  return (response.body as { refunds: ShopifyRefund[] }).refunds;
}
