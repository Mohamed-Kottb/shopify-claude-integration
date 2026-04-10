import { createShopifyClient } from './client';
import { StoreConfig, ShopifyProduct, ShopifyVariant, ShopifyImage } from '../core/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function gidToId(gid: string): number {
  return parseInt(gid.split('/').pop() ?? '0', 10);
}

function idToGid(id: number, type: string): string {
  return `gid://shopify/${type}/${id}`;
}

// ── Internal GraphQL types ────────────────────────────────────────────────────

interface GqlVariantNode {
  id: string;
  title: string;
  price: string;
  sku: string | null;
  inventoryQuantity: number | null;
}

interface GqlImageNode {
  id: string;
  url: string;
  altText: string | null;
}

interface GqlProductNode {
  id: string;
  title: string;
  bodyHtml: string | null;
  vendor: string;
  productType: string;
  status: string;
  tags: string[];
  variants: { nodes: GqlVariantNode[] };
  images: { nodes: GqlImageNode[] };
}

// ── Shared fragment ───────────────────────────────────────────────────────────

const PRODUCT_FIELDS = `
  id title bodyHtml vendor productType status tags
  variants(first: 100) { nodes { id title price sku inventoryQuantity } }
  images(first: 10)    { nodes { id url altText } }
`;

// ── Mapping ───────────────────────────────────────────────────────────────────

function mapProduct(node: GqlProductNode): ShopifyProduct {
  const productId = gidToId(node.id);
  return {
    id: productId,
    title: node.title,
    body_html: node.bodyHtml ?? '',
    vendor: node.vendor,
    product_type: node.productType,
    status: node.status.toLowerCase(),
    tags: node.tags.join(', '),
    variants: node.variants.nodes.map((v): ShopifyVariant => ({
      id: gidToId(v.id),
      product_id: productId,
      title: v.title,
      price: v.price,
      sku: v.sku ?? '',
      inventory_quantity: v.inventoryQuantity ?? 0,
    })),
    images: node.images.nodes.map((img): ShopifyImage => ({
      id: gidToId(img.id),
      src: img.url,
      alt: img.altText ?? null,
    })),
  };
}

// Convert REST-style Partial<ShopifyProduct> → GraphQL ProductInput object
function toProductInput(data: Partial<ShopifyProduct> & { metafields?: Array<{ namespace: string; key: string; value: string; type: string }> }): Record<string, unknown> {
  const input: Record<string, unknown> = {};

  if (data.title        !== undefined) input.title          = data.title;
  if (data.body_html    !== undefined) input.descriptionHtml = data.body_html;
  if (data.vendor       !== undefined) input.vendor         = data.vendor;
  if (data.product_type !== undefined) input.productType    = data.product_type;
  if (data.status       !== undefined) input.status         = (data.status as string).toUpperCase();
  if (data.tags         !== undefined) {
    input.tags = typeof data.tags === 'string'
      ? data.tags.split(',').map(t => t.trim()).filter(Boolean)
      : data.tags;
  }

  if (data.variants?.length) {
    input.variants = data.variants.map(v => {
      const variant: Record<string, unknown> = {};
      if (v.id)    variant.id    = idToGid(v.id, 'ProductVariant');
      if (v.price) variant.price = v.price;
      if (v.sku)   variant.sku   = v.sku;
      // option values — tools.ts passes option1/option2/option3 on the variant object
      const raw = v as unknown as Record<string, unknown>;
      const opts = [raw['option1'], raw['option2'], raw['option3']].filter(Boolean);
      if (opts.length) variant.options = opts;
      return variant;
    });
  }

  if (data.images?.length) {
    input.images = data.images.map(img => ({ src: img.src }));
  }

  if (data.metafields?.length) {
    input.metafields = data.metafields;
  }

  return input;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getProducts(config: StoreConfig, limit = 50): Promise<ShopifyProduct[]> {
  const { graphql } = createShopifyClient(config);
  const response = await graphql.query({
    data: {
      query: `query GetProducts($first: Int!) {
        products(first: $first) { nodes { ${PRODUCT_FIELDS} } }
      }`,
      variables: { first: limit },
    },
  });
  const body = response.body as unknown as { data: { products: { nodes: GqlProductNode[] } } };
  return body.data.products.nodes.map(mapProduct);
}

export async function getProduct(config: StoreConfig, productId: number): Promise<ShopifyProduct> {
  const { graphql } = createShopifyClient(config);
  const response = await graphql.query({
    data: {
      query: `query GetProduct($id: ID!) {
        product(id: $id) { ${PRODUCT_FIELDS} }
      }`,
      variables: { id: idToGid(productId, 'Product') },
    },
  });
  const body = response.body as unknown as { data: { product: GqlProductNode } };
  return mapProduct(body.data.product);
}

export async function createProduct(
  config: StoreConfig,
  data: Partial<ShopifyProduct> & { metafields?: Array<{ namespace: string; key: string; value: string; type: string }> }
): Promise<ShopifyProduct> {
  const { graphql } = createShopifyClient(config);
  const input = toProductInput(data);

  const response = await graphql.query({
    data: {
      query: `mutation ProductCreate($input: ProductInput!) {
        productCreate(input: $input) {
          product { ${PRODUCT_FIELDS} }
          userErrors { field message }
        }
      }`,
      variables: { input },
    },
  });

  const body = response.body as unknown as {
    data: {
      productCreate: {
        product: GqlProductNode | null;
        userErrors: Array<{ field: string[]; message: string }>;
      };
    };
  };

  const { product, userErrors } = body.data.productCreate;
  if (userErrors.length > 0) {
    throw new Error(`Shopify productCreate errors: ${userErrors.map(e => e.message).join(', ')}`);
  }
  if (!product) throw new Error('productCreate returned no product');
  return mapProduct(product);
}

export async function updateProduct(
  config: StoreConfig,
  productId: number,
  data: Partial<ShopifyProduct>
): Promise<ShopifyProduct> {
  const { graphql } = createShopifyClient(config);
  const input = { id: idToGid(productId, 'Product'), ...toProductInput(data) };

  const response = await graphql.query({
    data: {
      query: `mutation ProductUpdate($input: ProductInput!) {
        productUpdate(input: $input) {
          product { ${PRODUCT_FIELDS} }
          userErrors { field message }
        }
      }`,
      variables: { input },
    },
  });

  const body = response.body as unknown as {
    data: {
      productUpdate: {
        product: GqlProductNode | null;
        userErrors: Array<{ field: string[]; message: string }>;
      };
    };
  };

  const { product, userErrors } = body.data.productUpdate;
  if (userErrors.length > 0) {
    throw new Error(`Shopify productUpdate errors: ${userErrors.map(e => e.message).join(', ')}`);
  }
  if (!product) throw new Error('productUpdate returned no product');
  return mapProduct(product);
}

export async function deleteProduct(config: StoreConfig, productId: number): Promise<void> {
  const { graphql } = createShopifyClient(config);
  const response = await graphql.query({
    data: {
      query: `mutation ProductDelete($id: ID!) {
        productDelete(input: { id: $id }) {
          userErrors { field message }
        }
      }`,
      variables: { id: idToGid(productId, 'Product') },
    },
  });

  const body = response.body as unknown as {
    data: { productDelete: { userErrors: Array<{ field: string[]; message: string }> } };
  };
  const { userErrors } = body.data.productDelete;
  if (userErrors.length > 0) {
    throw new Error(`Shopify productDelete errors: ${userErrors.map(e => e.message).join(', ')}`);
  }
}
