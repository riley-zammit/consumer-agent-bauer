import { addToCart, getCart } from "../services/cart.server";
import { asTextContent } from "./tool-handler-utils";

export async function handleAddToCartPreferred(toolArgs, context) {
    const productId = toolArgs?.product_id;
    if (!productId) {
        return {
            error: {
                type: "invalid_input",
                data: "product_id is required. Use the product_id from search_products_preferred results.",
            },
        };
    }

    const result = await addToCart({
        shopDomain: context.shopDomain,
        productId,
        variantId: toolArgs?.variant_id,
        quantity: toolArgs?.quantity || 1,
        cartId: context.cartId,
    });

    if (result.error) {
        return {
            error: {
                type: "cart_error",
                data: typeof result.error === "string" ? result.error : result.error.message || JSON.stringify(result.error),
            },
        };
    }

    return asTextContent(result);
}

export async function handleGetCartPreferred(_toolArgs, context) {
    const result = await getCart({
        shopDomain: context.shopDomain,
        cartId: context.cartId,
    });

    if (result.error) {
        return {
            error: {
                type: "cart_error",
                data: typeof result.error === "string" ? result.error : result.error.message || JSON.stringify(result.error),
            },
        };
    }

    return asTextContent(result);
}
