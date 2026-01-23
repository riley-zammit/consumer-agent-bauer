import { generateAuthUrl } from "./auth.server";
import { getCustomerToken } from "./db.server";
import { localTools } from "./tools/local-tool-definitions";
import { executeLocalTool } from "./tools/local-tool-executor";
import AppConfig from "./services/config.server";

/**
 * Client for interacting with Model Context Protocol (MCP) API endpoints.
 * Manages connections to both customer and storefront MCP endpoints, and handles tool invocation.
 */
class MCPClient {
    /**
     * Creates a new MCPClient instance.
     *
     * @param {string} hostUrl - The base URL for the shop
     * @param {string} conversationId - ID for the current conversation
     * @param {string} shopId - ID of the Shopify shop
     * @param {string} customerMcpEndpoint - Optional customer MCP endpoint
     * @param {Object} options - Additional options
     * @param {string} [options.cartId] - Optional existing cart ID for shared cart functionality
     */
    constructor(hostUrl, conversationId, shopId, customerMcpEndpoint, options = {}) {
        this.tools = [];
        this.customerTools = [];
        this.storefrontTools = [];
        this.localTools = [];
        this.hostUrl = hostUrl;
        // TODO: Make this dynamic, for that first we need to allow access of mcp tools on password proteted demo stores.
        this.storefrontMcpEndpoint = `${hostUrl}/api/mcp`;

        const accountHostUrl = hostUrl.replace(/(\.myshopify\.com)$/, '.account$1');
        this.customerMcpEndpoint = customerMcpEndpoint || `${accountHostUrl}/customer/api/mcp`;
        this.customerAccessToken = "";
        this.conversationId = conversationId;
        this.shopId = shopId;
        // Cart ID for shared cart functionality (passed from browser's cart cookie)
        this.cartId = options.cartId || null;
    }

    /**
     * Connects to the customer MCP server and retrieves available tools.
     * Attempts to use an existing token or will proceed without authentication.
     *
     * @returns {Promise<Array>} Array of available customer tools
     * @throws {Error} If connection to MCP server fails
     */
    async connectToCustomerServer() {
        if (!AppConfig.mcp.enableCustomerMcp) {
            console.log("Customer MCP disabled in config");
            return [];
        }

        try {
            console.log("=== CONNECT TO CUSTOMER SERVER DEBUG ===");
            console.log(`Connecting to MCP server at ${this.customerMcpEndpoint}`);
            console.log("Conversation ID:", this.conversationId);
            console.log("Shop ID:", this.shopId);
            console.log("Host URL:", this.hostUrl);

            if (this.conversationId) {
                console.log("Looking up token for conversation:", this.conversationId);
                const dbToken = await getCustomerToken(this.conversationId);
                
                console.log("Token lookup result:", {
                    found: Boolean(dbToken),
                    tokenId: dbToken?.id || "N/A",
                    conversationIdInDb: dbToken?.conversationId || "N/A",
                    hasAccessToken: Boolean(dbToken?.accessToken),
                    tokenLength: dbToken?.accessToken?.length || 0,
                    expiresAt: dbToken?.expiresAt || "N/A",
                    isExpired: dbToken?.expiresAt ? new Date(dbToken.expiresAt) < new Date() : "N/A"
                });

                if (dbToken && dbToken.accessToken) {
                    this.customerAccessToken = dbToken.accessToken;
                    console.log("Token set from database, preview:", 
                        dbToken.accessToken.substring(0, 20) + "..." + dbToken.accessToken.substring(dbToken.accessToken.length - 10));
                } else {
                    console.log("No token in database for conversation:", this.conversationId);
                }
            } else {
                console.log("No conversation ID provided, cannot look up token");
            }

            // If we still don't have a token, we'll connect without one
            // and tools that require auth will prompt for it later
            const headers = {
                "Content-Type": "application/json",
                "Authorization": this.customerAccessToken || ""
            };
            
            console.log("Connecting with token:", this.customerAccessToken ? "YES" : "NO");

            const response = await this._makeJsonRpcRequest(
                this.customerMcpEndpoint,
                "tools/list",
                {},
                headers
            );

            // Extract tools from the JSON-RPC response format
            const toolsData = response.result && response.result.tools ? response.result.tools : [];
            const customerTools = this._formatToolsData(toolsData);

            this.customerTools = customerTools;
            this.tools = [...this.tools, ...customerTools];
            
            console.log("Customer tools loaded:", customerTools.map(t => t.name));
            console.log("=== END CONNECT TO CUSTOMER SERVER DEBUG ===");

            return customerTools;
        } catch (e) {
            console.error("Failed to connect to MCP server: ", e);
            throw e;
        }
    }

    /**
     * Connects to the storefront MCP server and retrieves available tools.
     *
     * @returns {Promise<Array>} Array of available storefront tools
     * @throws {Error} If connection to MCP server fails
     */
    async connectToStorefrontServer() {
        if (!AppConfig.mcp.enableStorefrontMcp) {
            console.log("Storefront MCP disabled in config");
            return [];
        }

        try {
            console.log(`Connecting to MCP server at ${this.storefrontMcpEndpoint}`);

            const headers = {
                "Content-Type": "application/json"
            };

            const response = await this._makeJsonRpcRequest(
                this.storefrontMcpEndpoint,
                "tools/list",
                {},
                headers
            );

            // Extract tools from the JSON-RPC response format
            const toolsData = response.result && response.result.tools ? response.result.tools : [];
            const storefrontTools = this._formatToolsData(toolsData);

            this.storefrontTools = storefrontTools;
            this.tools = [...this.tools, ...storefrontTools];

            return storefrontTools;
        } catch (e) {
            console.error("Failed to connect to MCP server: ", e);
            throw e;
        }
    }

    /**
     * Dispatches a tool call to the appropriate MCP server based on the tool name.
     *
     * @param {string} toolName - Name of the tool to call
     * @param {Object} toolArgs - Arguments to pass to the tool
     * @returns {Promise<Object>} Result from the tool call
     * @throws {Error} If tool is not found or call fails
     */
    async callTool(toolName, toolArgs) {
        try {
            if (this.localTools.some(tool => tool.name === toolName)) {
                return await this.callLocalTool(toolName, toolArgs);
            }
            if (this.customerTools.some(tool => tool.name === toolName)) {
                return await this.callCustomerTool(toolName, toolArgs);
            }
            if (this.storefrontTools.some(tool => tool.name === toolName)) {
                return await this.callStorefrontTool(toolName, toolArgs);
            }

            return {
                error: {
                    type: "tool_not_found",
                    data: `Tool ${toolName} not found`,
                },
            };
        } catch (error) {
            console.error(`Error calling tool ${toolName}:`, error);
            return {
                error: {
                    type: "internal_error",
                    data: `Error calling tool ${toolName}: ${error.message}`
                }
            };
        }
    }


    /**
     * Defines a set of local tools provided by the app, not an MCP
     */
    connectToLocalTools() {
        if (!AppConfig.mcp.enableLocalTools) {
            console.log("Local tools disabled in config");
            return [];
        }

        const formattedLocalTools = this._formatToolsData(localTools);
        this.localTools = formattedLocalTools;
        this.tools = [...this.tools, ...formattedLocalTools];
        return formattedLocalTools;
    }

    /**
     * Normalize cart ID to the correct Storefront API format
     * Ensures cart ID is in format: gid://shopify/Cart/{id}
     *
     * @param {string} cartId - The cart ID (may be in various formats)
     * @returns {string|null} Normalized cart GID
     */
    _normalizeCartId(cartId) {
        if (!cartId) return null;
        
        // Strip Shopify cart cookie key suffix (token?key=...) if present
        let normalizedId = cartId;
        if (typeof normalizedId === 'string' && normalizedId.includes('%')) {
            try {
                normalizedId = decodeURIComponent(normalizedId);
            } catch {
                // ignore decode errors
            }
        }
        if (typeof normalizedId === 'string' && normalizedId.includes('?key=')) {
            normalizedId = normalizedId.split('?')[0];
        }

        // If already in correct format, return as-is
        if (normalizedId.startsWith('gid://shopify/Cart/')) {
            return normalizedId;
        }
        
        // Extract the ID part (handle various formats)
        let id = normalizedId;
        
        // If it's a GID but wrong format, extract the ID
        if (normalizedId.includes('/')) {
            const parts = normalizedId.split('/');
            id = parts[parts.length - 1];
        }
        
        // Ensure it's a valid ID (not empty)
        if (!id || id.trim() === '') {
            return null;
        }
        
        // Return in correct format
        return `gid://shopify/Cart/${id}`;
    }

    /**
     * Calls a tool on the storefront MCP server.
     * Automatically injects cartId for cart-related tools if available.
     *
     * @param {string} toolName - Name of the storefront tool to call
     * @param {Object} toolArgs - Arguments to pass to the tool
     * @returns {Promise<Object>} Result from the tool call
     * @throws {Error} If the tool call fails
     */
    async callStorefrontTool(toolName, toolArgs) {
        try {
            // For cart-related tools, inject cartId if available and not already provided
            const isCartTool = toolName && (
                toolName.toLowerCase().includes('cart') ||
                toolName === 'update_cart' ||
                toolName === 'get_cart'
            );

            // Merge cartId into tool arguments if:
            // 1. It's a cart-related tool
            // 2. We have a cartId available
            // 3. cartId is not already in the arguments
            const finalArgs = { ...toolArgs };
            if (isCartTool && this.cartId && !finalArgs.cartId) {
                // Normalize cart ID to ensure proper format for Shopify's Storefront API
                finalArgs.cartId = this._normalizeCartId(this.cartId);
            } else if (isCartTool && finalArgs.cartId) {
                // Also normalize if cartId was explicitly provided in toolArgs
                finalArgs.cartId = this._normalizeCartId(finalArgs.cartId);
            }

            console.log("Calling storefront tool", toolName, finalArgs);

            const headers = {
                "Content-Type": "application/json"
            };

            const response = await this._makeJsonRpcRequest(
                this.storefrontMcpEndpoint,
                "tools/call",
                {
                    name: toolName,
                    arguments: finalArgs,
                },
                headers
            );

            return response.result || response;
        } catch (error) {
            console.error(`Error calling tool ${toolName}:`, error);
            throw error;
        }
    }

    /**
     * Calls a tool on the customer MCP server.
     * Handles authentication if needed.
     *
     * @param {string} toolName - Name of the customer tool to call
     * @param {Object} toolArgs - Arguments to pass to the tool
     * @returns {Promise<Object>} Result from the tool call or auth error
     * @throws {Error} If the tool call fails
     */
    async callCustomerTool(toolName, toolArgs) {
        try {
            console.log("=== CUSTOMER TOOL DEBUG START ===");
            console.log("Calling customer tool:", toolName);
            console.log("Tool arguments:", JSON.stringify(toolArgs, null, 2));
            console.log("Conversation ID:", this.conversationId);
            console.log("Shop ID:", this.shopId);
            console.log("Host URL:", this.hostUrl);
            console.log("Customer MCP Endpoint:", this.customerMcpEndpoint);
            
            // First try to get a token from the database for this conversation
            let accessToken = this.customerAccessToken;
            console.log("Cached accessToken exists:", Boolean(accessToken));

            if (!accessToken || accessToken === "") {
                console.log("Fetching token from database for conversation:", this.conversationId);
                const dbToken = await getCustomerToken(this.conversationId);
                
                console.log("Database token lookup result:", {
                    found: Boolean(dbToken),
                    hasAccessToken: Boolean(dbToken?.accessToken),
                    tokenId: dbToken?.id || "N/A",
                    conversationIdInDb: dbToken?.conversationId || "N/A",
                    expiresAt: dbToken?.expiresAt || "N/A",
                    isExpired: dbToken?.expiresAt ? new Date(dbToken.expiresAt) < new Date() : "N/A"
                });

                if (dbToken && dbToken.accessToken) {
                    accessToken = dbToken.accessToken;
                    this.customerAccessToken = accessToken; // Store it for later use
                    console.log("Token retrieved from database, length:", accessToken.length);
                    // Log first/last few chars for debugging (safe - not exposing full token)
                    console.log("Token preview:", accessToken.substring(0, 20) + "..." + accessToken.substring(accessToken.length - 10));
                } else {
                    console.log("No valid token in database for conversation:", this.conversationId);
                }
            } else {
                console.log("Using cached token, length:", accessToken.length);
            }

            const headers = {
                "Content-Type": "application/json",
                "Authorization": accessToken
            };

            console.log("Request headers:", {
                "Content-Type": headers["Content-Type"],
                "Authorization": accessToken ? `[Token present, length: ${accessToken.length}]` : "[No token]"
            });

            console.log("Customer tool request summary:", {
                toolName,
                endpoint: this.customerMcpEndpoint,
                hasAccessToken: Boolean(accessToken),
                tokenLength: accessToken ? accessToken.length : 0,
                argsType: toolArgs ? typeof toolArgs : "undefined",
                argKeys: toolArgs && typeof toolArgs === "object" ? Object.keys(toolArgs) : [],
            });

            try {
                console.log("Making JSON-RPC request to customer MCP...");
                const requestPayload = {
                    name: toolName,
                    arguments: toolArgs,
                };
                console.log("Request payload:", JSON.stringify(requestPayload, null, 2));
                
                const response = await this._makeJsonRpcRequest(
                    this.customerMcpEndpoint,
                    "tools/call",
                    requestPayload,
                    headers
                );

                console.log("Raw response from customer MCP:", JSON.stringify(response, null, 2));

                const result = response.result || response;
                const contentText = result?.content?.[0]?.text;

                console.log("Customer tool response parsed:", {
                    toolName,
                    hasError: Boolean(result?.error),
                    resultKeys: result && typeof result === "object" ? Object.keys(result) : [],
                    contentType: typeof contentText,
                    contentLength: typeof contentText === "string" ? contentText.length : 0,
                    contentPreview: typeof contentText === "string" ? contentText.substring(0, 500) : "N/A",
                    fullContent: result?.content,
                });
                
                console.log("=== CUSTOMER TOOL DEBUG END ===");

                return result;
            } catch (error) {
                // Handle 401 specifically to trigger authentication
                if (error.status === 401) {
                    console.log("Unauthorized, generating authorization URL for customer");

                    // Generate auth URL
                    const authResponse = await generateAuthUrl(this.conversationId, this.shopId);

                    // Instead of retrying, return the auth URL for the front-end
                    return {
                        error: {
                            type: "auth_required",
                            data: `You need to authorize the app to access your customer data. [Click here to authorize](${authResponse.url})`
                        }
                    };
                }

                // Re-throw other errors
                throw error;
            }
        } catch (error) {
            console.error(`Error calling tool ${toolName}:`, error);
            return {
                error: {
                    type: "internal_error",
                    data: `Error calling tool ${toolName}: ${error.message}`
                }
            };
        }
    }

    async callLocalTool(toolName, toolArgs) {
        return executeLocalTool(toolName, toolArgs, {
            shopDomain: this.hostUrl,
            conversationId: this.conversationId,
            shopId: this.shopId,
            cartId: this.cartId,
        });
    }

    /**
     * Makes a JSON-RPC request to the specified endpoint.
     *
     * @private
     * @param {string} endpoint - The endpoint URL
     * @param {string} method - The JSON-RPC method to call
     * @param {Object} params - Parameters for the method
     * @param {Object} headers - HTTP headers for the request
     * @returns {Promise<Object>} Parsed JSON response
     * @throws {Error} If the request fails
     */
    async _makeJsonRpcRequest(endpoint, method, params, headers) {
        const requestBody = {
            jsonrpc: "2.0",
            method: method,
            id: 1,
            params: params
        };
        
        console.log(`[JSON-RPC] Request to ${endpoint}`);
        console.log(`[JSON-RPC] Method: ${method}`);
        console.log(`[JSON-RPC] Body:`, JSON.stringify(requestBody, null, 2));
        console.log(`[JSON-RPC] Headers:`, {
            ...headers,
            Authorization: headers.Authorization ? `[Token length: ${headers.Authorization.length}]` : "[No token]"
        });
        
        const response = await fetch(endpoint, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(requestBody),
        });

        console.log(`[JSON-RPC] Response status: ${response.status} ${response.statusText}`);
        console.log(`[JSON-RPC] Response headers:`, Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            const error = await response.text();
            console.log(`[JSON-RPC] Error response body:`, error);
            const errorObj = new Error(`Request failed: ${response.status} ${error}`);
            errorObj.status = response.status;
            throw errorObj;
        }

        const jsonResponse = await response.json();
        console.log(`[JSON-RPC] Success response:`, JSON.stringify(jsonResponse, null, 2).substring(0, 1000));
        
        return jsonResponse;
    }

    /**
     * Formats raw tool data into a consistent format.
     *
     * @private
     * @param {Array} toolsData - Raw tools data from the API
     * @returns {Array} Formatted tools data
     */
    _formatToolsData(toolsData) {
        return toolsData.map((tool) => {
            return {
                name: tool.name,
                description: tool.description,
                input_schema: tool.inputSchema || tool.input_schema,
            };
        });
    }
}

export default MCPClient;
