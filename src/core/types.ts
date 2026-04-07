export interface StoreConfig {
  name: string;
  storeUrl: string;
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  webhookSecret?: string;
  commands: StoreCommands;
  meta?: MetaConfig;
}

export interface StoreCommands {
  enabled: string[];
  remarketing?: RemarketingConfig;
  claude?: ClaudeConfig;
}

export interface RemarketingConfig {
  enabled: boolean;
  triggers: string[];
}

export interface ClaudeConfig {
  autoAnalyzeOrders: boolean;
  autoAnalyzeInventory: boolean;
}

export interface MetaConfig {
  pixelId?: string;
  accessToken?: string;
  catalogId?: string;
}

export interface ShopifyProduct {
  id: number;
  title: string;
  body_html: string;
  vendor: string;
  product_type: string;
  status: string;
  variants: ShopifyVariant[];
  images: ShopifyImage[];
}

export interface ShopifyVariant {
  id: number;
  product_id: number;
  title: string;
  price: string;
  sku: string;
  inventory_quantity: number;
}

export interface ShopifyImage {
  id: number;
  src: string;
  alt: string | null;
}

export interface ShopifyOrder {
  id: number;
  order_number: number;
  email: string;
  total_price: string;
  financial_status: string;
  fulfillment_status: string | null;
  line_items: ShopifyLineItem[];
  customer: ShopifyCustomerSummary;
  created_at: string;
}

export interface ShopifyLineItem {
  id: number;
  product_id: number;
  title: string;
  quantity: number;
  price: string;
}

export interface ShopifyCustomerSummary {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
}

export interface ShopifyCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  orders_count: number;
  total_spent: string;
  tags: string;
  created_at: string;
}

export interface ShopifyCollection {
  id: number;
  title: string;
  body_html: string;
  handle: string;
  published_at: string;
  sort_order: string;
  products_count?: number;
}

export interface ShopifyPriceRule {
  id: number;
  title: string;
  value_type: string;
  value: string;
  customer_selection: string;
  target_type: string;
  starts_at: string;
  ends_at: string | null;
  usage_limit: number | null;
  usage_count: number;
}

export interface ShopifyDiscountCode {
  id: number;
  price_rule_id: number;
  code: string;
  usage_count: number;
  created_at: string;
}

export interface ShopifyLocation {
  id: number;
  name: string;
  address1: string;
  city: string;
  country: string;
  active: boolean;
}

export interface ShopifyInventoryLevel {
  inventory_item_id: number;
  location_id: number;
  available: number;
  updated_at: string;
}

export interface ShopifyFulfillment {
  id: number;
  order_id: number;
  status: string;
  tracking_number: string | null;
  tracking_company: string | null;
  created_at: string;
}

export interface ShopifyRefund {
  id: number;
  order_id: number;
  note: string;
  refund_line_items: Array<{
    id: number;
    quantity: number;
    line_item_id: number;
    subtotal: string;
  }>;
  transactions: Array<{
    id: number;
    amount: string;
    kind: string;
    status: string;
  }>;
  created_at: string;
}
