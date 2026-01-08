/**
 * Cart Confirmed API Route
 * Handles cart confirmation notifications and triggers Claude responses
 * Called after successful client-side add-to-cart operations
 */
import { saveMessage } from "../db.server";
import {
  formatCartConfirmationMessage,
  formatCartErrorMessage
} from "../services/cart.server";

/**
 * Handle OPTIONS requests (CORS preflight)
 */
export async function loader({ request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(request)
    });
  }

  // This endpoint only accepts POST requests
  return new Response(
    JSON.stringify({ error: "Method not allowed. Use POST." }),
    {
      status: 405,
      headers: getCorsHeaders(request)
    }
  );
}

/**
 * Handle POST requests for cart confirmations
 */
export async function action({ request }) {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(request)
    });
  }

  try {
    const body = await request.json();
    const {
      conversation_id: conversationId,
      product_title: productTitle,
      quantity = 1,
      success = true,
      error = null
    } = body;

    // Validate required fields
    if (!conversationId) {
      return new Response(
        JSON.stringify({ error: "conversation_id is required" }),
        { status: 400, headers: getCorsHeaders(request) }
      );
    }

    if (!productTitle) {
      return new Response(
        JSON.stringify({ error: "product_title is required" }),
        { status: 400, headers: getCorsHeaders(request) }
      );
    }

    // Generate the appropriate message
    let confirmationMessage;
    if (success) {
      confirmationMessage = formatCartConfirmationMessage(productTitle, quantity);
    } else {
      confirmationMessage = formatCartErrorMessage(productTitle, error || "Unknown error");
    }

    // Save the confirmation as an assistant message in the conversation
    await saveMessage(
      conversationId,
      'assistant',
      JSON.stringify([{ type: 'text', text: confirmationMessage }])
    );

    // Return the confirmation message so the client can display it
    return new Response(
      JSON.stringify({
        success: true,
        message: confirmationMessage,
        conversation_id: conversationId
      }),
      {
        status: 200,
        headers: {
          ...getCorsHeaders(request),
          "Content-Type": "application/json"
        }
      }
    );

  } catch (error) {
    console.error('Error in cart-confirmed handler:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: getCorsHeaders(request)
      }
    );
  }
}

/**
 * Gets CORS headers for the response
 * @param {Request} request - The request object
 * @returns {Object} CORS headers object
 */
function getCorsHeaders(request) {
  const origin = request.headers.get("Origin") || "*";
  const requestHeaders = request.headers.get("Access-Control-Request-Headers") || "Content-Type, Accept";

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": requestHeaders,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json"
  };
}
