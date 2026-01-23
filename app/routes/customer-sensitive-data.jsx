import {
  getCustomerToken,
  getCustomerAccountUrls,
  storeCustomerAccountUrls,
  storeCustomerSensitiveData
} from "../db.server";

const DEFAULT_MOCK_DATA = {
  type: "mock_sensitive",
  note: "Sensitive data placeholder",
};

export async function action({ request }) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const conversationId = body?.conversation_id;
  if (!conversationId) {
    return new Response(JSON.stringify({ error: "conversation_id is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const token = await getCustomerToken(conversationId);
  if (!token?.accessToken) {
    return new Response(JSON.stringify({ error: "Customer token missing or expired" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  const mcpApiUrl = await resolveCustomerMcpUrl(request, conversationId);
  if (!mcpApiUrl) {
    return new Response(JSON.stringify({ error: "Customer MCP URL unavailable" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  const tokenValid = await validateCustomerToken(mcpApiUrl, token.accessToken);
  if (!tokenValid) {
    return new Response(JSON.stringify({ error: "Customer token invalid" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  const payload = body?.data ?? DEFAULT_MOCK_DATA;
  const record = await storeCustomerSensitiveData(
    conversationId,
    JSON.stringify({ payload, savedAt: new Date().toISOString() })
  );

  return new Response(JSON.stringify({ success: true, id: record.id }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

async function resolveCustomerMcpUrl(request, conversationId) {
  const existing = await getCustomerAccountUrls(conversationId);
  if (existing?.mcpApiUrl) return existing.mcpApiUrl;

  const origin = request.headers.get("Origin");
  if (!origin) return null;

  const { hostname } = new URL(origin);
  const [mcpResponse, openidResponse] = await Promise.all([
    fetch(`https://${hostname}/.well-known/customer-account-api`).then(res => res.json()),
    fetch(`https://${hostname}/.well-known/openid-configuration`).then(res => res.json()),
  ]);

  await storeCustomerAccountUrls({
    conversationId,
    mcpApiUrl: mcpResponse.mcp_api,
    authorizationUrl: openidResponse.authorization_endpoint,
    tokenUrl: openidResponse.token_endpoint,
  });

  return mcpResponse.mcp_api;
}

async function validateCustomerToken(mcpApiUrl, accessToken) {
  try {
    const response = await fetch(mcpApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": accessToken
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/list",
        id: 1,
        params: {}
      })
    });

    return response.ok;
  } catch {
    return false;
  }
}
