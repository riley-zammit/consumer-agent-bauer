import { initiateReturn } from "./initiate-return";
import { completeReturn } from "./complete-return";
import {
    asTextContent,
    getAccessTokenForShop,
    normalizeShopDomain,
} from "./tool-handler-utils";

export async function handleInitiateReturn(toolArgs, context) {
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

export async function handleCompleteReturn(toolArgs, context) {
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
