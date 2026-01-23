import {
    ensureCustomerAuth,
    asTextContent,
} from "./tool-handler-utils";
import {
    getCustomerSupportTicketById,
    getMostRecentCustomerSupportTicket,
    upsertCustomerSupportTicket,
} from "../db.server";

export async function handleGetMostRecentTicket(_toolArgs, context) {
    const authResult = await ensureCustomerAuth(context);
    if (authResult.error) return authResult;

    const ticket = await getMostRecentCustomerSupportTicket(context.conversationId);
    if (!ticket) {
        return asTextContent({
            message: "No support tickets found for this conversation.",
        });
    }

    return asTextContent({ ticket });
}

export async function handleGetTicketById(toolArgs, context) {
    const authResult = await ensureCustomerAuth(context);
    if (authResult.error) return authResult;

    const ticketId = toolArgs?.ticket_id;
    if (!ticketId) {
        return {
            error: {
                type: "invalid_input",
                data: "ticket_id is required",
            },
        };
    }

    const ticket = await getCustomerSupportTicketById(
        context.conversationId,
        ticketId
    );

    if (!ticket) {
        return {
            error: {
                type: "not_found",
                data: "Ticket not found for this conversation.",
            },
        };
    }

    return asTextContent({ ticket });
}

export async function handleUpsertTicket(toolArgs, context) {
    const authResult = await ensureCustomerAuth(context);
    if (authResult.error) return authResult;

    const saved = await upsertCustomerSupportTicket({
        conversationId: context.conversationId,
        ticketId: toolArgs?.ticket_id,
        subject: toolArgs?.subject,
        message: toolArgs?.message,
        status: toolArgs?.status,
        metadata: toolArgs?.metadata,
    });

    return asTextContent({
        success: true,
        ticket: saved,
    });
}
