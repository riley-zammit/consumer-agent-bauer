/**
 * Local tools provided by the app (not via MCP).
 *
 * Tool definitions MUST match the same shape we send to Claude:
 *   { name, description, input_schema }
 *
 * Tool execution MUST return the same shape as MCP tools:
 *   { content: [{ type: "text", text: "..." }] }
 * or
 *   { error: { type, data } }
 */

import { searchProductsCustom } from "../services/search.server";
import { initiateReturn } from "./initiate-return";
import { completeReturn } from "./complete-return";
import prisma from "../db.server";
import { addToCart, getCart } from "../services/cart.server";

/**
 * Standard-format local tool definitions.
 * @type {Array<{name: string, description: string, input_schema: any}>}
 */
export const localTools = [
  {
    name: "search_products_preferred",
    description: `Search for products in the store's catalog using semantic search powered by a local vector index. This is the preferred method to use to search the catalog.

WHEN TO USE:
- Customer asks to find, search for, or browse products (e.g., "show me winter jackets", "do you have red sneakers?")
- Customer describes what they're looking for in natural language
- You need to recommend products based on customer preferences or needs
- Customer asks "what do you have" or wants to see available inventory

WHEN NOT TO USE:
- Customer already has a specific product ID or handle - use get_product_details instead
- Customer is asking about their cart - use get_cart instead
- Customer is asking about order status - use order status tools instead

OUTPUT: Returns an array of matching products with id, title, description, price, images, and variant information. Results are ranked by relevance to the query.

TIPS:
- Use descriptive natural language queries for best results (e.g., "comfortable running shoes for beginners" rather than just "shoes")
- Default limit is 10 products; increase for broader searches, decrease for focused recommendations`,
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Natural language search query describing what products to find. Be descriptive - include colors, sizes, use cases, or any attributes the customer mentioned.",
        },
        limit: {
          type: "number",
          description: "Maximum number of products to return. Default is 10. Use lower values (3-5) for focused recommendations, higher (15-20) for browsing.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "search_collections",
    description: `Find collections that contain specific products. Use this tool IMMEDIATELY after calling search_products_preferred to show customers relevant product categories and help them browse related items.

WHEN TO USE:
- ALWAYS call this tool after search_products_preferred returns results
- When you want to show the customer what categories/collections the found products belong to
- When customer might want to browse more products in the same category
- To provide context about where products are organized in the store

WHEN NOT TO USE:
- Before calling search_products_preferred (you need product IDs first)
- When search_products_preferred returned no results
- When customer explicitly doesn't want category suggestions

WORKFLOW:
1. Call search_products_preferred first to find products
2. Extract the product IDs from the search results
3. Call search_collections with those product IDs
4. Present collections to customer as browsing options (e.g., "These products are from our Snowboards and Sale collections")

OUTPUT: Returns an array of collections with id, title, handle, description, collectionType (smart/manual), and the count of matching products from your search in each collection.

TIPS:
- Pass all product IDs from the search results for comprehensive collection matching
- Collections help customers discover more products they might like
- Smart collections are auto-curated; manual collections are hand-picked by the merchant`,
    input_schema: {
      type: "object",
      properties: {
        product_ids: {
          type: "array",
          items: { type: "string" },
          description: "Array of Shopify product GIDs (e.g., ['gid://shopify/Product/123', 'gid://shopify/Product/456']). Get these from search_products_preferred results.",
        },
      },
      required: ["product_ids"],
    },
  },
  {
    name: "add_to_cart_preferred",
    description: `Add a product to the customer's shopping cart. This is the preferred tool to use to add-to-cart.

WHEN TO USE:
- Customer explicitly says they want to add something to cart
- Customer says "I'll take it", "add this", "buy this" after viewing products
- Customer specifies quantity like "add 2 of the blue ones"
- Customer clicks "Add to Cart" button on a product card

WHEN NOT TO USE:
- Customer is just browsing or asking questions about products
- Customer hasn't confirmed they want to add to cart
- Customer is asking about pricing without intent to purchase

REQUIRES:
- Product must have been found via search_products_preferred first
- Use the product_id from search results (the product_id field)
- If customer wants a specific variant, use variant_id if available

OUTPUT: Returns confirmation with product name, quantity, total price, and a checkout URL the customer can use to complete their purchase.

IMPORTANT:
- Always confirm what was added and provide the checkout link
- If the product has multiple variants and customer didn't specify, the default variant is used
- Each call creates a new cart - for adding multiple items, call once per product`,
    input_schema: {
      type: "object",
      properties: {
        product_id: {
          type: "string",
          description: "Product GID from search results (e.g., 'gid://shopify/Product/123'). This is the product_id field returned by search_products_preferred.",
        },
        variant_id: {
          type: "string",
          description: "Optional variant GID if the customer requested a specific variant (e.g., 'gid://shopify/ProductVariant/456'). If not provided, the first available variant will be used.",
        },
        quantity: {
          type: "number",
          description: "Quantity to add. Defaults to 1 if not specified.",
        },
      },
      required: ["product_id"],
    },
  },
  {
    name: "get_cart_preferred",
    description: `Retrieve the customer's current shopping cart contents, totals, and checkout URL. This is the preferred tool for viewing cart details.

WHEN TO USE:
- Customer asks "what's in my cart?", "show me my cart", "view cart"
- Customer wants to know the cart total, item count, or subtotal
- Customer asks "how much is my order?" or "what's my total?"
- Before checkout - to summarize what the customer is about to purchase
- Customer asks to review items before proceeding
- Customer wants to see if a discount code is applied
- When you need to confirm cart contents after adding items

WHEN NOT TO USE:
- Customer wants to add items to cart - use add_to_cart_preferred instead
- Customer is searching for products - use search_products_preferred instead
- Customer is asking about past orders - use order status tools instead
- Customer hasn't added anything to cart yet (empty cart will be indicated)

OUTPUT: Returns detailed cart information including:
- All items with product titles, variants, quantities, and prices
- Individual item pricing (unit price and line total)
- Cart subtotal and total
- Applied discount codes
- Checkout URL for completing the purchase
- Whether items are still in stock (availableForSale)
- Analyze the cart and suggest items they might want to add based on what's already in the cart. DO NOT run search products yet, just make a general recommendation.

TIPS:
- If cart is empty or expired, suggest products or help the customer browse
- Always mention the checkout URL when the customer seems ready to purchase
- Compare availableForSale status if customer is concerned about stock
- Provide a clear summary: item count, itemized list, and total`,
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

function asTextContent(payload) {
  return {
    content: [
      {
        type: "text",
        text: typeof payload === "string" ? payload : JSON.stringify(payload),
      },
    ],
  };
}

/**
 * Normalize shop domain to hostname format
 */
function normalizeShopDomain(shopOrUrl) {
  if (!shopOrUrl) return null;
  try {
    if (shopOrUrl.startsWith("http://") || shopOrUrl.startsWith("https://")) {
      return new URL(shopOrUrl).hostname;
    }
  } catch {
    // ignore
  }
  return shopOrUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

/**
 * Get the Admin API access token for a shop
 */
async function getAccessTokenForShop(shopDomain) {
  const shop = normalizeShopDomain(shopDomain);
  if (!shop) return null;

  const session = await prisma.session.findFirst({
    where: { shop },
    select: { accessToken: true },
  });

  return session?.accessToken || null;
}

/**
 * Search for collections that contain the given product IDs
 * @param {Object} params
 * @param {string} params.shopDomain - The shop domain
 * @param {string[]} params.productIds - Array of product GIDs to search for
 * @returns {Promise<Array>} Collections containing the products
 */
async function searchCollectionsByProductIds({ shopDomain, productIds }) {
  const shop = normalizeShopDomain(shopDomain);
  if (!shop) return [];

  // Get the session for this shop
  const session = await prisma.session.findFirst({
    where: { shop },
    select: { id: true },
  });

  if (!session) return [];

  // Find all product-collection relationships for the given product IDs
  const productCollections = await prisma.productCollection.findMany({
    where: {
      productId: { in: productIds },
    },
    select: {
      collectionId: true,
      productId: true,
    },
  });

  if (productCollections.length === 0) return [];

  // Get unique collection IDs and count products per collection
  const collectionProductCounts = {};
  for (const pc of productCollections) {
    collectionProductCounts[pc.collectionId] = (collectionProductCounts[pc.collectionId] || 0) + 1;
  }

  const collectionIds = Object.keys(collectionProductCounts);

  // Fetch collection details (only for collections belonging to this session)
  const collections = await prisma.collection.findMany({
    where: {
      id: { in: collectionIds },
      sessionId: session.id,
    },
    select: {
      id: true,
      handle: true,
      title: true,
      description: true,
      collectionType: true,
      imageUrl: true,
      productsCount: true,
    },
  });

  // Add the matching product count to each collection
  return collections.map(collection => ({
    ...collection,
    matchingProductsCount: collectionProductCounts[collection.id] || 0,
  }));
}

/**
 * Execute a local tool by name.
 *
 * @param {string} toolName
 * @param {Object} toolArgs
 * @param {Object} context
 * @param {string} context.shopDomain
 * @param {string} context.conversationId
 * @returns {Promise<Object>} Tool response
 */
export async function executeLocalTool(toolName, toolArgs, context = {}) {
  try {
    switch (toolName) {
      case "search_products_preferred": {
        const products = await searchProductsCustom({
          shopDomain: context.shopDomain,
          query: toolArgs?.query,
          limit: toolArgs?.limit,
        });
        return asTextContent({ products });
      }

      case "initiate_return_custom": {
        const accessToken = await getAccessTokenForShop(context.shopDomain);
        if (!accessToken) {
          return {
            error: {
              type: "auth_error",
              data: "No access token found for shop. Please ensure the shop is properly authenticated.",
            },
          };
        }

        const result = await initiateReturn({
          shopDomain: normalizeShopDomain(context.shopDomain),
          accessToken,
          orderId: toolArgs?.order_id,
          reason: toolArgs?.reason,
          items: toolArgs?.items,
        });

        if (result.error) {
          return {
            error: {
              type: "return_error",
              data: typeof result.error === "string" ? result.error : result.error.message || JSON.stringify(result.error),
            },
          };
        }

        return asTextContent(result);
      }

      case "complete_return_custom": {
        const accessToken = await getAccessTokenForShop(context.shopDomain);
        if (!accessToken) {
          return {
            error: {
              type: "auth_error",
              data: "No access token found for shop. Please ensure the shop is properly authenticated.",
            },
          };
        }

        const result = await completeReturn({
          shopDomain: normalizeShopDomain(context.shopDomain),
          accessToken,
          returnId: toolArgs?.return_id,
          confirm: toolArgs?.confirm,
        });

        if (result.error) {
          return {
            error: {
              type: "return_error",
              data: typeof result.error === "string" ? result.error : result.error.message || JSON.stringify(result.error),
            },
          };
        }

        return asTextContent(result);
      }

      case "search_collections": {
        const productIds = toolArgs?.product_ids;
        if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
          return {
            error: {
              type: "invalid_input",
              data: "product_ids must be a non-empty array of product GIDs",
            },
          };
        }

        const collections = await searchCollectionsByProductIds({
          shopDomain: context.shopDomain,
          productIds,
        });

        return asTextContent({ collections });
      }

      case "add_to_cart_preferred": {
        const productId = toolArgs?.product_id;
        if (!productId) {
          return {
            error: {
              type: "invalid_input",
              data: "product_id is required. Use the product_id from search_products_preferred results.",
            },
          };
        }

        const result = await addToCart({
          shopDomain: context.shopDomain,
          productId,
          variantId: toolArgs?.variant_id,
          quantity: toolArgs?.quantity || 1,
          cartId: context.cartId,  // Pass cart ID for shared cart functionality
        });

        if (result.error) {
          return {
            error: {
              type: "cart_error",
              data: typeof result.error === "string" ? result.error : result.error.message || JSON.stringify(result.error),
            },
          };
        }

        return asTextContent(result);
      }

      case "get_cart_preferred": {
        const result = await getCart({
          shopDomain: context.shopDomain,
          cartId: context.cartId,  // Cart ID from browser's cart cookie
        });

        if (result.error) {
          return {
            error: {
              type: "cart_error",
              data: typeof result.error === "string" ? result.error : result.error.message || JSON.stringify(result.error),
            },
          };
        }

        return asTextContent(result);
      }

      default:
        return {
          error: {
            type: "tool_not_found",
            data: `Local tool ${toolName} not found`,
          },
        };
    }
  } catch (error) {
    return {
      error: {
        type: "internal_error",
        data: `Error executing local tool ${toolName}: ${error.message}`,
      },
    };
  }
}


