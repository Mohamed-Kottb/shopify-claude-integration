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
