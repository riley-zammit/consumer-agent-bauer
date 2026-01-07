/**
 * Initiate Return Tool
 *
 * Creates a return request for a customer order using the Shopify Admin GraphQL API.
 * Validates order existence and return eligibility before creating the return.
 */

const API_VERSION = '2024-10';

/**
 * GraphQL query to fetch order details and check return eligibility
 */
const GET_ORDER_QUERY = `
  query getOrder($id: ID!) {
    order(id: $id) {
      id
      name
      displayFinancialStatus
      displayFulfillmentStatus
      returnStatus
      returnable
      createdAt
      lineItems(first: 50) {
        edges {
          node {
            id
            name
            quantity
            nonFulfillableQuantity
            fulfillableQuantity
            currentQuantity
          }
        }
      }
      fulfillments(first: 10) {
        id
        status
        fulfillmentLineItems(first: 50) {
          edges {
            node {
              id
              lineItem {
                id
                name
              }
              quantity
              remainingQuantity
            }
          }
        }
      }
    }
  }
`;

/**
 * GraphQL query to look up order by order number (e.g., "#1001")
 */
const FIND_ORDER_BY_NUMBER_QUERY = `
  query findOrderByNumber($query: String!) {
    orders(first: 1, query: $query) {
      edges {
        node {
          id
          name
        }
      }
    }
  }
`;

/**
 * GraphQL mutation to create a return
 */
const RETURN_CREATE_MUTATION = `
  mutation returnCreate($returnInput: ReturnInput!) {
    returnCreate(returnInput: $returnInput) {
      return {
        id
        status
        name
      }
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * Makes a GraphQL request to the Shopify Admin API
 *
 * @param {string} shopDomain - The shop domain (e.g., "example.myshopify.com")
 * @param {string} accessToken - The Shopify Admin API access token
 * @param {string} query - The GraphQL query or mutation
 * @param {Object} variables - The GraphQL variables
 * @returns {Promise<Object>} The GraphQL response data
 */
async function makeGraphQLRequest(shopDomain, accessToken, query, variables = {}) {
  const url = `https://${shopDomain}/admin/api/${API_VERSION}/graphql.json`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP error ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  if (data.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
  }

  return data;
}

/**
 * Normalizes an order ID to a Shopify GID format
 * Handles various input formats:
 * - Full GID: "gid://shopify/Order/12345"
 * - Numeric ID: "12345" or 12345
 * - Order number: "#1001" or "1001"
 *
 * @param {string|number} orderId - The order identifier
 * @param {string} shopDomain - The shop domain for order number lookup
 * @param {string} accessToken - The access token for API calls
 * @returns {Promise<string>} The normalized Shopify GID
 */
async function normalizeOrderId(orderId, shopDomain, accessToken) {
  const orderIdStr = String(orderId).trim();

  // Already a full GID
  if (orderIdStr.startsWith('gid://shopify/Order/')) {
    return orderIdStr;
  }

  // Remove leading # if present
  const cleanId = orderIdStr.replace(/^#/, '');

  // Check if it's a numeric ID (legacy resource ID)
  if (/^\d+$/.test(cleanId)) {
    // Try as a GID first (numeric part of GID)
    const gid = `gid://shopify/Order/${cleanId}`;

    // Verify the order exists
    const response = await makeGraphQLRequest(shopDomain, accessToken, GET_ORDER_QUERY, { id: gid });

    if (response.data?.order) {
      return gid;
    }

    // If not found, try searching by order number
    const searchResponse = await makeGraphQLRequest(
      shopDomain,
      accessToken,
      FIND_ORDER_BY_NUMBER_QUERY,
      { query: `name:#${cleanId}` }
    );

    const foundOrder = searchResponse.data?.orders?.edges?.[0]?.node;
    if (foundOrder) {
      return foundOrder.id;
    }

    throw new Error(`Order not found: ${orderId}`);
  }

  throw new Error(`Invalid order ID format: ${orderId}`);
}

/**
 * Validates that an order is eligible for returns
 *
 * @param {Object} order - The order object from GraphQL
 * @returns {Object} Validation result with { valid: boolean, reason?: string }
 */
function validateReturnEligibility(order) {
  if (!order) {
    return { valid: false, reason: 'Order not found' };
  }

  if (!order.returnable) {
    return { valid: false, reason: 'Order is not marked as returnable' };
  }

  if (order.displayFulfillmentStatus === 'UNFULFILLED') {
    return { valid: false, reason: 'Order has not been fulfilled yet - nothing to return' };
  }

  if (order.returnStatus === 'REQUESTED') {
    return { valid: false, reason: 'A return has already been requested for this order' };
  }

  if (order.returnStatus === 'IN_PROGRESS') {
    return { valid: false, reason: 'A return is already in progress for this order' };
  }

  // Check if there are any fulfillments with returnable items
  const fulfillments = order.fulfillments || [];
  const hasFulfilledItems = fulfillments.some(f =>
    f.status === 'SUCCESS' &&
    f.fulfillmentLineItems?.edges?.some(edge => edge.node.remainingQuantity > 0)
  );

  if (!hasFulfilledItems) {
    return { valid: false, reason: 'No fulfilled items available to return' };
  }

  return { valid: true };
}

/**
 * Builds return line items from the request and order data
 *
 * @param {Object} order - The order object from GraphQL
 * @param {Array} requestedItems - Optional array of { line_item_id, quantity }
 * @returns {Array} Array of return line item inputs for the mutation
 */
function buildReturnLineItems(order, requestedItems) {
  const returnLineItems = [];

  // Get all fulfilled line items with remaining quantity
  const fulfillments = order.fulfillments || [];
  const fulfillmentLineItems = [];

  for (const fulfillment of fulfillments) {
    if (fulfillment.status !== 'SUCCESS') continue;

    for (const edge of fulfillment.fulfillmentLineItems?.edges || []) {
      const item = edge.node;
      if (item.remainingQuantity > 0) {
        fulfillmentLineItems.push({
          fulfillmentLineItemId: item.id,
          lineItemId: item.lineItem.id,
          name: item.lineItem.name,
          quantity: item.quantity,
          remainingQuantity: item.remainingQuantity,
        });
      }
    }
  }

  if (requestedItems && requestedItems.length > 0) {
    // Map requested items to fulfillment line items
    for (const requested of requestedItems) {
      const lineItemId = requested.line_item_id;
      const requestedQty = requested.quantity || 1;

      // Find matching fulfillment line item
      const match = fulfillmentLineItems.find(fli =>
        fli.lineItemId === lineItemId ||
        fli.lineItemId.endsWith(`/${lineItemId}`) ||
        lineItemId.endsWith(`/${fli.lineItemId.split('/').pop()}`)
      );

      if (match) {
        const quantityToReturn = Math.min(requestedQty, match.remainingQuantity);
        if (quantityToReturn > 0) {
          returnLineItems.push({
            fulfillmentLineItemId: match.fulfillmentLineItemId,
            quantity: quantityToReturn,
            returnReason: 'UNKNOWN', // Default reason
          });
        }
      }
    }
  } else {
    // Return all available items
    for (const item of fulfillmentLineItems) {
      returnLineItems.push({
        fulfillmentLineItemId: item.fulfillmentLineItemId,
        quantity: item.remainingQuantity,
        returnReason: 'UNKNOWN',
      });
    }
  }

  return returnLineItems;
}

/**
 * Maps a reason string to a Shopify return reason enum
 *
 * @param {string} reason - The reason string from the user
 * @returns {string} The Shopify return reason enum value
 */
function mapReturnReason(reason) {
  if (!reason) return 'UNKNOWN';

  const reasonLower = reason.toLowerCase();

  if (reasonLower.includes('wrong') || reasonLower.includes('incorrect')) {
    return 'WRONG_ITEM';
  }
  if (reasonLower.includes('defect') || reasonLower.includes('broken') || reasonLower.includes('damage')) {
    return 'DEFECTIVE';
  }
  if (reasonLower.includes('size') || reasonLower.includes('fit')) {
    return 'SIZE_TOO_SMALL'; // or SIZE_TOO_LARGE - would need more context
  }
  if (reasonLower.includes('color') || reasonLower.includes('style')) {
    return 'STYLE';
  }
  if (reasonLower.includes('change') || reasonLower.includes('mind')) {
    return 'OTHER';
  }
  if (reasonLower.includes('not as') || reasonLower.includes('different')) {
    return 'NOT_AS_DESCRIBED';
  }

  return 'OTHER';
}

/**
 * Initiates a return request for a customer order
 *
 * @param {Object} params - The parameters for the return
 * @param {string} params.shopDomain - The shop domain (e.g., "example.myshopify.com")
 * @param {string} params.accessToken - The Shopify Admin API access token
 * @param {string} params.orderId - The order ID (GID, numeric ID, or order number)
 * @param {string} [params.reason] - Optional reason for the return
 * @param {Array} [params.items] - Optional array of { line_item_id, quantity } to return
 * @returns {Promise<Object>} Result with { ok, return_id, status, next_steps } or { error }
 */
export async function initiateReturn({ shopDomain, accessToken, orderId, reason, items }) {
  try {
    // Validate required parameters
    if (!shopDomain) {
      return { error: 'Missing required parameter: shopDomain' };
    }
    if (!accessToken) {
      return { error: 'Missing required parameter: accessToken' };
    }
    if (!orderId) {
      return { error: 'Missing required parameter: orderId' };
    }

    // Normalize the order ID
    let normalizedOrderId;
    try {
      normalizedOrderId = await normalizeOrderId(orderId, shopDomain, accessToken);
    } catch (err) {
      return { error: `Failed to find order: ${err.message}` };
    }

    // Fetch the order details
    const orderResponse = await makeGraphQLRequest(
      shopDomain,
      accessToken,
      GET_ORDER_QUERY,
      { id: normalizedOrderId }
    );

    const order = orderResponse.data?.order;

    // Validate return eligibility
    const eligibility = validateReturnEligibility(order);
    if (!eligibility.valid) {
      return {
        error: eligibility.reason,
        order_id: normalizedOrderId,
        order_name: order?.name,
      };
    }

    // Build return line items
    const returnLineItems = buildReturnLineItems(order, items);

    if (returnLineItems.length === 0) {
      return {
        error: 'No items available to return. All items may have already been returned.',
        order_id: normalizedOrderId,
        order_name: order?.name,
      };
    }

    // Apply the reason to all return line items
    const returnReason = mapReturnReason(reason);
    for (const item of returnLineItems) {
      item.returnReason = returnReason;
      if (reason) {
        item.customerNote = reason;
      }
    }

    // Create the return
    const returnInput = {
      orderId: normalizedOrderId,
      returnLineItems: returnLineItems,
      notifyCustomer: true,
    };

    const createResponse = await makeGraphQLRequest(
      shopDomain,
      accessToken,
      RETURN_CREATE_MUTATION,
      { returnInput }
    );

    const returnResult = createResponse.data?.returnCreate;

    // Check for user errors
    if (returnResult?.userErrors?.length > 0) {
      const errorMessages = returnResult.userErrors.map(e => e.message).join('; ');
      return {
        error: `Failed to create return: ${errorMessages}`,
        order_id: normalizedOrderId,
        order_name: order?.name,
      };
    }

    // Success
    const createdReturn = returnResult?.return;

    return {
      ok: true,
      return_id: createdReturn?.id,
      return_name: createdReturn?.name,
      status: createdReturn?.status || 'REQUESTED',
      order_id: normalizedOrderId,
      order_name: order?.name,
      items_count: returnLineItems.length,
      next_steps: [
        'Your return request has been submitted successfully.',
        'You will receive an email with return shipping instructions.',
        'Once the items are received and inspected, your refund will be processed.',
        `Return reference: ${createdReturn?.name || createdReturn?.id}`,
      ],
    };

  } catch (err) {
    console.error('Error in initiateReturn:', err);
    return {
      error: `An error occurred while processing the return: ${err.message}`
    };
  }
}

export default initiateReturn;
