/**
 * API Route: /api/cart-add
 *
 * Server-side add-to-cart endpoint using Shopify Storefront API.
 * This endpoint handles adding items to cart and returns a confirmation message.
 */
import {
  addToCartOrCreate,
  generateStorefrontCartConfirmation,
  formatCartErrorMessage,
} from "../services/cart.server";
import prisma from "../db.server";

/**
 * Get CORS headers for the response
 * @param {Request} request - The request object
 * @returns {Object} CORS headers
 */
function getCorsHeaders(request) {
  const origin = request.headers.get("Origin") || "*";
  const requestHeaders = request.headers.get("Access-Control-Request-Headers") || "Content-Type, Accept";

  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": requestHeaders,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  };
}

/**
 * Normalize shop domain from URL to hostname format
 * @param {string} shopOrUrl - Shop domain or full URL
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
 * Get Storefront API access token for a shop
 * First checks if the shop has a storefront access token stored,
 * otherwise falls back to admin access token (which won't work for Storefront API)
 *
 * @param {string} shopDomain - The shop domain
 * @returns {Promise<{storefrontAccessToken: string|null, shop: string|null}>}
 */
async function getStorefrontAccessToken(shopDomain) {
  const shop = normalizeShopDomain(shopDomain);
  if (!shop) return { storefrontAccessToken: null, shop: null };

  // Try to get the session with storefront access token
  const session = await prisma.session.findFirst({
    where: { shop },
    select: {
      shop: true,
      accessToken: true,
      // If you have a separate storefrontAccessToken field, select it here
      // storefrontAccessToken: true,
    },
  });

  if (!session) {
    return { storefrontAccessToken: null, shop: null };
  }

  // For Storefront API, you need a Storefront Access Token (public token)
  // This is typically configured in Shopify Admin > Apps > Develop Apps > Your App > API credentials
  // If stored separately, use: session.storefrontAccessToken

  // For now, check environment variable for development/testing
  // In production, this should be retrieved from the app's configuration or database
  const storefrontToken = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN || null;

  return {
    storefrontAccessToken: storefrontToken,
    shop: session.shop,
  };
}

/**
 * Handle OPTIONS requests for CORS preflight
 */
export async function loader({ request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(request),
    });
  }

  // Only POST is supported for this endpoint
  return new Response(
    JSON.stringify({ error: "Method not allowed. Use POST." }),
    {
      status: 405,
      headers: getCorsHeaders(request),
    }
  );
}

/**
 * Handle POST requests to add items to cart
 */
export async function action({ request }) {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(request),
    });
  }

  try {
    const body = await request.json();

    // Extract required fields from request body
    const {
      variantId,
      productTitle,
      quantity = 1,
      cartId = null,
    } = body;

    // Get shop domain from request headers
    const shopDomain = request.headers.get("Origin");

    // Validate required fields
    if (!variantId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "variantId is required",
        }),
        {
          status: 400,
          headers: getCorsHeaders(request),
        }
      );
    }

    if (!shopDomain) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Could not determine shop domain",
        }),
        {
          status: 400,
          headers: getCorsHeaders(request),
        }
      );
    }

    // Get Storefront API access token
    const { storefrontAccessToken, shop } = await getStorefrontAccessToken(shopDomain);

    if (!storefrontAccessToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Storefront API access token not configured. Please set SHOPIFY_STOREFRONT_ACCESS_TOKEN environment variable.",
        }),
        {
          status: 500,
          headers: getCorsHeaders(request),
        }
      );
    }

    // Call the Storefront API to add to cart
    const result = await addToCartOrCreate({
      shopDomain: shop || normalizeShopDomain(shopDomain),
      storefrontAccessToken,
      cartId,
      variantId,
      quantity,
    });

    if (!result.success) {
      const errorMessage = result.errors.map(e => e.message).join(", ");
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
          message: formatCartErrorMessage(productTitle || "item", errorMessage),
        }),
        {
          status: 400,
          headers: getCorsHeaders(request),
        }
      );
    }

    // Append storefront access token to checkout URL for sales attribution
    const checkoutUrlWithAttribution = result.cart.checkoutUrl 
      ? `${result.cart.checkoutUrl}${result.cart.checkoutUrl.includes('?') ? '&' : '?'}access_token=${storefrontAccessToken}`
      : null;

    // Create cart object with attributed checkout URL for confirmation message
    const cartWithAttribution = {
      ...result.cart,
      checkoutUrl: checkoutUrlWithAttribution,
    };

    // Generate confirmation message with attributed checkout URL
    const confirmationMessage = generateStorefrontCartConfirmation({
      productTitle: productTitle || "item",
      quantity,
      cart: cartWithAttribution,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: confirmationMessage,
        cart: {
          id: result.cart.id,
          totalQuantity: result.cart.totalQuantity,
          checkoutUrl: checkoutUrlWithAttribution,
          totalAmount: result.cart.cost?.totalAmount,
        },
      }),
      {
        status: 200,
        headers: getCorsHeaders(request),
      }
    );
  } catch (error) {
    console.error("Error in cart-add API:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to add item to cart",
      }),
      {
        status: 500,
        headers: getCorsHeaders(request),
      }
    );
  }
}
