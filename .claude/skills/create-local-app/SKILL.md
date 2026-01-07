---
name: "Create Local Shopify App"
description: "Create and configure a new local Shopify app using the Shopify CLI. Use this when the user wants to create a new app, set up a development environment, or initialize a Shopify project."
allowed-tools:
  - Bash
  - Read
  - Edit
  - Write
  - Glob
  - AskUserQuestion
  - mcp__Shopify_Dev__learn_shopify_api
  - mcp__Shopify_Dev__search_docs_chunks
  - mcp__Shopify_Dev__fetch_full_docs
---

# Create Local Shopify App Skill

This skill guides the creation and configuration of local Shopify apps using the Shopify CLI.

## CRITICAL: Technology Notes

The Shopify CLI creates apps using **modern technologies that may differ from your training data**:

1. **Polaris Web Components** - NOT React Polaris components
   - Uses `<ui-*>` HTML custom elements, not `<Button>`, `<Card>` React components
   - Documentation: https://shopify.dev/docs/api/app-home/polaris-web-components

2. **React Router** - Modern routing patterns
   - May use patterns unfamiliar from older React Router versions

3. **When helping with app code**: Use the Shopify Dev MCP tools to get accurate, current documentation:
   - `mcp__Shopify_Dev__learn_shopify_api` with `api: "polaris-app-home"` for Polaris Web Components
   - `mcp__Shopify_Dev__search_docs_chunks` to search current docs
   - Use the **shopify-store-query** skill to test API calls directly

## Pre-Flight Checklist

### Step 1: Verify Prerequisites

Check Node.js and npm:
```bash
node -v && npm -v
```
**Required:** Node.js 18.20+ or 20.10+

Check Shopify CLI:
```bash
shopify --version
```

If not installed:
```bash
npm install -g @shopify/cli@latest
```

**IMPORTANT:** Install `@shopify/cli` only - NOT `@shopify/app`

### Step 2: Check for Existing Apps

```bash
ls -la apps/
```

If app directories exist, ask the user:
- Would you like to **start an existing app**, or
- **Create a new one**?

### Step 3: Verify User is Logged In

Ask the user to confirm they are logged into Shopify CLI:
```bash
shopify auth logout && shopify auth login
```

Or have them verify their current login:
```bash
shopify config
```

The user should be logged into their Partner account where they want to create the app.

## Creating the App

### Step 1: Initialize the App

**IMPORTANT:** This command requires interactive terminal input - DO NOT run in background mode.

```bash
cd apps/ && shopify app init
```

The CLI will prompt for:
- App name
- Template selection
- Configuration options

Let the user complete the interactive prompts.

### Step 2: Locate the New App

After creation, find the new app folder:
```bash
ls -la apps/
```

Identify the newly created directory and verify the config file exists:
```bash
ls -la apps/[APP_NAME]/shopify.app.toml
```

### Step 3: Configure Access Scopes

Ask the user: **"Would you like me to add all Shopify access scopes to this app for maximum flexibility during development?"**

If yes, read the scopes from `./constants/shopifyAppAccessScopes.md` and update the `shopify.app.toml`:

```toml
[access_scopes]
scopes = "scope1,scope2,scope3,..."
```

**IMPORTANT:** Format as comma-separated list WITHOUT spaces between scopes.

The scopes file contains three groups:
- Authenticated Access Scopes
- Unauthenticated Access Scopes
- Customer Access Scopes

### Step 4: Protected Customer Data Access

**CRITICAL:** Tell the user they MUST manually enable protected customer data access:

> **Action Required:** You need to enable protected customer data access in the Partner Dashboard.
>
> 1. Go to your [Partner Dashboard](https://partners.shopify.com)
> 2. Navigate to: **Apps → [Your App Name] → Configuration → Protected customer data access**
> 3. Enable the required data access permissions
> 4. Submit the access request if required
>
> Without this step, customer-related API calls will fail even with correct scopes.

### Step 5: Update currentApp.md

Track the new app selection:
```bash
cat > ./apps/currentApp.md << 'EOF'
# Current App Configuration

**Current App**: [APP_NAME]
**Selected Date**: [TODAY'S DATE]
**Purpose**: [Ask user for purpose]

## App Details
- **Location**: ./apps/[APP_NAME]/
- **Store**: [To be set after first run]
- **Database**: ./apps/[APP_NAME]/prisma/dev.sqlite
EOF
```

### Step 6: Start the App

Ask: **"Would you like me to start the app now?"**

If yes, run in background:
```bash
cd apps/[APP_NAME] && npm run dev
```

This will:
1. Set up the local development environment
2. Create a tunnel for the app
3. Prompt the user to select a store to install on

## Post-Creation Guidance

After the app is running, inform the user:

1. **GraphiQL available** at `http://localhost:[PORT]/graphiql` for exploring the Admin API
2. **Use the shopify-store-query skill** to make direct API calls for testing
3. **Use Shopify Dev MCP** to look up correct API patterns - don't rely on training data for Polaris Web Components

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `command not found: shopify` | Run `npm install -g @shopify/cli@latest` |
| App creation fails | Ensure Node.js is 18.20+ or 20.10+ |
| `npm run dev` fails | Check `package.json` exists in app directory |
| Auth errors | Run `shopify auth logout` then `shopify auth login` |
| Tunnel errors | Check no other app is using the same tunnel |

## Important Rules

- NEVER run `shopify app init` in background mode - it requires interactive input
- ALWAYS ask about existing apps before creating new ones
- ALWAYS remind user about protected customer data access
- ALWAYS update `./apps/currentApp.md` with the new app
- When helping with app code, use MCP tools for current documentation - training data may be outdated for Polaris Web Components
