/**
 * Cart Service
 * Provides shared utilities for cart operations and confirmations
 * Used by multiple add-to-cart implementations (AJAX, Checkout UI Extension, Storefront API, etc.)
 */

import prisma from "../db.server";

const STOREFRONT_API_VERSION = '2025-01';

/**
 * GraphQL mutation to add lines to an existing cart
 */
const CART_LINES_ADD_MUTATION = `
mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
  cartLinesAdd(cartId: $cartId, lines: $lines) {
    cart {
      id
      totalQuantity
      checkoutUrl
      cost {
        totalAmount {
          amount
          currencyCode
        }
      }
      lines(first: 10) {
        edges {
          node {
            id
            quantity
            merchandise {
              ... on ProductVariant {
                id
                title
                product {
                  title
                }
              }
            }
          }
        }
      }
    }
    userErrors {
      field
      message
      code
    }
  }
}`;

/**
 * GraphQL mutation to create a new cart with items
 */
const CART_CREATE_MUTATION = `
mutation cartCreate($input: CartInput!) {
  cartCreate(input: $input) {
    cart {
      id
      totalQuantity
      checkoutUrl
      cost {
        totalAmount {
          amount
          currencyCode
        }
      }
    }
    userErrors {
      field
      message
      code
    }
  }
}`;

/**
 * Make a Storefront API GraphQL request
 *
 * @param {Object} options - Request options
 * @param {string} options.shopDomain - The shop's domain (e.g., "mystore.myshopify.com")
 * @param {string} options.storefrontAccessToken - The Storefront API access token
 * @param {string} options.query - The GraphQL query/mutation
 * @param {Object} options.variables - The GraphQL variables
 * @returns {Promise<Object>} The GraphQL response data
 */
async function storefrontApiRequest({ shopDomain, storefrontAccessToken, query, variables }) {
  // Normalize shop domain - remove protocol if present
  const normalizedDomain = shopDomain
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');

  const endpoint = `https://${normalizedDomain}/api/${STOREFRONT_API_VERSION}/graphql.json`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': storefrontAccessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Storefront API request failed: ${response.status} ${errorText}`);
  }

  const json = await response.json();

  if (json.errors) {
    throw new Error(`Storefront API errors: ${JSON.stringify(json.errors)}`);
  }

  return json.data;
}

/**
 * Add items to an existing cart using Storefront API
 *
 * @param {Object} options - Add to cart options
 * @param {string} options.shopDomain - The shop's domain
 * @param {string} options.storefrontAccessToken - Storefront API access token
 * @param {string} options.cartId - The cart's GID (e.g., "gid://shopify/Cart/...")
 * @param {string} options.variantId - The product variant's GID
 * @param {number} [options.quantity=1] - Quantity to add
 * @returns {Promise<Object>} The cart operation result
 */
export async function addToCartStorefront({
  shopDomain,
  storefrontAccessToken,
  cartId,
  variantId,
  quantity = 1
}) {
  const variables = {
    cartId,
    lines: [
      {
        merchandiseId: variantId,
        quantity,
      },
    ],
  };

  const data = await storefrontApiRequest({
    shopDomain,
    storefrontAccessToken,
    query: CART_LINES_ADD_MUTATION,
    variables,
  });

  const result = data.cartLinesAdd;

  if (result.userErrors && result.userErrors.length > 0) {
    return {
      success: false,
      errors: result.userErrors,
      cart: null,
    };
  }

  return {
    success: true,
    errors: [],
    cart: result.cart,
  };
}

/**
 * Create a new cart with items using Storefront API
 *
 * @param {Object} options - Create cart options
 * @param {string} options.shopDomain - The shop's domain
 * @param {string} options.storefrontAccessToken - Storefront API access token
 * @param {string} options.variantId - The product variant's GID
 * @param {number} [options.quantity=1] - Quantity to add
 * @returns {Promise<Object>} The cart creation result
 */
export async function createCartStorefront({
  shopDomain,
  storefrontAccessToken,
  variantId,
  quantity = 1
}) {
  const variables = {
    input: {
      lines: [
        {
          merchandiseId: variantId,
          quantity,
        },
      ],
    },
  };

  const data = await storefrontApiRequest({
    shopDomain,
    storefrontAccessToken,
    query: CART_CREATE_MUTATION,
    variables,
  });

  const result = data.cartCreate;

  if (result.userErrors && result.userErrors.length > 0) {
    return {
      success: false,
      errors: result.userErrors,
      cart: null,
    };
  }

  return {
    success: true,
    errors: [],
    cart: result.cart,
  };
}

/**
 * Add to cart with automatic cart creation if needed
 * If cartId is provided, adds to existing cart.
 * If no cartId, creates a new cart.
 *
 * @param {Object} options - Add to cart options
 * @param {string} options.shopDomain - The shop's domain
 * @param {string} options.storefrontAccessToken - Storefront API access token
 * @param {string} [options.cartId] - Optional existing cart GID
 * @param {string} options.variantId - The product variant's GID
 * @param {number} [options.quantity=1] - Quantity to add
 * @returns {Promise<Object>} The cart operation result
 */
export async function addToCartOrCreate({
  shopDomain,
  storefrontAccessToken,
  cartId,
  variantId,
  quantity = 1,
}) {
  if (cartId) {
    return addToCartStorefront({
      shopDomain,
      storefrontAccessToken,
      cartId,
      variantId,
      quantity,
    });
  }

  return createCartStorefront({
    shopDomain,
    storefrontAccessToken,
    variantId,
    quantity,
  });
}

/**
 * Generate a detailed cart confirmation message with checkout link
 *
 * @param {Object} options - Message options
 * @param {string} options.productTitle - The product title
 * @param {number} options.quantity - Quantity added
 * @param {Object} options.cart - The cart object from Storefront API
 * @returns {string} Formatted confirmation message
 */
export function generateStorefrontCartConfirmation({ productTitle, quantity, cart }) {
  const itemText = quantity > 1 ? `${quantity} items` : '1 item';
  const totalAmount = cart?.cost?.totalAmount;
  const totalFormatted = totalAmount
    ? `${totalAmount.currencyCode} ${parseFloat(totalAmount.amount).toFixed(2)}`
    : '';

  let message = `Added ${itemText} of "${productTitle}" to your cart.`;

  if (cart?.totalQuantity) {
    message += ` Your cart now has ${cart.totalQuantity} item${cart.totalQuantity > 1 ? 's' : ''}.`;
  }

  if (totalFormatted) {
    message += ` Cart total: ${totalFormatted}.`;
  }

  if (cart?.checkoutUrl) {
    message += ` [Proceed to checkout](${cart.checkoutUrl})`;
  }

  return message;
}

/**
 * Formats a cart confirmation message for display to the user
 * @param {string} productTitle - The title of the product added
 * @param {number} quantity - The quantity added (default: 1)
 * @returns {string} Formatted confirmation message
 */
export function formatCartConfirmationMessage(productTitle, quantity = 1) {
  const quantityText = quantity > 1 ? `${quantity} x ` : '';
  return `Great! I've added ${quantityText}"${productTitle}" to your cart. Would you like to continue shopping or proceed to checkout?`;
}

/**
 * Formats a cart error message for display to the user
 * @param {string} productTitle - The title of the product
 * @param {string} errorMessage - The error message from Shopify
 * @returns {string} Formatted error message
 */
export function formatCartErrorMessage(productTitle, errorMessage) {
  // Handle common Shopify cart errors
  if (errorMessage.includes('sold out') || errorMessage.includes('not available')) {
    return `Sorry, "${productTitle}" is currently out of stock. Would you like me to help you find a similar product?`;
  }

  if (errorMessage.includes("can't add more")) {
    return `Sorry, you've reached the maximum quantity available for "${productTitle}". Would you like to proceed to checkout or continue shopping?`;
  }

  // Generic error fallback
  return `I had trouble adding "${productTitle}" to your cart. ${errorMessage}. Would you like to try again?`;
}

/**
 * Creates the SSE data payload for a cart confirmation
 * @param {Object} params - Confirmation parameters
 * @param {string} params.productTitle - The title of the product added
 * @param {number} params.quantity - The quantity added
 * @param {string} params.conversationId - The conversation ID
 * @returns {Object} SSE-compatible data payload
 */
export function createCartConfirmationPayload({ productTitle, quantity, conversationId }) {
  return {
    type: 'cart_confirmation',
    conversation_id: conversationId,
    message: formatCartConfirmationMessage(productTitle, quantity),
    product_title: productTitle,
    quantity: quantity
  };
}

/**
 * Creates the SSE data payload for a cart error
 * @param {Object} params - Error parameters
 * @param {string} params.productTitle - The title of the product
 * @param {string} params.error - The error message
 * @param {string} params.conversationId - The conversation ID
 * @returns {Object} SSE-compatible data payload
 */
export function createCartErrorPayload({ productTitle, error, conversationId }) {
  return {
    type: 'cart_error',
    conversation_id: conversationId,
    message: formatCartErrorMessage(productTitle, error),
    product_title: productTitle,
    error: error
  };
}

/**
 * Normalize shop domain to hostname format
 * @param {string} shopOrUrl - Shop domain or URL
 * @returns {string|null} Normalized hostname
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
 * Get the storefront MCP endpoint URL for a shop
 * @param {string} shopDomain - The shop domain
 * @returns {string} The storefront MCP endpoint URL
 */
function getStorefrontMcpEndpoint(shopDomain) {
  const hostname = normalizeShopDomain(shopDomain);
  return `https://${hostname}/api/mcp`;
}

/**
 * Make a JSON-RPC request to the MCP endpoint
 * @param {string} endpoint - The MCP endpoint URL
 * @param {string} method - The JSON-RPC method
 * @param {Object} params - The method parameters
 * @returns {Promise<Object>} The response result
 */
async function makeMcpRequest(endpoint, method, params) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method,
      id: 1,
      params,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`MCP request failed: ${response.status} ${error}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message || JSON.stringify(data.error));
  }

  return data.result;
}

/**
 * Get the first available variant for a product from the local database
 * @param {string} shopDomain - The shop domain
 * @param {string} productId - The product GID
 * @returns {Promise<Object|null>} The variant details or null
 */
async function getFirstVariantForProduct(shopDomain, productId) {
  const shop = normalizeShopDomain(shopDomain);
  if (!shop) return null;

  // Get the session for this shop
  const session = await prisma.session.findFirst({
    where: { shop },
    select: { id: true },
  });

  if (!session) return null;

  // Get the product with its first available variant
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      variants: {
        orderBy: { position: "asc" },
        take: 1,
        where: { availableForSale: true },
      },
    },
  });

  if (!product) return null;

  // If no available variant, try to get any variant
  if (product.variants.length === 0) {
    const anyVariant = await prisma.productVariant.findFirst({
      where: { productId },
      orderBy: { position: "asc" },
    });
    return anyVariant ? { ...anyVariant, productTitle: product.title } : null;
  }

  return { ...product.variants[0], productTitle: product.title };
}

/**
 * Get product details from the local database
 * @param {string} productId - The product GID
 * @returns {Promise<Object|null>} The product details
 */
async function getProductDetails(productId) {
  return prisma.product.findUnique({
    where: { id: productId },
    include: {
      variants: {
        orderBy: { position: "asc" },
      },
    },
  });
}

/**
 * Add a product to cart using Storefront API
 * This is the main function called by the add_to_cart local tool
 * Supports shared cart functionality - if cartId is provided, adds to existing cart;
 * otherwise creates a new cart.
 *
 * @param {Object} params
 * @param {string} params.shopDomain - The shop domain
 * @param {string} params.productId - The product GID (from search results)
 * @param {string} [params.variantId] - Optional variant GID
 * @param {number} [params.quantity=1] - Quantity to add
 * @param {string} [params.cartId] - Optional existing cart GID (from browser's cart cookie)
 * @returns {Promise<Object>} Result with success/error, checkout URL, and cart ID
 */
export async function addToCart({ shopDomain, productId, variantId, quantity = 1, cartId = null }) {
  try {
    const shop = normalizeShopDomain(shopDomain);
    if (!shop) {
      return { error: "Invalid shop domain" };
    }

    // Get Storefront API access token from environment
    const storefrontAccessToken = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
    if (!storefrontAccessToken) {
      return { error: "Storefront API access token not configured. Please set SHOPIFY_STOREFRONT_ACCESS_TOKEN environment variable." };
    }

    // Get product details from local database
    const product = await getProductDetails(productId);
    if (!product) {
      return { error: `Product not found: ${productId}. Make sure to use the product_id from search results.` };
    }

    // Determine which variant to use
    let merchandiseId = variantId;
    let variantTitle = "";
    let variantPrice = "";

    if (!merchandiseId) {
      // Get the first available variant
      const variant = await getFirstVariantForProduct(shopDomain, productId);
      if (!variant) {
        return { error: `No available variants found for product: ${product.title}` };
      }
      merchandiseId = variant.id;
      variantTitle = variant.title;
      variantPrice = variant.price;
    } else {
      // Verify the variant exists and get its details
      const variant = product.variants.find(v => v.id === variantId);
      if (!variant) {
        return { error: `Variant not found: ${variantId}` };
      }
      variantTitle = variant.title;
      variantPrice = variant.price;
    }

    // Use addToCartOrCreate - branches based on whether cartId exists
    // If cartId is provided (from browser's cart cookie), adds to existing cart
    // If no cartId (null), creates a new cart
    const cartResult = await addToCartOrCreate({
      shopDomain: shop,
      storefrontAccessToken,
      cartId,
      variantId: merchandiseId,
      quantity,
    });

    if (!cartResult.success) {
      const errorMessage = cartResult.errors.map(e => e.message).join(", ");
      return { error: `Failed to add to cart: ${errorMessage}` };
    }

    // Calculate total price
    const totalPrice = variantPrice ?
      `$${(parseFloat(variantPrice) * quantity).toFixed(2)}` :
      "Price unavailable";

    // Build the response for Claude to synthesize
    // Include cart ID so the client can update the cart cookie if needed
    const response = {
      success: true,
      message: `Added ${quantity} x ${product.title}${variantTitle && variantTitle !== "Default Title" ? ` (${variantTitle})` : ""} to cart`,
      product: {
        title: product.title,
        variant: variantTitle !== "Default Title" ? variantTitle : null,
        quantity,
        unitPrice: variantPrice ? `$${variantPrice}` : null,
        totalPrice,
      },
      cart: {
        id: cartResult.cart.id,
        checkoutUrl: cartResult.cart.checkoutUrl,
        totalQuantity: cartResult.cart.totalQuantity,
      },
      // Flag to indicate if a new cart was created (for client-side cookie handling)
      cartCreated: !cartId,
    };

    return response;
  } catch (error) {
    console.error("Error adding to cart:", error);
    return {
      error: `Failed to add to cart: ${error.message}`
    };
  }
}

export default {
  // Local tool function (uses MCP)
  addToCart,
  // Storefront API functions (for direct API access)
  addToCartStorefront,
  createCartStorefront,
  addToCartOrCreate,
  generateStorefrontCartConfirmation,
  // Message formatting utilities
  formatCartConfirmationMessage,
  formatCartErrorMessage,
  createCartConfirmationPayload,
  createCartErrorPayload
};
