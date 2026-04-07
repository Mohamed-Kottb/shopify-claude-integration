import { DataType } from '@shopify/shopify-api';
import { createShopifyClient } from './client';
import { StoreConfig, ShopifyPriceRule, ShopifyDiscountCode } from '../core/types';

export async function getPriceRules(config: StoreConfig, limit = 50): Promise<ShopifyPriceRule[]> {
  const { rest } = createShopifyClient(config);
  const response = await rest.get({ path: 'price_rules', query: { limit: String(limit) } });
  return (response.body as { price_rules: ShopifyPriceRule[] }).price_rules;
}

export async function createDiscount(
  config: StoreConfig,
  data: {
    title: string;
    code: string;
    value_type: 'percentage' | 'fixed_amount';
    value: string;           // negative number, e.g. "-10.0" for 10% off
    starts_at?: string;      // ISO 8601
    ends_at?: string;
    usage_limit?: number;
    customer_selection?: 'all' | 'prerequisite';
  }
): Promise<{ price_rule: ShopifyPriceRule; discount_code: ShopifyDiscountCode }> {
  const { rest } = createShopifyClient(config);

  const priceRuleRes = await rest.post({
    path: 'price_rules',
    data: {
      price_rule: {
        title: data.title,
        value_type: data.value_type,
        value: data.value,
        customer_selection: data.customer_selection ?? 'all',
        target_type: 'line_item',
        target_selection: 'all',
        allocation_method: 'across',
        starts_at: data.starts_at ?? new Date().toISOString(),
        ends_at: data.ends_at ?? null,
        usage_limit: data.usage_limit ?? null,
      },
    },
    type: DataType.JSON,
  });
  const priceRule = (priceRuleRes.body as { price_rule: ShopifyPriceRule }).price_rule;

  const codeRes = await rest.post({
    path: `price_rules/${priceRule.id}/discount_codes`,
    data: { discount_code: { code: data.code } },
    type: DataType.JSON,
  });
  const discountCode = (codeRes.body as { discount_code: ShopifyDiscountCode }).discount_code;

  return { price_rule: priceRule, discount_code: discountCode };
}

export async function getDiscountCodes(
  config: StoreConfig,
  priceRuleId: number
): Promise<ShopifyDiscountCode[]> {
  const { rest } = createShopifyClient(config);
  const response = await rest.get({ path: `price_rules/${priceRuleId}/discount_codes` });
  return (response.body as { discount_codes: ShopifyDiscountCode[] }).discount_codes;
}
