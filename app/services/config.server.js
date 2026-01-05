/**
 * Configuration Service
 * Centralizes all configuration values for the chat service
 */

export const AppConfig = {
    // API Configuration
    api: {
        defaultModel: 'claude-sonnet-4-20250514',
        maxTokens: 2000,
        defaultPromptType: 'standardAssistant',
    },

    // Error Message Templates
    errorMessages: {
        missingMessage: "Message is required",
        apiUnsupported: "This endpoint only supports server-sent events (SSE) requests or history requests.",
        authFailed: "Authentication failed with Claude API",
        apiKeyError: "Please check your API key in environment variables",
        rateLimitExceeded: "Rate limit exceeded",
        rateLimitDetails: "Please try again later",
        genericError: "Failed to get response from Claude"
    },

    // Tool Configuration
    tools: {
        productSearchName: "search_shop_catalog",
        maxProductsToDisplay: 3
    },

    //using additional tools
    customTools: {
        search_shop_catalog_custom: {},
        return_custom: {}, //we probably want human in the loop for returns (that's why we have request_return?)
        get_ticket_history: {}, //for customer support
    }

};

export default AppConfig;
