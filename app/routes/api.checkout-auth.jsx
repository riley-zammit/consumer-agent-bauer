/**
 * API Route: /api/checkout-auth
 *
 * Server-side endpoint to generate JWT tokens for Shopify Checkout Kit inline authentication.
 * This endpoint securely generates tokens using client_id and client_secret without exposing
 * them to the client.
 */
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
 * Generate a JWT token for Checkout Kit authentication
 * @returns {Promise<string>} The JWT token
 */
async function generateCheckoutToken() {
    let clientId, clientSecret;
    try{
        clientId = process.env.CATALOG_CLIENT;
        clientSecret = process.env.CATALOG_SECRET;
    }catch(e){
        console.error("Error generating checkout token:", e);
    }
  
    

  if (!clientId || !clientSecret) {
    throw new Error("SHOPIFY_API_KEY and SHOPIFY_API_SECRET environment variables are required");
  }

  const response = await fetch("https://api.shopify.com/auth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token generation failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  console.log("Generated token for inline checkout: ", data)
  return data.access_token;
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
 * Handle POST requests to generate checkout authentication token
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
    // Generate the JWT token
    const token = await generateCheckoutToken();

    // Return the token as plain text (as expected by Checkout Kit)
    return new Response(token, {
      status: 200,
      headers: {
        ...getCorsHeaders(request),
        "Content-Type": "text/plain",
      },
    });
  } catch (error) {
    console.error("Error generating checkout token:", error);

    return new Response(
      JSON.stringify({
        error: error.message || "Failed to generate checkout token",
      }),
      {
        status: 500,
        headers: getCorsHeaders(request),
      }
    );
  }
}
