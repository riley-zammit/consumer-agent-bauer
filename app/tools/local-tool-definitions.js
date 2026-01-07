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

/**
 * Standard-format local tool definitions.
 * @type {Array<{name: string, description: string, input_schema: any}>}
 */
export const localTools = [
  {
    name: "search_products_custom",
    description: `Search for products in the store's catalog using semantic search powered by a local vector index.

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
    name: "initiate_return_custom",
    description: `Start a return request for items from a customer's order. This is the FIRST step in the two-step return process.

WHEN TO USE:
- Customer explicitly says they want to return an item or order
- Customer is unhappy with a product and wants to send it back
- Customer received wrong/damaged items and needs to return them
- Customer asks "how do I return this?" after you've confirmed they want to proceed

WHEN NOT TO USE:
- Customer is just asking about return POLICY - answer from knowledge base instead
- Customer hasn't decided if they want to return yet - ask clarifying questions first
- You don't have the order_id yet - first use get_order_status to find the order
- Return was already initiated - use complete_return_custom to finalize it

WORKFLOW:
1. Get the order details first (use order status tools to find the order_id)
2. Call initiate_return_custom with the order_id and reason
3. Response includes a return_id and next steps
4. Customer must confirm before you call complete_return_custom

OUTPUT: Returns return_id, eligible items, return instructions, and estimated refund amount. The return is NOT finalized until complete_return_custom is called.

IMPORTANT: Always confirm with the customer which specific items they want to return and why before calling this tool.`,
    input_schema: {
      type: "object",
      properties: {
        order_id: {
          type: "string",
          description: "The Shopify order ID. Can be a GID (gid://shopify/Order/123456) or order number (#1001). Get this from order status tools first.",
        },
        reason: {
          type: "string",
          description: "Customer's reason for return. Be specific: 'Size too small', 'Wrong color received', 'Item damaged on arrival', 'Changed mind', etc.",
        },
        items: {
          type: "array",
          description: "Specific line items to return. If omitted, return applies to entire order. Include this when customer only wants to return some items.",
          items: {
            type: "object",
            properties: {
              line_item_id: {
                type: "string",
                description: "The line item ID from the order",
              },
              quantity: {
                type: "number",
                description: "How many of this item to return (must be <= ordered quantity)",
              },
            },
            required: ["line_item_id", "quantity"],
          },
        },
      },
      required: ["order_id"],
    },
  },
  {
    name: "complete_return_custom",
    description: `Finalize a return request that was previously initiated. This is the SECOND and FINAL step in the return process.

WHEN TO USE:
- You have already called initiate_return_custom and received a return_id
- Customer has explicitly confirmed they want to proceed with the return
- You have communicated the return details and customer agrees

WHEN NOT TO USE:
- No return has been initiated yet - call initiate_return_custom first
- Customer hasn't confirmed - ask for explicit confirmation before finalizing
- Customer wants to cancel the return - do NOT call this, inform them the return was not processed
- You're unsure if customer wants to proceed - ask for clarification

WORKFLOW:
1. After initiate_return_custom, explain the return details to customer
2. Ask customer to confirm: "Should I finalize this return?"
3. Only call complete_return_custom after customer says yes/confirms
4. Provide the confirmation details to customer

OUTPUT: Returns confirmation number, refund details (amount and method), return shipping instructions (if applicable), and expected timeline for refund processing.

CRITICAL: The confirm parameter MUST be true. This is a safeguard - never set confirm=true unless the customer has explicitly agreed to finalize the return.`,
    input_schema: {
      type: "object",
      properties: {
        return_id: {
          type: "string",
          description: "The return_id received from initiate_return_custom. This links to the pending return request.",
        },
        confirm: {
          type: "boolean",
          description: "Must be true to finalize. This is a safety check - only set to true after customer explicitly confirms they want to complete the return.",
        },
      },
      required: ["return_id", "confirm"],
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
      case "search_products_custom": {
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


