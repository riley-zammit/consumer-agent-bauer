import { generateAuthUrl } from "../auth.server";
import prisma, {
    getCustomerAccountUrls,
    getCustomerToken,
    storeCustomerAccountUrls,
} from "../db.server";

export function asTextContent(payload) {
    return {
        content: [
            {
                type: "text",
                text: typeof payload === "string" ? payload : JSON.stringify(payload),
            },
        ],
    };
}

export function normalizeShopDomain(shopOrUrl) {
    if (!shopOrUrl) return null;
    try {
        if (shopOrUrl.startsWith("http://") || shopOrUrl.startsWith("https://")) {
            return new URL(shopOrUrl).hostname;
        }
    } catch {
        // ignore parse errors
    }
    return shopOrUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

export async function getAccessTokenForShop(shopDomain) {
    const shop = normalizeShopDomain(shopDomain);
    if (!shop) return null;

    const session = await prisma.session.findFirst({
        where: { shop },
        select: { accessToken: true },
    });

    return session?.accessToken || null;
}

export async function searchCollectionsByProductIds({ shopDomain, productIds }) {
    const shop = normalizeShopDomain(shopDomain);
    if (!shop) return [];

    const session = await prisma.session.findFirst({
        where: { shop },
        select: { id: true },
    });

    if (!session) return [];

    const productCollections = await prisma.productCollection.findMany({
        where: {
            productId: { in: productIds },
        },
        select: {
            collectionId: true,
            productId: true,
        },
    });

    if (productCollections.length === 0) return [];

    const collectionProductCounts = {};
    for (const pc of productCollections) {
        collectionProductCounts[pc.collectionId] = (collectionProductCounts[pc.collectionId] || 0) + 1;
    }

    const collectionIds = Object.keys(collectionProductCounts);

    const collections = await prisma.collection.findMany({
        where: {
            id: { in: collectionIds },
            sessionId: session.id,
        },
        select: {
            id: true,
            handle: true,
            title: true,
            description: true,
            collectionType: true,
            imageUrl: true,
            productsCount: true,
        },
    });

    return collections.map(collection => ({
        ...collection,
        matchingProductsCount: collectionProductCounts[collection.id] || 0,
    }));
}

export async function ensureCustomerAuth(context) {
    const { conversationId, shopId, shopDomain } = context;

    if (!conversationId) {
        return {
            error: {
                type: "invalid_input",
                data: "conversationId is required for customer-authenticated tools.",
            },
        };
    }

    const urls = await resolveCustomerAccountUrls(conversationId, shopDomain);
    if (!urls?.mcpApiUrl) {
        return {
            error: {
                type: "auth_error",
                data: "Unable to resolve customer MCP API URL for this conversation.",
            },
        };
    }

    const token = await getCustomerToken(conversationId);
    if (!token?.accessToken) {
        return await buildAuthRequiredError(conversationId, shopId);
    }

    const tokenValid = await validateCustomerToken(urls.mcpApiUrl, token.accessToken);
    if (!tokenValid) {
        return await buildAuthRequiredError(conversationId, shopId);
    }

    return { success: true, accessToken: token.accessToken };
}

export async function buildAuthRequiredError(conversationId, shopId) {
    try {
        if (shopId) {
            const auth = await generateAuthUrl(conversationId, shopId);
            return {
                error: {
                    type: "auth_required",
                    data: `Customer authorization required. [Click here to authorize](${auth.url}).`,
                },
            };
        }
    } catch (err) {
        console.warn("Failed to generate auth URL:", err);
    }

    return {
        error: {
            type: "auth_required",
            data: "Customer authorization required to access support tickets.",
        },
    };
}

async function resolveCustomerAccountUrls(conversationId, shopDomain) {
    const existing = await getCustomerAccountUrls(conversationId);
    if (existing?.mcpApiUrl) return existing;

    if (!shopDomain) return null;

    try {
        const hostname = shopDomain.startsWith("http")
            ? new URL(shopDomain).hostname
            : shopDomain;

        const [mcpResponse, openidResponse] = await Promise.all([
            fetch(`https://${hostname}/.well-known/customer-account-api`).then((res) => res.json()),
            fetch(`https://${hostname}/.well-known/openid-configuration`).then((res) => res.json()),
        ]);

        await storeCustomerAccountUrls({
            conversationId,
            mcpApiUrl: mcpResponse.mcp_api,
            authorizationUrl: openidResponse.authorization_endpoint,
            tokenUrl: openidResponse.token_endpoint,
        });

        return {
            mcpApiUrl: mcpResponse.mcp_api,
            authorizationUrl: openidResponse.authorization_endpoint,
            tokenUrl: openidResponse.token_endpoint,
        };
    } catch (err) {
        console.error("Failed to resolve customer account URLs:", err);
        return null;
    }
}

async function validateCustomerToken(mcpApiUrl, accessToken) {
    try {
        const response = await fetch(mcpApiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": accessToken,
            },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "tools/list",
                id: 1,
                params: {},
            }),
        });

        return response.ok;
    } catch (err) {
        console.warn("Failed to validate customer token:", err);
        return false;
    }
}
