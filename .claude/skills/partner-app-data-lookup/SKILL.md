# Partner & App Data Lookup

Query Shopify's data warehouse to find partner details, app information, and performance metrics.

## Overview

The data warehouse contains authoritative tables for partners, apps, and their performance. Use these queries to:
- Find partner information by name or ID
- Look up app details and API credentials
- Get installation and revenue metrics
- Understand app distribution and publication status

## Key Tables

| Table | Purpose |
|-------|---------|
| `shopify-dw.accounts_and_administration.partners` | Current state of all partners (IDs, business names, contact info, status) |
| `shopify-dw.apps_and_developers.apps` | Source of truth for all apps (api_client_id, api_key, partner ownership, metadata) |
| `shopify-dw.apps_and_developers.public_apps` | Apps with app store presence (publication state, pricing, category) |
| `shopify-dw.apps_and_developers.app_installs_daily_summary` | Daily install snapshots (active shops, plus tier shops) |
| `shopify-dw.apps_and_developers.app_billings_daily_summary` | Daily revenue snapshots by billing type |

## Common Queries

### Find a Partner by Name

```sql
SELECT
  partner_id,
  business_name,
  business_email,
  country_code,
  status,
  created_at
FROM `shopify-dw.accounts_and_administration.partners`
WHERE LOWER(business_name) LIKE LOWER('%{{PARTNER_NAME}}%')
  AND NOT is_deleted
ORDER BY created_at DESC
```

### Find All Apps by Partner

```sql
SELECT
  api_client_id,
  api_key,
  app_name,
  distribution_model,
  is_published,
  created_at
FROM `shopify-dw.apps_and_developers.apps`
WHERE partner_id = {{PARTNER_ID}}
  AND NOT is_deleted
ORDER BY created_at DESC
```

### Find App by Name or API Key

```sql
SELECT
  api_client_id,
  api_key,
  app_name,
  partner_id,
  distribution_model,
  is_published,
  created_at
FROM `shopify-dw.apps_and_developers.apps`
WHERE (LOWER(app_name) LIKE LOWER('%{{APP_NAME}}%')
   OR api_key = '{{API_KEY}}')
  AND NOT is_deleted
```

### Get App Store Details for Published Apps

```sql
SELECT
  a.api_client_id,
  a.api_key,
  a.app_name,
  p.public_app_name,
  p.publication_state,
  p.pricing_type,
  p.primary_category,
  p.updated_at
FROM `shopify-dw.apps_and_developers.apps` a
JOIN `shopify-dw.apps_and_developers.public_apps` p
  ON a.api_client_id = p.api_client_id
WHERE LOWER(a.app_name) LIKE LOWER('%{{APP_NAME}}%')
  AND NOT a.is_deleted
```

### Get Latest Installation Metrics

```sql
SELECT
  api_client_id,
  snapshot_date,
  active_shop_install_count,
  plus_shop_install_count,
  advanced_shop_install_count,
  affiliate_shop_install_count,
  enterprise_shop_install_count
FROM `shopify-dw.apps_and_developers.app_installs_daily_summary`
WHERE api_client_id = {{API_CLIENT_ID}}
  AND snapshot_date = DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
```

### Get Revenue Data for an App

```sql
SELECT
  api_client_id,
  snapshot_date,
  billing_type,
  revenue_usd,
  charge_count
FROM `shopify-dw.apps_and_developers.app_billings_daily_summary`
WHERE api_client_id = {{API_CLIENT_ID}}
  AND snapshot_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
ORDER BY snapshot_date DESC
```

### Compare Multiple Apps by Partner

```sql
SELECT
  a.api_client_id,
  a.app_name,
  a.distribution_model,
  installs.snapshot_date,
  installs.active_shop_install_count
FROM `shopify-dw.apps_and_developers.apps` a
LEFT JOIN `shopify-dw.apps_and_developers.app_installs_daily_summary` installs
  ON a.api_client_id = installs.api_client_id
WHERE a.partner_id = {{PARTNER_ID}}
  AND NOT a.is_deleted
  AND (installs.snapshot_date = DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
   OR installs.snapshot_date IS NULL)
ORDER BY a.created_at DESC, installs.snapshot_date DESC
```

## Important Gotchas

**Always filter `NOT is_deleted`**
Deleted records remain in tables. Always include `AND NOT is_deleted` in WHERE clauses to avoid stale data.

**Apps have TWO unique identifiers**
- `api_client_id` - Integer, used for installs/billing tables, stable over time
- `api_key` - String, the actual API key, immutable
When joining tables, use the appropriate ID for the context.

**Install counts are point-in-time snapshots**
The `app_installs_daily_summary` table contains one row per app per day. These are snapshots, not cumulative totals. Do NOT sum across dates—use yesterday's date for "current" metrics.

**Publication states are case-sensitive**
Common values: `PUBLISHED`, `REJECTED`, `DRAFT`, `REMOVED`. Use exact case matching or convert to consistent case.

**Billing data is also daily snapshots**
Like install data, use the most recent date available (typically yesterday). Each row represents that day's transactions, not cumulative revenue.

## Tips

- Use `CURRENT_DATE()` to get today's date; subtract 1 day for latest snapshot data
- Join `apps` to `public_apps` only for apps in the App Store (most public apps exist, but not all)
- Filter by `distribution_model` to distinguish between custom apps and marketplace apps
- For abandoned apps, check if `is_published = FALSE` and installs dropped to zero
- Timestamp columns like `created_at` and `updated_at` are UTC

**Source:** Dana (Data Analyst) - Data warehouse schema discovery and testing
