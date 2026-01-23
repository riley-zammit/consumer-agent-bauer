import {
    handleGetMostRecentTicket,
    handleGetTicketById,
    handleUpsertTicket,
} from "./support-tool-handlers";
import {
    handleSearchCollections,
    handleSearchProductsPreferred,
} from "./product-tool-handlers";
import {
    handleInitiateReturn,
    handleCompleteReturn,
} from "./return-tool-handlers";
import {
    handleAddToCartPreferred,
    handleGetCartPreferred,
} from "./cart-tool-handlers";

const toolHandlers = {
    get_most_recent_ticket: handleGetMostRecentTicket,
    get_ticket_by_id: handleGetTicketById,
    upsert_ticket: handleUpsertTicket,
    search_products_preferred: handleSearchProductsPreferred,
    search_collections: handleSearchCollections,
    initiate_return_custom: handleInitiateReturn,
    complete_return_custom: handleCompleteReturn,
    add_to_cart_preferred: handleAddToCartPreferred,
    get_cart_preferred: handleGetCartPreferred,
};

export async function executeLocalTool(toolName, toolArgs, context = {}) {
    const handler = toolHandlers[toolName];

    if (!handler) {
        return {
            error: {
                type: "tool_not_found",
                data: `Local tool ${toolName} not found`,
            },
        };
    }

    try {
        return await handler(toolArgs, context);
    } catch (error) {
        return {
            error: {
                type: "internal_error",
                data: `Error executing local tool ${toolName}: ${error.message}`,
            },
        };
    }
}
