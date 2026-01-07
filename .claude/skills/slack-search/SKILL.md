---
name: "Slack Search"
description: "Search internal Slack messages via BigQuery for context, decisions, and solutions. Use before saying 'I don't know' or when codebase search lacks context."
allowed-tools:
  - mcp__data-portal__list_data_platform_docs
  - mcp__data-portal__query_bigquery
  - mcp__data-portal__analyze_query_results
---

# Slack Search Skill

Search Shopify's internal Slack messages via BigQuery when solving problems where you don't immediately know the answer.

## When to Use

- Before saying "I don't know"
- When codebase search doesn't reveal context
- For recent changes, decisions, or discussions
- When error messages seem familiar to the team
- Looking for PRs, docs links, or solution threads

## Data Source

**Table:** `shopify-dw.people.slack_messages`

## Process

### Step 1: Identify Keywords
Extract searchable terms from the problem:
- Error class names or messages
- Feature or component names
- Team or project names

### Step 2: Build Query
```sql
SELECT user_name, message, message_at, channel_name
FROM `shopify-dw.people.slack_messages`
WHERE TIMESTAMP_TRUNC(message_at, DAY) >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
  AND (message LIKE '%keyword1%' OR message LIKE '%keyword2%')
ORDER BY message_at DESC
LIMIT 20
```

### Step 3: Execute via Data Portal
Use `mcp__data-portal__query_bigquery` to run the query.

### Step 4: Synthesize Findings
- Look for solution threads and resolutions
- Extract links to PRs, docs, or Jira tickets
- Note team members who worked on related issues

## Search Patterns

| Goal | Query Pattern |
|------|---------------|
| Error messages | `message LIKE '%ErrorClassName%'` |
| Feature discussions | `message LIKE '%feature_name%' AND channel_name LIKE '%team%'` |
| Recent decisions | Extend interval to 90-180 days |
| Specific person | Add `AND user_name = 'name'` |
| Links/PRs | `message LIKE '%github.com%'` or `message LIKE '%pull/%'` |

## Relevant Agents

- **Oracle** - Research context and decisions
- **TARS** - Data queries and analysis
- **Scotty** - Production debugging context
- **Architect** - Design decisions and rationale
