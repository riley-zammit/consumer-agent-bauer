# Create Technical Guide

Creates a validated technical guide for Shopify partners with optional Google Drive publishing.

## Usage

Invoke this skill when creating technical guides for partner integrations:
- New partner integration guides
- Feature-specific documentation
- API implementation guides

## Workflow

### Phase 1: Plan & Track

**Create plan file first:**
```markdown
# [Partner Name] - [Integration Topic] Guide

## Table of Contents
- [ ] Overview
- [ ] Prerequisites
- [ ] Setup Instructions
- [ ] Implementation Steps
- [ ] API Integration
- [ ] Testing & Validation
- [ ] Troubleshooting
- [ ] Additional Resources

## Plan
[Details about scope, APIs needed, partner context]
```

Save to: `./guides/partners/[partner-name]/[guide-name]-plan.md`

**Ask clarifying questions:**
- What's the partner's tech stack?
- Which Shopify APIs are needed?
- What's the integration complexity?
- Any known constraints or requirements?

### Phase 2: Research & Document

**Use available tools:**
- Shopify Dev MCP: `mcp__Shopify_Dev__search_docs_chunks` for API docs
- Shopify Schema: `mcp__Shopify_Dev__introspect_graphql_schema` for GraphQL
- Vault Search: `mcp__dev-mcp__vault_search` for internal docs

**Create guide sections iteratively:**
- Work through plan checklist
- Keep content concise and direct
- Include tested code examples
- Avoid embellishment

### Phase 3: Validate with Live Store

**Test API calls directly:**
1. Find local app credentials:
   ```bash
   sqlite3 ./apps/APP_NAME/prisma/dev.sqlite "SELECT shop, accessToken FROM Session;"
   ```

2. Test GraphQL queries:
   ```bash
   curl -X POST "https://SHOP.myshopify.com/admin/api/2025-04/graphql.json" \
     -H "X-Shopify-Access-Token: TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"query":"YOUR_QUERY"}' | jq
   ```

3. Update guide with validated examples

**User setup steps:**
- Ask user to complete any required setup
- Or guide on how to do it
- Document the steps in the guide

**Need validation?**
Use Baymax agent to verify approaches and test code:
```
Hey Baymax, validate this API approach for [partner integration]
and test it against a live store
```

### Phase 4: Extract Blocks

**Always ask at the end:**
"Should we extract any sections as reusable blocks?"

**If yes, create blocks:**
- Identify reusable patterns
- Extract to `./guides/blocks/[block-name].md`
- Remove partner-specific details
- Link from main guide

### Phase 5: Publish & Sync (Optional)

**If sharing with partner:**

1. **Commit guide to repo:**
   ```bash
   git add guides/partners/[partner-name]/
   git commit -m "docs: Add [guide name]"
   git push
   ```

2. **Copy to Google Drive:**
   - Copy markdown content
   - Create Google Doc in shared drive
   - Format (headings, code blocks, images)
   - Share with partner

3. **Link back to repo:**
   Add to guide:
   ```markdown
   ## Google Doc
   📄 [View on Google Drive](https://docs.google.com/document/d/DOC_ID)

   **Last Synced**: YYYY-MM-DD
   ```

4. **Sync updates later:**
   ```
   Hey Claude, read Google Doc at [URL] and sync to
   ./guides/partners/[partner]/[guide].md
   ```

## Guide Structure

```markdown
# [Partner Name] - [Integration] Guide

## Overview
Brief description of integration

## Prerequisites
- Shopify Partner account
- [Partner platform] account
- Development environment setup

## Setup Instructions
Step-by-step setup

## Implementation
Detailed implementation with code examples

## API Integration
### GraphQL Queries
[Validated examples]

### Webhooks
[Setup and handling]

## Testing & Validation
How to verify integration works

## Troubleshooting
Common issues and solutions

## Additional Resources
- [Shopify Dev Docs links]
- [Partner platform docs]

## Google Doc (if published)
📄 [View on Google Drive](https://docs.google.com/document/d/DOC_ID)
**Last Synced**: YYYY-MM-DD
```

## Tools Available

**Any markdown-capable tool:**
- Claude Code (this environment)
- Cursor with Claude
- Terminal
- Text editor
- AI tools that output markdown

## Best Practices

- **Interactive**: Ask questions throughout
- **Concise**: Direct, no embellishment
- **Validated**: Test all code examples
- **Modular**: Extract reusable blocks
- **Synced**: Keep repo and Google Docs in sync

## Example Invocation

```
Hey Claude, use the create-technical-guide skill to build a guide
for [Partner Name] integrating with Shopify Orders API.

They use Node.js and need to:
- Fetch orders via GraphQL
- Subscribe to order webhooks
- Update order status

Start with the plan phase.
```

## Notes

- Check existing guides in `./guides/partners/` for reference
- Review blocks in `./guides/blocks/` before creating content
- See `./guides/GUIDE_CREATION_WORKFLOW.md` for full lifecycle
- Cursor users: This skill works with the `.cursor/rules/create-technical-guide.mdc` rule
