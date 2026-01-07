---
name: "GraphQL Schema Exploration"
description: "Explore GraphQL schemas to find queries, mutations, and types. Use for API discovery and understanding Shopify Admin/Storefront APIs."
allowed-tools:
  - mcp__shopify-dev-mcp__learn_shopify_api
  - mcp__shopify-dev-mcp__introspect_graphql_schema
  - mcp__shopify-dev-mcp__search_docs_chunks
  - mcp__shopify-dev-mcp__fetch_full_docs
  - mcp__shopify-dev-mcp__validate_graphql_codeblocks
---

# GraphQL Schema Exploration Skill

Systematically explore and document GraphQL schemas for API understanding and integration.

## Purpose

Discover GraphQL API capabilities by introspecting schemas, finding relevant queries/mutations, understanding types and fields, and documenting usage patterns. This skill enables rapid API comprehension without relying on external documentation.

## Primary Agents

- **Oracle** - API investigation, documentation discovery
- **Baymax** - Validation testing, live API exploration

## Supporting Agents

- **Architect** - GraphQL design patterns, best practices
- **WALL-E** - Documentation of findings

## When to Use

- Learning a new GraphQL API
- Finding specific operations (query/mutation)
- Understanding available data fields
- Discovering API capabilities
- Validating API behavior
- Creating integration code
- Troubleshooting GraphQL errors

## Prerequisites

- Access to Shopify Dev MCP tools (`mcp__shopify-dev-mcp__*`)
- Conversation ID from `learn_shopify_api` tool
- API to explore (admin, storefront-graphql, partner, etc.)

## Step-by-Step Process

### 1. Initialize API Context (MANDATORY)

**Always start here** to set up the API context.

```bash
mcp__shopify-dev-mcp__learn_shopify_api
  api: "admin"  # or "storefront-graphql", "partner", etc.
```

**Returns**: `conversationId` - **Save this!** Required for all subsequent tool calls.

**Available APIs**:
- `admin` - Admin GraphQL API (apps, integrations)
- `storefront-graphql` - Storefront API (custom storefronts)
- `partner` - Partner API (Partner Dashboard data)
- `customer` - Customer Account API
- `payments-apps` - Payments Apps API
- `functions_*` - Various Shopify Functions schemas

### 2. Search Schema for Operations

Find relevant queries or mutations by keyword.

```bash
mcp__shopify-dev-mcp__introspect_graphql_schema
  conversationId: "[from step 1]"
  api: "admin"
  query: "product"
  filter: ["queries", "mutations"]
```

**Search Strategy**:
- Start with broad terms: "product", "order", "customer"
- Try action verbs: "create", "update", "delete", "list"
- Search field names: "id", "title", "price", "status"
- For camelCase, try individual words: "captureSession" → "capture" or "session"

**Returns**:
- Matching queries (read operations)
- Matching mutations (write operations)
- Type definitions
- Field descriptions

**Example Output**:
```graphql
# Queries
product(id: ID!): Product
products(first: Int, query: String): ProductConnection

# Mutations
productCreate(input: ProductInput!): ProductCreatePayload
productUpdate(input: ProductInput!): ProductUpdatePayload
productDelete(input: ProductDeleteInput!): ProductDeletePayload
```

### 3. Explore Object Types

Understand available fields on returned types.

```bash
mcp__shopify-dev-mcp__introspect_graphql_schema
  conversationId: "[from step 1]"
  api: "admin"
  query: "Product"
  filter: ["types"]
```

**Returns**:
```graphql
type Product {
  id: ID!
  title: String!
  description: String
  handle: String!
  vendor: String
  productType: String
  status: ProductStatus!
  variants(first: Int): ProductVariantConnection!
  images(first: Int): ImageConnection!
  createdAt: DateTime!
  updatedAt: DateTime!
}
```

**Analysis**:
- What fields are available?
- Which fields are required (!)?
- Which fields are connections (paginated)?
- What related types exist?

### 4. Understand Input Types

Examine input structures for mutations.

```bash
mcp__shopify-dev-mcp__introspect_graphql_schema
  conversationId: "[from step 1]"
  api: "admin"
  query: "ProductInput"
  filter: ["types"]
```

**Returns**:
```graphql
input ProductInput {
  title: String
  description: String
  vendor: String
  productType: String
  status: ProductStatus
  variants: [ProductVariantInput!]
  images: [ImageInput!]
}
```

**Questions to Answer**:
- Which fields are required?
- What data types are expected?
- Are there nested input types?
- What are the validation rules?

### 5. Check Scopes Required

Determine what API access scopes are needed.

**For Shopify APIs**:
```bash
# Schema introspection shows scope requirements in descriptions
# Look for "Requires:" or "Access:" in field descriptions
```

**Common Scopes**:
- `read_products`, `write_products`
- `read_orders`, `write_orders`
- `read_customers`, `write_customers`
- `read_inventory`, `write_inventory`

**Scope Reference**: See `~/partner-solutions/constants/shopifyAppAccessScopes.md`

### 6. Build Example Queries

Construct valid GraphQL queries with required fields.

**Simple Query**:
```graphql
query GetProduct {
  product(id: "gid://shopify/Product/123456") {
    id
    title
    description
    status
  }
}
```

**Query with Arguments**:
```graphql
query ListProducts {
  products(first: 10, query: "status:ACTIVE") {
    edges {
      node {
        id
        title
        handle
        variants(first: 5) {
          edges {
            node {
              id
              price
              sku
            }
          }
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

**Mutation Example**:
```graphql
mutation CreateProduct {
  productCreate(input: {
    title: "New Product"
    description: "Product description"
    vendor: "My Store"
    productType: "Physical"
    status: ACTIVE
  }) {
    product {
      id
      title
    }
    userErrors {
      field
      message
    }
  }
}
```

### 7. Validate Queries

Test queries for syntax and schema correctness.

```bash
mcp__shopify-dev-mcp__validate_graphql_codeblocks
  conversationId: "[from step 1]"
  api: "admin"
  codeblocks: [
    {
      content: "query { product(id: \"gid://shopify/Product/123\") { id title } }"
    }
  ]
```

**Returns**:
- ✅ Valid: Query is syntactically correct
- ❌ Invalid: Error details and fix suggestions

**Common Errors**:
- Missing required fields
- Invalid field names
- Wrong argument types
- Missing required arguments
- Incorrect query structure

### 8. Test Against Live API

Execute queries against a real store.

**Using Local App Credentials**:
```bash
# Get store credentials
cd apps/[APP_NAME]
sqlite3 prisma/dev.sqlite "SELECT shop, accessToken FROM Session LIMIT 1"

# Make GraphQL request
curl -X POST "https://[SHOP].myshopify.com/admin/api/2025-04/graphql.json" \
  -H "X-Shopify-Access-Token: [TOKEN]" \
  -H "Content-Type: application/json" \
  -d '{"query":"query { shop { name } }"}'
```

**Validation Checks**:
- Does query execute successfully?
- Is data returned as expected?
- Are pagination cursors correct?
- Do mutations persist changes?
- Are errors handled properly?

### 9. Document Findings

Create reusable documentation for the API operation.

**Documentation Template**:
```markdown
## Operation: [Query/Mutation Name]

### Purpose
What this operation does and when to use it.

### Required Scopes
- `read_products`
- `write_products`

### Arguments
| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| id | ID! | Yes | Product GID |
| input | ProductInput | Yes | Product data |

### Returns
Type: `Product` or `ProductCreatePayload`

### Example Query
```graphql
query GetProduct {
  product(id: "gid://shopify/Product/123") {
    id
    title
  }
}
```

### Example Response
```json
{
  "data": {
    "product": {
      "id": "gid://shopify/Product/123",
      "title": "Example Product"
    }
  }
}
```

### Common Errors
- `Invalid ID`: Ensure GID format is correct
- `Access denied`: Check required scopes

### Related Operations
- `productUpdate` - Update existing product
- `productDelete` - Delete product
```

### 10. Map API Coverage

Create a reference of explored operations.

**Coverage Map**:
```markdown
# Shopify Admin API - Products

## Queries
- ✅ `product(id)` - Get single product
- ✅ `products(first, query)` - List products with search
- ⬜ `productByHandle(handle)` - Get by handle (not explored)

## Mutations
- ✅ `productCreate(input)` - Create new product
- ✅ `productUpdate(input)` - Update product
- ⬜ `productDelete(input)` - Delete product (not tested)
- ⬜ `productDuplicate(productId)` - Duplicate product (not explored)

## Types
- ✅ `Product` - Core product type (fully mapped)
- ✅ `ProductVariant` - Variant type (fully mapped)
- ⏳ `ProductOption` - Option type (partially mapped)
- ⬜ `ProductImage` - Image type (not explored)
```

## Common Patterns

### Pattern 1: Finding CRUD Operations

**Goal**: Find create, read, update, delete operations for a resource.

```bash
# Search for resource name
introspect_graphql_schema(query="product")

# Look for patterns:
product           → Read single
products          → Read list
productCreate     → Create
productUpdate     → Update
productDelete     → Delete
```

### Pattern 2: Understanding Pagination

**Goal**: Handle paginated list queries.

```graphql
query ListProducts {
  products(first: 10) {
    edges {          # Array of results
      node {         # Actual item
        id
        title
      }
      cursor         # Position in list
    }
    pageInfo {
      hasNextPage    # More results available?
      endCursor      # Cursor for next page
    }
  }
}

# Next page query
query NextPage {
  products(first: 10, after: "[endCursor from previous]") {
    # ... same fields
  }
}
```

### Pattern 3: Exploring Nested Types

**Goal**: Understand relationships between types.

```bash
# Start with main type
introspect_graphql_schema(query="Product")

# Discover related types
Product → variants → ProductVariant
        → images → Image
        → metafields → Metafield

# Explore each related type
introspect_graphql_schema(query="ProductVariant")
introspect_graphql_schema(query="Metafield")
```

### Pattern 4: Mutation Error Handling

**Goal**: Understand error responses.

```graphql
mutation CreateProduct {
  productCreate(input: {...}) {
    product {
      id
    }
    userErrors {      # Application errors
      field           # Which field caused error
      message         # Error description
    }
  }
}
```

**Error Categories**:
- **User Errors**: Validation failures (in `userErrors`)
- **GraphQL Errors**: Syntax or schema errors (in `errors`)
- **HTTP Errors**: Network or auth failures (status code)

## Search Strategies

### Keyword Mapping

| You Want | Try Searching |
|----------|---------------|
| Get single item | Resource name (e.g., "product") |
| List items | Plural (e.g., "products") |
| Create | "create", "add", or "[resource]Create" |
| Update | "update", "modify", or "[resource]Update" |
| Delete | "delete", "remove", or "[resource]Delete" |
| Count | "count" or "[resource]Count" |
| Search | Query param on list operation |

### Fallback Strategies

If first search returns nothing:
1. Try shorter keyword (e.g., "capture" instead of "captureSession")
2. Try related terms (e.g., "inventory" for "stock")
3. Search for field names (e.g., "email", "phone")
4. Browse all queries with `query="*", filter=["queries"]`
5. Check documentation with `search_docs_chunks`

## Tools Reference

| Tool | Purpose | Parameters |
|------|---------|------------|
| `learn_shopify_api` | Initialize API context | api, conversationId (optional) |
| `introspect_graphql_schema` | Search schema | conversationId, api, query, filter |
| `validate_graphql_codeblocks` | Validate syntax | conversationId, api, codeblocks |
| `search_docs_chunks` | Find documentation | conversationId, prompt |
| `fetch_full_docs` | Get full doc pages | conversationId, paths |

## Output Format

```markdown
# GraphQL API Exploration: [API Name]

## Objective
[What you're trying to accomplish]

## API Context
**API**: admin
**Conversation ID**: abc123def456
**Scope**: Products domain

## Operations Discovered

### Query: `product`
**Purpose**: Get single product by ID

**Arguments**:
- `id: ID!` - Product GID (required)

**Returns**: `Product`

**Example**:
```graphql
query {
  product(id: "gid://shopify/Product/123") {
    id
    title
  }
}
```

**Scopes Required**: `read_products`

**Tested**: ✅ Yes (2025-01-15)

### Mutation: `productCreate`
**Purpose**: Create new product

**Arguments**:
- `input: ProductInput!` - Product data (required)

**Returns**: `ProductCreatePayload`

**Example**:
```graphql
mutation {
  productCreate(input: {title: "New Product"}) {
    product { id title }
    userErrors { field message }
  }
}
```

**Scopes Required**: `write_products`

**Tested**: ✅ Yes (2025-01-15)

## Types Explored

### `Product`
- `id: ID!`
- `title: String!`
- `description: String`
- `status: ProductStatus!`
- `variants: ProductVariantConnection!`

### `ProductInput`
- `title: String`
- `description: String`
- `status: ProductStatus`

## Common Patterns
- GID format: `gid://shopify/[Resource]/[ID]`
- Pagination: Use `first` argument and `pageInfo`
- Errors: Check `userErrors` in mutation payloads

## Next Steps
- [ ] Explore ProductVariant operations
- [ ] Test pagination with large result sets
- [ ] Document metafields operations
- [ ] Create example app integration
```

## Best Practices

1. **Always Initialize** - Call `learn_shopify_api` first
2. **Search Incrementally** - Start broad, narrow down
3. **Validate Before Testing** - Use `validate_graphql_codeblocks`
4. **Test with Real Data** - Verify against live API
5. **Document Scopes** - Note required access scopes
6. **Handle Errors** - Check `userErrors` in mutations
7. **Save Conversation ID** - Reuse for entire exploration session

## Related Skills

- **error-investigation** - Debug GraphQL errors
- **document-pattern-capture** - Document API patterns

## Checklist

Before exploring:
- [ ] Call `learn_shopify_api` and save conversationId
- [ ] Identify what you need to accomplish
- [ ] Have list of keywords to search

During exploration:
- [ ] Search for relevant operations
- [ ] Explore related types
- [ ] Understand input/output structures
- [ ] Note required scopes
- [ ] Build example queries
- [ ] Validate syntax

Testing phase:
- [ ] Validate queries with `validate_graphql_codeblocks`
- [ ] Test against live API
- [ ] Verify expected behavior
- [ ] Handle errors appropriately
- [ ] Test edge cases

After exploration:
- [ ] Document findings
- [ ] Create example code
- [ ] Note common errors
- [ ] Update API coverage map
- [ ] Share knowledge with team
