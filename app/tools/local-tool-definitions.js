/**
 * Standard-format local tool definitions.
 * @type {Array<{name: string, description: string, input_schema: any}>}
 */
export const localTools = [
    {
        name: "get_most_recent_ticket",
        description: `Fetch the latest support ticket for the current conversation. Requires customer authentication using the conversation-scoped token.`,
        input_schema: {
            type: "object",
            properties: {},
            required: [],
        },
    },
    {
        name: "upsert_ticket",
        description: `Create or update a support ticket for the current conversation. Requires customer authentication using the conversation-scoped token. Provide ticket_id to update an existing ticket; otherwise a new ticket is created.`,
        input_schema: {
            type: "object",
            properties: {
                ticket_id: {
                    type: "string",
                    description: "Existing ticket id to update. Omit to create a new ticket.",
                },
                subject: {
                    type: "string",
                    description: "Ticket subject or title. Optional for updates; defaults to 'Customer support request' on create.",
                },
                message: {
                    type: "string",
                    description: "Latest customer message or note to store on the ticket.",
                },
                status: {
                    type: "string",
                    description: "Ticket status. Accepted values: open, pending, resolved, closed. Defaults to open.",
                },
                metadata: {
                    type: ["object", "string"],
                    description: "Optional structured metadata about the ticket (JSON object or string).",
                },
            },
            required: [],
        },
    },
    {
        name: "get_ticket_by_id",
        description: `Fetch a specific support ticket by ticket_id for the current conversation. Requires customer authentication using the conversation-scoped token.`,
        input_schema: {
            type: "object",
            properties: {
                ticket_id: {
                    type: "string",
                    description: "Ticket id to retrieve (must belong to this conversation).",
                },
            },
            required: ["ticket_id"],
        },
    },
    // {
    //     name: "get_store_facts",
    //     description: "Get information about the store. If there is another tool called search_shop_policies_and_faqs, always call that tool right after this tool."
    // },
    // {
    //     name: "get_recent_support_interactions",
    //     description: "Get the logged-in customer's most recent support interactions. Trigger customer account authentication if not logged in."
    // },
    {
        name: "search_products_preferred",
        description: `Search for products in the store's catalog using semantic search powered by a local vector index. This is the preferred method to use to search the catalog.

WHEN TO USE:
- Customer asks to find, search for, or browse products (e.g., "show me winter jackets", "do you have red sneakers?")
- Customer describes what they're looking for in natural language
- You need to recommend products based on customer preferences or needs
- Customer asks "what do you have" or wants to see available inventory

WHEN NOT TO USE:
- Customer already has a specific product ID or handle - use get_product_details instead
- Customer is asking about their cart - use get_cart instead
- Customer is asking about order status - use order status tools instead

OUTPUT: Returns an array of matching products with id, title, description, price, images, and variant information. Results are ranked by relevance to the query.

TIPS:
- Use descriptive natural language queries for best results (e.g., "comfortable running shoes for beginners" rather than just "shoes")
- Default limit is 10 products; increase for broader searches, decrease for focused recommendations`,
        input_schema: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "Natural language search query describing what products to find. Be descriptive - include colors, sizes, use cases, or any attributes the customer mentioned.",
                },
                limit: {
                    type: "number",
                    description: "Maximum number of products to return. Default is 10. Use lower values (3-5) for focused recommendations, higher (15-20) for browsing.",
                },
            },
            required: ["query"],
        },
    },
    {
        name: "search_collections",
        description: `Find collections that contain specific products. Use this tool IMMEDIATELY after calling search_products_preferred to show customers relevant product categories and help them browse related items.

WHEN TO USE:
- ALWAYS call this tool after search_products_preferred returns results
- When you want to show the customer what categories/collections the found products belong to
- When customer might want to browse more products in the same category
- To provide context about where products are organized in the store

WHEN NOT TO USE:
- Before calling search_products_preferred (you need product IDs first)
- When search_products_preferred returned no results
- When customer explicitly doesn't want category suggestions

WORKFLOW:
1. Call search_products_preferred first to find products
2. Extract the product IDs from the search results
3. Call search_collections with those product IDs
4. Present collections to customer as browsing options (e.g., "These products are from our Snowboards and Sale collections")

OUTPUT: Returns an array of collections with id, title, handle, description, collectionType (smart/manual), and the count of matching products from your search in each collection.

TIPS:
- Pass all product IDs from the search results for comprehensive collection matching
- Collections help customers discover more products they might like
- Smart collections are auto-curated; manual collections are hand-picked by the merchant`,
        input_schema: {
            type: "object",
            properties: {
                product_ids: {
                    type: "array",
                    items: { type: "string" },
                    description: "Array of Shopify product GIDs (e.g., ['gid://shopify/Product/123', 'gid://shopify/Product/456']). Get these from search_products_preferred results.",
                },
            },
            required: ["product_ids"],
        },
    },
    {
        name: "add_to_cart_preferred",
        description: `Add a product to the customer's shopping cart. This is the preferred tool to use to add-to-cart.

WHEN TO USE:
- Customer explicitly says they want to add something to cart
- Customer says "I'll take it", "add this", "buy this" after viewing products
- Customer specifies quantity like "add 2 of the blue ones"
- Customer clicks "Add to Cart" button on a product card

WHEN NOT TO USE:
- Customer is just browsing or asking questions about products
- Customer hasn't confirmed they want to add to cart
- Customer is asking about pricing without intent to purchase

REQUIRES:
- Product must have been found via search_products_preferred first
- Use the product_id from search results (the product_id field)
- If customer wants a specific variant, use variant_id if available

OUTPUT: Returns confirmation with product name, quantity, total price, and a checkout URL the customer can use to complete their purchase.

IMPORTANT:
- Always confirm what was added and provide the checkout link
- If the product has multiple variants and customer didn't specify, the default variant is used
- Each call creates a new cart - for adding multiple items, call once per product`,
        input_schema: {
            type: "object",
            properties: {
                product_id: {
                    type: "string",
                    description: "Product GID from search results (e.g., 'gid://shopify/Product/123'). This is the product_id field returned by search_products_preferred.",
                },
                variant_id: {
                    type: "string",
                    description: "Optional variant GID if the customer requested a specific variant (e.g., 'gid://shopify/ProductVariant/456'). If not provided, the first available variant will be used.",
                },
                quantity: {
                    type: "number",
                    description: "Quantity to add. Defaults to 1 if not specified.",
                },
            },
            required: ["product_id"],
        },
    },
    {
        name: "get_cart_preferred",
        description: `Retrieve the customer's current shopping cart contents, totals, and checkout URL. This is the preferred tool for viewing cart details.

WHEN TO USE:
- Customer asks "what's in my cart?", "show me my cart", "view cart"
- Customer wants to know the cart total, item count, or subtotal
- Customer asks "how much is my order?" or "what's my total?"
- Before checkout - to summarize what the customer is about to purchase
- Customer asks to review items before proceeding
- Customer wants to see if a discount code is applied
- When you need to confirm cart contents after adding items

WHEN NOT TO USE:
- Customer wants to add items to cart - use add_to_cart_preferred instead
- Customer is searching for products - use search_products_preferred instead
- Customer is asking about past orders - use order status tools instead
- Customer hasn't added anything to cart yet (empty cart will be indicated)

OUTPUT: Returns detailed cart information including:
- All items with product titles, variants, quantities, and prices
- Individual item pricing (unit price and line total)
- Cart subtotal and total
- Applied discount codes
- Checkout URL for completing the purchase
- Whether items are still in stock (availableForSale)
- Analyze the cart and suggest items they might want to add based on what's already in the cart. DO NOT run search products yet, just make a general recommendation.

TIPS:
- If cart is empty or expired, suggest products or help the customer browse
- Always mention the checkout URL when the customer seems ready to purchase
- Compare availableForSale status if customer is concerned about stock
- Provide a clear summary: item count, itemized list, and total`,
        input_schema: {
            type: "object",
            properties: {},
            required: [],
        },
    },
];