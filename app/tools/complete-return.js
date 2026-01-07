/**
 * Complete Return Tool
 *
 * Completes a previously initiated return request using the Shopify Admin GraphQL API.
 * This tool:
 * - Fetches return details to determine current status
 * - Approves the return request if pending
 * - Closes the return to finalize it
 * - Issues refunds as appropriate
 * - Returns confirmation details
 *
 * @module tools/complete-return
 */

const SHOPIFY_API_VERSION = "2024-10";

/**
 * GraphQL query to fetch return details
 */
const GET_RETURN_QUERY = `
  query getReturn($id: ID!) {
    return(id: $id) {
      id
      name
      status
      order {
        id
        name
        totalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
      }
      returnLineItems(first: 50) {
        edges {
          node {
            id
            quantity
            refundableQuantity
            refundedQuantity
            returnReason
            returnReasonNote
            fulfillmentLineItem {
              id
              lineItem {
                id
                name
                sku
                originalUnitPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
              }
            }
          }
        }
      }
      refunds {
        id
        createdAt
        totalRefundedSet {
          shopMoney {
            amount
            currencyCode
          }
        }
      }
      totalQuantity
      decline {
        reason
        note
      }
    }
  }
`;

/**
 * GraphQL mutation to approve a return request
 */
const RETURN_APPROVE_REQUEST_MUTATION = `
  mutation returnApproveRequest($input: ReturnApproveRequestInput!) {
    returnApproveRequest(input: $input) {
      return {
        id
        name
        status
      }
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * GraphQL mutation to close a return
 */
const RETURN_CLOSE_MUTATION = `
  mutation returnClose($id: ID!) {
    returnClose(id: $id) {
      return {
        id
        name
        status
      }
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * GraphQL mutation to create a refund
 * This creates a refund for return line items
 */
const REFUND_CREATE_MUTATION = `
  mutation refundCreate($input: RefundInput!) {
    refundCreate(input: $input) {
      refund {
        id
        createdAt
        note
        totalRefundedSet {
          shopMoney {
            amount
            currencyCode
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * Make a GraphQL request to Shopify Admin API
 *
 * @param {string} shopDomain - The shop domain (e.g., "example.myshopify.com")
 * @param {string} accessToken - The Admin API access token
 * @param {string} query - The GraphQL query or mutation
 * @param {Object} variables - Query variables
 * @returns {Promise<Object>} The GraphQL response data
 * @throws {Error} If the request fails
 */
async function makeGraphQLRequest(shopDomain, accessToken, query, variables = {}) {
  const url = `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP error ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  if (data.errors && data.errors.length > 0) {
    const errorMessages = data.errors.map((e) => e.message).join("; ");
    throw new Error(`GraphQL errors: ${errorMessages}`);
  }

  return data;
}

/**
 * Normalize a return ID to ensure it's in the correct GID format
 *
 * @param {string} returnId - The return ID (can be numeric or GID format)
 * @returns {string} The normalized GID format
 */
function normalizeReturnId(returnId) {
  if (!returnId) {
    throw new Error("Return ID is required");
  }

  // If it's already a GID, return as-is
  if (returnId.startsWith("gid://shopify/Return/")) {
    return returnId;
  }

  // If it's a numeric ID, convert to GID
  const numericId = returnId.replace(/\D/g, "");
  if (numericId) {
    return `gid://shopify/Return/${numericId}`;
  }

  throw new Error(`Invalid return ID format: ${returnId}`);
}

/**
 * Fetch return details from Shopify
 *
 * @param {string} shopDomain - The shop domain
 * @param {string} accessToken - The Admin API access token
 * @param {string} returnId - The return ID (GID format)
 * @returns {Promise<Object|null>} The return details or null if not found
 */
async function fetchReturnDetails(shopDomain, accessToken, returnId) {
  const response = await makeGraphQLRequest(shopDomain, accessToken, GET_RETURN_QUERY, {
    id: returnId,
  });

  return response.data?.return || null;
}

/**
 * Approve a return request
 *
 * @param {string} shopDomain - The shop domain
 * @param {string} accessToken - The Admin API access token
 * @param {string} returnId - The return ID (GID format)
 * @returns {Promise<Object>} The result of the approval
 */
async function approveReturn(shopDomain, accessToken, returnId) {
  const response = await makeGraphQLRequest(shopDomain, accessToken, RETURN_APPROVE_REQUEST_MUTATION, {
    input: {
      id: returnId,
    },
  });

  const result = response.data?.returnApproveRequest;

  if (result?.userErrors && result.userErrors.length > 0) {
    const errorMessages = result.userErrors.map((e) => `${e.field}: ${e.message}`).join("; ");
    throw new Error(`Failed to approve return: ${errorMessages}`);
  }

  return result?.return;
}

/**
 * Close a return
 *
 * @param {string} shopDomain - The shop domain
 * @param {string} accessToken - The Admin API access token
 * @param {string} returnId - The return ID (GID format)
 * @returns {Promise<Object>} The result of closing the return
 */
async function closeReturn(shopDomain, accessToken, returnId) {
  const response = await makeGraphQLRequest(shopDomain, accessToken, RETURN_CLOSE_MUTATION, {
    id: returnId,
  });

  const result = response.data?.returnClose;

  if (result?.userErrors && result.userErrors.length > 0) {
    const errorMessages = result.userErrors.map((e) => `${e.field}: ${e.message}`).join("; ");
    throw new Error(`Failed to close return: ${errorMessages}`);
  }

  return result?.return;
}

/**
 * Create a refund for a return
 *
 * @param {string} shopDomain - The shop domain
 * @param {string} accessToken - The Admin API access token
 * @param {string} orderId - The order ID (GID format)
 * @param {string} note - Refund note
 * @returns {Promise<Object>} The created refund
 */
async function createRefund(shopDomain, accessToken, orderId, note = "Refund for completed return") {
  const response = await makeGraphQLRequest(shopDomain, accessToken, REFUND_CREATE_MUTATION, {
    input: {
      orderId: orderId,
      note: note,
      notify: true,
    },
  });

  const result = response.data?.refundCreate;

  if (result?.userErrors && result.userErrors.length > 0) {
    const errorMessages = result.userErrors.map((e) => `${e.field}: ${e.message}`).join("; ");
    // Don't throw here - refund might not be needed or already processed
    console.warn(`Refund warning: ${errorMessages}`);
    return null;
  }

  return result?.refund;
}

/**
 * Complete a return request
 *
 * This function completes a previously initiated return by:
 * 1. Fetching the return details to check current status
 * 2. Approving the return if it's in REQUESTED status
 * 3. Closing the return to finalize it
 * 4. Attempting to issue a refund
 *
 * @param {Object} params - The parameters for completing the return
 * @param {string} params.shopDomain - The shop domain (e.g., "example.myshopify.com")
 * @param {string} params.accessToken - The Shopify Admin API access token
 * @param {string} params.returnId - The return ID (from initiate_return_custom)
 * @param {boolean} params.confirm - Explicit confirmation to proceed (MUST be true)
 * @returns {Promise<Object>} Result object with ok, return_id, refund_status, confirmation, or error
 */
export async function completeReturn({ shopDomain, accessToken, returnId, confirm }) {
  // Validate confirmation
  if (confirm !== true) {
    return {
      error: {
        type: "invalid_request",
        message: "Refusing to complete return: `confirm` must be explicitly set to true to finalize the return.",
      },
    };
  }

  // Validate required parameters
  if (!shopDomain) {
    return {
      error: {
        type: "invalid_request",
        message: "Shop domain is required",
      },
    };
  }

  if (!accessToken) {
    return {
      error: {
        type: "invalid_request",
        message: "Access token is required",
      },
    };
  }

  if (!returnId) {
    return {
      error: {
        type: "invalid_request",
        message: "Return ID is required",
      },
    };
  }

  try {
    // Normalize the return ID to GID format
    const normalizedReturnId = normalizeReturnId(returnId);

    // Fetch current return details
    const returnDetails = await fetchReturnDetails(shopDomain, accessToken, normalizedReturnId);

    if (!returnDetails) {
      return {
        error: {
          type: "not_found",
          message: `Return not found: ${returnId}`,
        },
      };
    }

    const currentStatus = returnDetails.status;
    let finalStatus = currentStatus;
    let refundStatus = "none";
    let refundDetails = null;
    const actions = [];

    // Process based on current status
    switch (currentStatus) {
      case "REQUESTED":
        // Approve the return first
        try {
          await approveReturn(shopDomain, accessToken, normalizedReturnId);
          actions.push("approved");
          finalStatus = "APPROVED";
        } catch (approveError) {
          return {
            error: {
              type: "approval_failed",
              message: approveError.message,
            },
          };
        }
        // Fall through to close
        // eslint-disable-next-line no-fallthrough
      case "APPROVED":
      case "IN_PROGRESS":
        // Close the return
        try {
          const closedReturn = await closeReturn(shopDomain, accessToken, normalizedReturnId);
          actions.push("closed");
          finalStatus = closedReturn?.status || "CLOSED";
        } catch (closeError) {
          // If close fails, still try to return what we have
          console.warn(`Close warning: ${closeError.message}`);
        }
        break;

      case "CLOSED":
        // Already closed, nothing more to do
        actions.push("already_closed");
        break;

      case "DECLINED":
        return {
          error: {
            type: "invalid_status",
            message: `Return was declined. Reason: ${returnDetails.decline?.reason || "Unknown"}. Note: ${returnDetails.decline?.note || "None"}`,
          },
        };

      case "CANCELED":
        return {
          error: {
            type: "invalid_status",
            message: "Return was canceled and cannot be completed",
          },
        };

      default:
        // Try to proceed anyway for unknown statuses
        actions.push(`unknown_status_${currentStatus}`);
    }

    // Check for existing refunds
    if (returnDetails.refunds && returnDetails.refunds.length > 0) {
      refundStatus = "already_refunded";
      refundDetails = returnDetails.refunds.map((r) => ({
        id: r.id,
        created_at: r.createdAt,
        amount: r.totalRefundedSet?.shopMoney?.amount,
        currency: r.totalRefundedSet?.shopMoney?.currencyCode,
      }));
    } else if (returnDetails.order?.id) {
      // Attempt to create a refund if none exists
      try {
        const refund = await createRefund(
          shopDomain,
          accessToken,
          returnDetails.order.id,
          `Refund for return ${returnDetails.name || returnId}`
        );

        if (refund) {
          refundStatus = "refund_created";
          refundDetails = {
            id: refund.id,
            created_at: refund.createdAt,
            amount: refund.totalRefundedSet?.shopMoney?.amount,
            currency: refund.totalRefundedSet?.shopMoney?.currencyCode,
          };
          actions.push("refund_created");
        } else {
          refundStatus = "refund_not_needed_or_manual";
        }
      } catch (refundError) {
        // Refund might require manual processing or additional info
        refundStatus = "refund_requires_manual_processing";
        console.warn(`Refund creation warning: ${refundError.message}`);
      }
    }

    // Build confirmation details
    const confirmation = {
      return_name: returnDetails.name,
      order_name: returnDetails.order?.name,
      order_id: returnDetails.order?.id,
      total_quantity: returnDetails.totalQuantity,
      items: returnDetails.returnLineItems?.edges?.map((edge) => ({
        id: edge.node.id,
        quantity: edge.node.quantity,
        reason: edge.node.returnReason,
        reason_note: edge.node.returnReasonNote,
        item_name: edge.node.fulfillmentLineItem?.lineItem?.name,
        sku: edge.node.fulfillmentLineItem?.lineItem?.sku,
      })) || [],
      actions_taken: actions,
      completed_at: new Date().toISOString(),
    };

    return {
      ok: true,
      return_id: normalizedReturnId,
      final_status: finalStatus,
      refund_status: refundStatus,
      refund_details: refundDetails,
      confirmation: confirmation,
    };
  } catch (error) {
    console.error("Error completing return:", error);
    return {
      error: {
        type: "internal_error",
        message: error.message || "An unexpected error occurred while completing the return",
      },
    };
  }
}

export default completeReturn;
