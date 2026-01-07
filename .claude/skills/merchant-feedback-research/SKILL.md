---
name: "Merchant Feedback Research"
description: "Research merchant pain points from support tickets, app reviews, and sales conversations. Use for feature prioritization and understanding merchant needs."
allowed-tools:
  - mcp__scout__search_support_tickets
  - mcp__scout__search_merchant_frustrations
  - mcp__scout__search_app_reviews
  - mcp__scout__search_sales_conversations
  - mcp__scout__search_insights_library
  - mcp__scout__search_reddit
---

# Merchant Feedback Research Skill

Aggregate and analyze merchant pain points from multiple feedback sources using Scout MCP tools.

## Purpose

Systematically research merchant frustrations, support patterns, and product feedback by querying support tickets, app reviews, sales conversations, and internal insights. This skill provides comprehensive merchant understanding for product decisions.

## Primary Agents

- **Quark** (Merchant Expertise) - Merchant advocacy, feedback analysis
- **Monopoly Man** (Business Strategist) - Business impact assessment
- **Oracle** (Research) - Documentation and synthesis

## When to Use

- Understanding merchant pain points
- Validating product ideas with merchant feedback
- Researching feature requests
- Analyzing merchant sentiment
- Investigating support patterns
- Building business cases from merchant data

## Prerequisites

- Access to Scout MCP tools (`mcp__scout__*`)
- Topic or feature to research
- Optional: Merchant segment (GMV, plan, country, tenure)

## Step-by-Step Process

### 1. Define Research Question

Be specific about what you're investigating.

**Good Questions**:
- "What are the top POS frustrations for retail merchants in the US?"
- "Why do new merchants struggle with domains in their first 90 days?"
- "What checkout limitations do Plus merchants report?"

**Bad Questions**:
- "What do merchants want?" (too broad)
- "Is Shopify good?" (not actionable)

### 2. Search Support Tickets

Find support patterns and common issues.

```bash
mcp__scout__search_support_tickets
  search_string: "checkout"
  start_date: "2024-10-01"
  end_date: "2025-01-01"
  min_gmv: 100000
  max_gmv: 5000000
  plan_name: "basic"
  shop_tenure: "First 60 days"
```

**Parameters**:
- `search_string`: Keywords in taxonomy (issue, level_one, level_two)
- `ticket_ids` / `shop_ids`: Specific tickets/shops
- `shop_tenure`: "First 60 days", "60-90 days", "90 days to 1 year", "1+ Year"
- `min_days` / `max_days`: Custom tenure range
- `min_gmv` / `max_gmv`: Revenue range
- `plan_name`: Plan filter (basic, shopify_plus, etc.)
- `country_code`: Country filter (e.g., "US", "FR")
- `rating`: Smiley rating (positive, negative, neutral)

**What to Extract**:
- Ticket frequency by issue
- Common resolution patterns
- Merchant quotes describing pain
- Specific shops to follow up with

### 3. Search Merchant Frustrations

Query aggregated frustration data.

```bash
mcp__scout__search_merchant_frustrations
  search_string: "AND (LOWER(feature) LIKE '%domains%' OR LOWER(problem) LIKE '%domains%')"
  start_date: "2024-10-01"
  end_date: "2025-01-01"
  min_gmv: 0
  max_gmv: 100000
  shop_tenure: "First 60 days"
  component_name: "Sell: Storefronts"
```

**Component Names**:
- App and Partner Ecosystem
- B2B
- Build
- Channels
- Deliver: Fulfillment / Inventory / Orders / Post-fulfillment
- Engage
- Financial Services
- International (Shopify Markets)
- Payments
- Retail / POS
- Sell: Checkout / Merchandising / Storefronts
- Shop
- Support
- Taxes

**What to Extract**:
- Frustration frequency
- GMV segments affected
- Tenure patterns (new vs established)
- Geographic patterns

### 4. Search App Reviews

Find merchant sentiment in app feedback.

```bash
mcp__scout__search_app_reviews
  search_string: "shipping"
  start_date: "2024-10-01"
  end_date: "2025-01-01"
  min_rating: 1
  max_rating: 2
  shopify_developed_only: true
  min_review_length: 100
```

**Parameters**:
- `search_string`: Keywords in app names (auto includes synonyms)
- `app_name`: Specific app filter
- `min_rating` / `max_rating`: Star rating (1-5)
- `shopify_developed_only`: Only Shopify apps (default: true)
- `min_review_length`: Character minimum (default: 50)

**What to Extract**:
- Specific feature requests
- Usability complaints
- Competitor comparisons
- Merchant expectations

### 5. Search Sales Conversations

Get strategic feedback from sales calls.

```bash
mcp__scout__search_sales_conversations
  pain_point_keywords: "(LOWER(merchant_pain_points) LIKE '%checkout%' OR LOWER(merchant_pain_points) LIKE '%payments%')"
  start_date: "2024-10-01"
  end_date: "2025-01-01"
  existing_or_prospect: "Prospect"
  opportunity_result: "closed_won"
  product_list: "Plus"
```

**Parameters**:
- `pain_point_keywords`: SQL LIKE clause for pain points
- `existing_or_prospect`: "Existing" or "Prospect"
- `account_country_code`: Country filter
- `opportunity_result`: "closed_won", "closed_lost", "not_closed"
- `product_list`: Plus, Capital, POS Pro, Payments, etc.
- `shop_plan`: Shopify plan
- `min_gmv_365d` / `max_gmv_365d`: Annual GMV range

**What to Extract**:
- Strategic pain points
- Deal blockers
- Feature gaps causing churn
- Competitive pressures

### 6. Search Insights Library

Query curated product insights from PSN.

```bash
mcp__scout__search_insights_library
  insights_keywords: "AND (LOWER(gi.body) LIKE '%pos%' OR LOWER(gi.body) LIKE '%retail%')"
  date_range: "'2024-01-01' AND CURRENT_DATE()"
  limit: 10
```

**What to Extract**:
- Historical product decisions
- Previous research findings
- Documented merchant patterns
- Strategic insights

### 7. Search Salesforce Product Feedback

Get feedback from commercial interactions.

```bash
mcp__scout__search_salesforce_product_feedback
  feedback_keywords: "(LOWER(feedback) LIKE '%checkout%' OR LOWER(feedback) LIKE '%payments%')"
  country_codes: ["US", "CA"]
  date_range: "DATE_SUB(CURRENT_DATE(), INTERVAL 9 MONTH) AND CURRENT_DATE()"
```

**What to Extract**:
- Direct merchant quotes
- Account context
- Opportunity details
- Feature requests from high-value merchants

### 8. Search Reddit

Find organic merchant discussions.

```bash
mcp__scout__search_reddit
  query: "checkout problems"
  time_filter: "month"
  limit: 5
```

**What to Extract**:
- Unfiltered merchant sentiment
- Community workarounds
- Competitor mentions
- Feature requests

### 9. Synthesize Findings

Aggregate and analyze all sources.

**Quantify Impact**:
- How many merchants affected?
- What's the frequency?
- Which segments are most affected?
- What's the business impact?

**Identify Patterns**:
- Is this a new vs established merchant issue?
- Does it affect specific verticals?
- Is it geographic or plan-specific?
- Are there common workarounds?

**Prioritize by Impact**:

| Pain Point | Frequency | Segment | Business Impact |
|------------|-----------|---------|-----------------|
| Checkout customization limits | 450 tickets | Basic plan | Lost upgrades to Plus |
| POS offline mode reliability | 234 tickets | Retail | Lost sales during outages |
| Domain setup confusion | 189 tickets | First 60 days | Churn risk |

## Common Patterns

### Pattern 1: New Merchant Onboarding Issue

**Research Approach**:
1. Search support tickets with `shop_tenure: "First 60 days"`
2. Filter by `min_days: 0, max_days: 90`
3. Search frustrations with same tenure filter
4. Look for common setup/configuration issues

**Example**: Domain setup confusion in first week

### Pattern 2: Feature Gap for Specific Segment

**Research Approach**:
1. Search sales conversations with `existing_or_prospect: "Prospect"` and `opportunity_result: "closed_lost"`
2. Search Salesforce feedback from high-GMV merchants
3. Identify competitive feature gaps
4. Quantify revenue impact

**Example**: B2B checkout features causing lost deals

### Pattern 3: Emerging Trend

**Research Approach**:
1. Search insights library for historical context
2. Search support tickets over time windows
3. Track frequency changes month-over-month
4. Correlate with product launches or market changes

**Example**: Rising POS mobile payment requests

### Pattern 4: Vertical-Specific Pain

**Research Approach**:
1. Search app reviews for vertical-specific apps
2. Filter support tickets by vertical indicators
3. Search Reddit for industry-specific keywords
4. Look for business model differences

**Example**: Subscription management for DTC brands

## Output Format

```markdown
## Merchant Research: [Topic]

### Research Question
[Specific question being investigated]

### Methodology
**Data Sources**:
- Support tickets (N=1,234)
- Merchant frustrations (N=567)
- App reviews (N=89)
- Sales conversations (N=34)

**Filters Applied**:
- Date range: Oct 2024 - Jan 2025
- Merchant segment: Basic plan, $100K-$5M GMV
- Tenure: First 90 days

### Key Findings

#### 1. [Pain Point Name]
**Frequency**: 450 support tickets in 90 days
**Affected Segment**: New merchants, Basic plan, retail vertical
**Business Impact**: 12% churn in first 30 days

**Merchant Quote**:
> "I can't customize checkout fields without upgrading to Plus.
> My business needs custom options but I can't afford Plus yet."
> — Shop ID 12345, Basic plan, Day 14

**Supporting Evidence**:
- 147 support tickets mention "checkout customization"
- 89 merchant frustrations about "checkout limitations"
- 34 app reviews requesting "custom checkout fields"
- 23 sales conversations cite as blocker to Basic plan

**Current Workarounds**:
- Use third-party apps (limited functionality)
- Upgrade to Plus (cost prohibitive for small shops)
- Manual order editing (poor customer experience)

#### 2. [Second Pain Point]
[Same structure as above]

### Pain Point Matrix

| Pain Point | Frequency | Segment | Severity | Business Impact |
|------------|-----------|---------|----------|-----------------|
| Checkout customization | 450 | Basic, New | High | Churn risk |
| POS offline reliability | 234 | Retail | Medium | Lost sales |
| Domain setup | 189 | First 60 days | Medium | Setup friction |

### Recommendations

**Immediate Actions**:
1. [Quick win with high impact]
2. [Another quick win]

**Strategic Initiatives**:
1. [Longer-term solution]
2. [Another strategic fix]

**Further Research Needed**:
- [ ] Interview 5 affected merchants
- [ ] Analyze competitive offerings
- [ ] Prototype solution for testing

### Supporting Data

**Support Ticket Examples**:
- Ticket #123456: "Can't add custom fields to checkout"
- Ticket #234567: "Need gift message option on Basic plan"
- Ticket #345678: "Checkout form limitations vs competitors"

**Looker Dashboard Links**:
- [Support ticket analysis](#)
- [Merchant frustrations breakdown](#)
- [Sales conversation insights](#)

### Merchant Segments Affected

**By GMV**:
- $0-$100K: 45% of issues
- $100K-$5M: 35% of issues
- $5M+: 20% of issues

**By Tenure**:
- First 60 days: 55%
- 60-90 days: 20%
- 90 days - 1 year: 15%
- 1+ year: 10%

**By Plan**:
- Basic: 60%
- Shopify: 25%
- Advanced: 10%
- Plus: 5%

**By Geography**:
- North America: 55%
- Europe: 25%
- Asia-Pacific: 15%
- Other: 5%
```

## Search Query Best Practices

### Support Tickets
- Use simple keywords, not full sentences
- For new merchants: `min_days=0, max_days=90` is better than `shop_tenure="First 60 days"`
- Combine location + topic: `search_string="domains", country_code="FR"`

### Merchant Frustrations
- Use `component_name` for broad topics (e.g., "Retail / POS")
- Use `search_string` for specific features (e.g., "%barcode scanning%")
- "Big Middle" merchants: `min_gmv=100000, max_gmv=5000000`

### App Reviews
- Keywords auto-expand to synonyms (e.g., "pos" → "point of sale")
- Set `min_review_length=100` to filter low-quality reviews
- Use rating filters for sentiment analysis

### Sales Conversations
- Pain point keywords search merchant_pain_points field
- Use `opportunity_result="closed_lost"` to find deal blockers
- Filter by `product_list` to find upgrade blockers

## Error Handling

### No Results Found
- Broaden search keywords
- Expand date range
- Remove segment filters
- Try synonyms

### Too Many Results
- Add segment filters (GMV, plan, tenure)
- Narrow date range
- Use more specific keywords
- Add rating filters

### Contradictory Data
- Check sample sizes
- Look for segment differences
- Verify time periods align
- Cross-reference with other sources

## Related Skills

- **error-investigation** - Debug specific merchant issues
- **partner-app-data-lookup** - Query BigQuery for quantitative metrics
- **observe-investigate** - Debug production issues affecting merchants

## Checklist

Before starting research:
- [ ] Define specific research question
- [ ] Identify merchant segments to target
- [ ] Determine date range
- [ ] List data sources to query

During research:
- [ ] Search support tickets
- [ ] Search merchant frustrations
- [ ] Search app reviews (if relevant)
- [ ] Search sales conversations (for strategic context)
- [ ] Search insights library (for historical context)
- [ ] Cross-reference findings across sources
- [ ] Extract merchant quotes

After research:
- [ ] Quantify impact (frequency, segments, business metrics)
- [ ] Identify patterns and trends
- [ ] Prioritize pain points by severity
- [ ] Provide actionable recommendations
- [ ] Document merchant quotes as evidence
- [ ] Create data visualization if needed
- [ ] Share Looker dashboard links
