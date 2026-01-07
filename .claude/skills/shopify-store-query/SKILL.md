---
name: "Shopify Store Query"
description: "Make GraphQL requests to Shopify stores using credentials from local apps. Use this when the user wants to query a store, fetch products, orders, or any Admin API data."
allowed-tools:
  - Bash
  - Read
  - Glob
  - AskUserQuestion
  - mcp__Shopify_Dev__introspect_graphql_schema
  - mcp__Shopify_Dev__learn_shopify_api
---

# Shopify Store Query Skill

This skill helps make GraphQL requests to Shopify stores using credentials stored in local app databases.

## Pre-Flight Checklist

Before making any requests, ALWAYS follow these steps:

### Step 1: Check for Local Apps

```bash
ls -la ./apps/
```

Look for directories (not files) that contain Shopify apps. Common app folders have names like `leighs-local-central`, `live-demo`, etc.

**If NO app directories exist:** Stop and inform the user they need to create a local app first using `shopify app init` in the `apps/` directory.

### Step 2: Handle Multiple Apps

**If MULTIPLE app directories exist:** Ask the user which app to use before proceeding. Use the AskUserQuestion tool with the available app names as options.

**If a selection exists in `./apps/currentApp.md`:** Read it and confirm with the user if they want to use that app or choose a different one.

### Step 3: Find the Database

Once an app is selected, locate the SQLite database:

```bash
find ./apps/APP_NAME -name "*.sqlite" -o -name "*.sqlite3" -o -name "*.db" 2>/dev/null
```

Common locations:
- `./apps/APP_NAME/prisma/dev.sqlite`
- `./apps/APP_NAME/.data/sqlite.db`
- `./apps/APP_NAME/db/development.sqlite3`

### Step 4: Get Store Credentials

Query the Session table for credentials:

```bash
sqlite3 ./apps/APP_NAME/prisma/dev.sqlite "SELECT id, shop, accessToken FROM Session;"
```

Output format: `offline_SHOP|SHOP.myshopify.com|shpua_TOKEN`

**If MULTIPLE sessions/stores exist:** Ask the user which store to query.

### Step 5: Handle Multiple Stores

If the app is installed on multiple stores, the Session table will have multiple rows. Present the options to the user and let them choose.

## Making GraphQL Requests

Use the latest API version (2025-04) with curl:

```bash
curl -s -X POST "https://SHOP.myshopify.com/admin/api/2025-04/graphql.json" \
  -H "X-Shopify-Access-Token: TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"YOUR_QUERY"}' | jq
```

## Schema Lookup

Before constructing complex queries, use the Shopify Dev MCP tools:
- `mcp__Shopify_Dev__learn_shopify_api` - Initialize API context (call first)
- `mcp__Shopify_Dev__introspect_graphql_schema` - Search for fields, types, mutations

## Common Queries

### Shop Info
```graphql
query { shop { id name email url primaryDomain { url host } plan { displayName } } }
```

### Products (first 5)
```graphql
query { products(first: 5) { edges { node { id title handle status } } } }
```

### Orders (unfulfilled)
```graphql
query { orders(first: 5, query: "fulfillment_status:unfulfilled") { nodes { id name displayFulfillmentStatus } } }
```

### Locations
```graphql
query { locations(first: 10) { nodes { id name address { address1 city country } } } }
```

## Troubleshooting

1. **No access token**: App not installed on any store - user needs to run `npm run dev` and install
2. **Invalid token**: Token may have expired - reinstall the app
3. **Missing scopes**: Check `shopify.app.toml` for required access scopes
4. **Field not found**: Use introspect_graphql_schema to verify field names

## Important Rules

- NEVER make requests without first confirming which app and store to use
- ALWAYS pipe curl output to `jq` for readable JSON
- ALWAYS use API version 2025-04 unless user specifies otherwise
- If the query fails, check the error message and suggest fixes
