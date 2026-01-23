import { searchProductsCustom } from "../services/search.server";
import {
    asTextContent,
    searchCollectionsByProductIds,
} from "./tool-handler-utils";

export async function handleSearchProductsPreferred(toolArgs, context) {
    const products = await searchProductsCustom({
        shopDomain: context.shopDomain,
        query: toolArgs?.query,
        limit: toolArgs?.limit,
    });
    return asTextContent({ products });
}

export async function handleSearchCollections(toolArgs, context) {
    const productIds = toolArgs?.product_ids;
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
        return {
            error: {
                type: "invalid_input",
                data: "product_ids must be a non-empty array of product GIDs",
            },
        };
    }

    const collections = await searchCollectionsByProductIds({
        shopDomain: context.shopDomain,
        productIds,
    });

    return asTextContent({ collections });
}
