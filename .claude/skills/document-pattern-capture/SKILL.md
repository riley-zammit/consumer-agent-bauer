---
name: "Document Pattern Capture"
description: "Transform agent work into reusable documentation. Use after successful workflows to capture patterns, solutions, and knowledge."
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
---

# Document Pattern Capture Skill

Transform agent work into reusable documentation for the knowledge base.

## Purpose

Systematically capture valuable patterns, solutions, and workflows from agent investigations into well-structured documentation. This skill turns one-time problem-solving into reusable knowledge that benefits future work.

## Primary Agent

- **WALL-E** (Archivist & Documentation) - Knowledge capture, documentation creation

## Supporting Agents

- **Oracle** (Research) - Validate technical accuracy
- **WALL-E** - Format and structure documentation
- **Cortana** - Organize and categorize content

## When to Use

- After solving a complex problem
- When discovering a useful pattern or workflow
- After investigating a production issue
- When creating a new integration
- After debugging a difficult error
- When establishing a best practice
- Following a successful incident response

## Prerequisites

- Completed work or investigation to document
- Access to relevant files, logs, or data
- Understanding of the problem and solution
- Ability to generalize the pattern

## Step-by-Step Process

### 1. Identify Documentation-Worthy Patterns

Not everything needs documentation. Look for:

**High Value Patterns**:
- ✅ Solved a problem that will recur
- ✅ Discovered a non-obvious solution
- ✅ Created a reusable workflow
- ✅ Found a common pitfall and fix
- ✅ Documented a poorly-explained API

**Low Value Patterns**:
- ❌ One-time unique situation
- ❌ Obvious or well-documented solution
- ❌ Temporary workaround
- ❌ Highly specific to one context

**Example Good Patterns**:
- "How to debug slow BigQuery queries with partition filters"
- "Common Shopify webhook signature validation errors"
- "Setting up CI/CD for Shopify apps with GitHub Actions"

**Example Poor Patterns**:
- "Fixed typo in config file" (too simple)
- "Emergency hotfix for one shop" (not generalizable)

### 2. Extract Core Information

Gather the essential components.

**What to Extract**:
- Problem statement (what was wrong?)
- Context (when does this occur?)
- Investigation steps (how did you find it?)
- Root cause (why did it happen?)
- Solution (how was it fixed?)
- Prevention (how to avoid it?)
- Related resources (docs, tools, code)

**Template**:
```markdown
## Problem
[Clear statement of the issue]

## Context
When: [Conditions when this occurs]
Environment: [Where it happens]
Frequency: [How often it occurs]

## Investigation
Steps taken to identify the issue:
1. [Step 1]
2. [Step 2]
3. [Finding]

## Root Cause
[Technical explanation of why it happens]

## Solution
[How to fix it with code/config examples]

## Prevention
[How to avoid this in the future]

## Related
- [Documentation link]
- [Tool link]
- [Similar pattern]
```

### 3. Generalize the Pattern

Remove specifics, focus on the reusable pattern.

**Before (Specific)**:
```markdown
Shop ID 123456 had a checkout error at 2pm on Jan 15
because the payment gateway was down for maintenance.
I manually refunded the orders and notified the shop.
```

**After (Generalized)**:
```markdown
## Pattern: Payment Gateway Downtime

When external payment gateways have maintenance windows,
orders can fail at checkout with "Payment processing failed" errors.

**Detection**: Monitor gateway health endpoints and error rates

**Resolution**:
1. Verify gateway status page
2. Enable backup payment method if available
3. Queue failed orders for retry
4. Communicate expected resolution time to merchants

**Prevention**:
- Subscribe to gateway maintenance notifications
- Implement automatic failover to backup gateway
- Set up circuit breaker for repeated failures
```

### 4. Structure the Documentation

Organize information for findability and usability.

**Documentation Types**:

#### Pattern: Reusable Workflow
```markdown
# Pattern: [Pattern Name]

## Overview
Brief description of the pattern and when to use it.

## Problem
What problem does this solve?

## Solution
Step-by-step implementation.

## Example
Concrete example with code.

## When NOT to Use
Situations where this pattern doesn't apply.

## Related Patterns
- Link to similar patterns
```

#### Runbook: Operational Procedure
```markdown
# Runbook: [Procedure Name]

## Purpose
What this runbook accomplishes.

## When to Use
Triggering conditions or scenarios.

## Prerequisites
What you need before starting.

## Steps
1. [Action 1]
   - Command: `...`
   - Expected result: ...
2. [Action 2]
3. [Action 3]

## Verification
How to confirm it worked.

## Rollback
What to do if something goes wrong.

## Related
- Monitoring dashboard
- Alert definition
```

#### Guide: How-To Tutorial
```markdown
# Guide: How to [Task]

## Objective
What you'll accomplish by following this guide.

## Prerequisites
- Required tools
- Required access
- Required knowledge

## Step-by-Step Instructions

### Step 1: [Action]
[Detailed instructions with commands/code]

```bash
# Example command
shopify app dev
```

### Step 2: [Action]
[More instructions]

## Verification
How to confirm it's working.

## Troubleshooting
Common issues and solutions.

## Next Steps
What to do after completing this guide.
```

#### Reference: Quick Lookup
```markdown
# Reference: [Topic]

## Quick Links
- [Important URL 1]
- [Important URL 2]

## Commands
```bash
# Common command 1
command --flag value

# Common command 2
other-command
```

## Configuration
```yaml
key: value
option: setting
```

## Examples
Common usage examples.

## FAQs
Q: [Question]?
A: [Answer]
```

### 5. Choose the Right Location

Store documentation where it will be found.

**File Storage Conventions** (from ~/AI/AI Guides & Knowledge/FILE_STORAGE_CONVENTIONS.md):

```
~/AI/AI Guides & Knowledge/
├── API Reference/
│   └── Shopify/
│       ├── Admin API/
│       ├── Storefront API/
│       └── Test Environment/
├── Guides & How-Tos/
│   ├── Debugging/
│   ├── Development/
│   └── Operations/
├── Patterns & Best Practices/
│   ├── Code Patterns/
│   ├── Architecture/
│   └── Workflows/
├── Troubleshooting/
│   ├── Common Errors/
│   └── Production Issues/
└── Tools & Setup/
    ├── CLI Tools/
    └── Development Environment/
```

**Decision Tree**:
- API behavior or reference → `/API Reference/`
- Step-by-step tutorial → `/Guides & How-Tos/`
- Reusable pattern → `/Patterns & Best Practices/`
- Error fix or debugging → `/Troubleshooting/`
- Tool setup or configuration → `/Tools & Setup/`

### 6. Write Clear Examples

Include concrete, runnable examples.

**Good Example**:
```markdown
## Example: Query BigQuery for Merchant GMV

```bash
mcp__data-portal__query_bigquery
  query: "
    SELECT
      shop_id,
      SUM(order_total) as total_gmv
    FROM `shopify-dw.orders.fact_orders`
    WHERE order_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
    GROUP BY shop_id
    ORDER BY total_gmv DESC
    LIMIT 10
  "
  timeRange: "now-90d"
```

**Expected Result**:
| shop_id | total_gmv |
|---------|-----------|
| 12345   | 1,250,000 |
| 67890   | 987,500   |
| ...     | ...       |
```

**Bad Example**:
```markdown
Query BigQuery to get GMV. Use the query tool with SQL.
```

### 7. Add Cross-References

Link to related documentation.

**Good Cross-References**:
```markdown
## Related Documentation
- [BigQuery Query Optimization](../Patterns/bigquery-optimization.md)
- [Data Warehouse Schema](../../API Reference/Shopify/Data Platform/schema.md)
- [Error Investigation Skill](../../skills/error-investigation/SKILL.md)

## Related Tools
- BigQuery Console: https://console.cloud.google.com/bigquery
- Data Platform MCP: `mcp__data-portal__*` tools

## See Also
- For real-time metrics, see [Metrics Analysis Skill](../skills/metrics-analysis/SKILL.md)
- For production debugging, see [Observe Investigate Skill](../skills/observe-investigate/SKILL.md)
```

### 8. Review and Validate

Ensure documentation is accurate and useful.

**Validation Checklist**:
- [ ] Problem statement is clear
- [ ] Solution is complete and runnable
- [ ] Examples are tested and work
- [ ] Cross-references are correct
- [ ] Grammar and spelling are correct
- [ ] Formatting is consistent
- [ ] Code blocks have syntax highlighting
- [ ] Commands are copy-pasteable

**Test the Documentation**:
- Can someone follow it without help?
- Are commands correct and complete?
- Do examples produce expected results?
- Are prerequisites clearly stated?

### 9. Integrate into Knowledge Base

Make documentation discoverable.

**Actions**:
1. Add to relevant index file
2. Update cross-references in related docs
3. Tag with relevant keywords
4. Add to agent skill references if applicable

**Example Index Update**:
```markdown
# Troubleshooting Index

## Production Errors
- [Database Connection Timeout](Common Errors/db-connection-timeout.md) ← NEW
- [API Rate Limit Exceeded](Common Errors/rate-limit.md)
- [Webhook Signature Validation](Common Errors/webhook-signature.md)
```

### 10. Maintain and Update

Keep documentation current.

**Maintenance Tasks**:
- Update examples when APIs change
- Add new edge cases as discovered
- Fix errors reported by users
- Archive outdated patterns
- Consolidate duplicates

**Deprecation Notice**:
```markdown
> **⚠️ Deprecated**: This pattern is outdated as of 2025-01.
> Use [New Pattern](../new-pattern.md) instead.
```

## Documentation Templates

### Investigation Report Template
```markdown
# Investigation: [Issue Name]

**Date**: 2025-01-15
**Investigator**: [Agent Name]
**Duration**: [Time spent]

## Summary
One-paragraph summary of the issue and resolution.

## Timeline
- **14:30** - Issue reported
- **14:35** - Investigation started
- **14:45** - Root cause identified
- **15:00** - Fix deployed
- **15:10** - Verified resolution

## Problem
Detailed description of the problem.

## Investigation Steps
1. [What was checked]
2. [Tool used / data gathered]
3. [Finding]

## Root Cause
Technical explanation of why it happened.

## Solution
How it was fixed, with code/config changes.

## Prevention
- [ ] Action item to prevent recurrence
- [ ] Monitoring to detect early
- [ ] Documentation to update

## Lessons Learned
What was learned from this investigation.
```

### API Pattern Template
```markdown
# Pattern: [API Operation Name]

## Overview
What this API pattern accomplishes.

## Use Cases
- Use case 1
- Use case 2

## Prerequisites
- Required scopes
- Required data

## Implementation

### Step 1: [Action]
```graphql
query {
  # Example query
}
```

### Step 2: [Action]
```javascript
// Example code
```

## Error Handling
Common errors and how to handle them.

## Rate Limits
- Operation: X requests per second
- Mitigation: [Strategy]

## Testing
How to test this pattern.

## Examples
Real-world example implementations.

## Related
- API Reference
- Related patterns
```

## Best Practices

1. **Write for Future You** - Assume you'll forget the context
2. **Be Specific** - Include exact commands, not approximations
3. **Test Examples** - Verify code runs before documenting
4. **Explain Why** - Not just what and how, but why
5. **Keep Updated** - Review and update regularly
6. **Use Templates** - Consistent structure aids comprehension
7. **Link Liberally** - Cross-reference related content
8. **Show Errors** - Document common mistakes and fixes

## Output Format

```markdown
# [Document Title]

**Created**: 2025-01-15
**Author**: WALL-E (via agent workflow)
**Category**: [Pattern/Runbook/Guide/Reference]

## Overview
Brief summary of what this document covers.

## [Section 1]
Content...

## [Section 2]
Content...

## Code Examples
```language
# Runnable example
```

## Verification
How to verify it works.

## Troubleshooting
| Error | Cause | Solution |
|-------|-------|----------|
| ... | ... | ... |

## Related Documentation
- [Link 1](path)
- [Link 2](path)

---
**Last Updated**: 2025-01-15
**Validated**: ✅ Tested and working
```

## Related Skills

- **error-investigation** - Provides investigation reports to document
- **observe-investigate** - Production debugging to document
- **merchant-feedback-research** - Research findings to document

## Checklist

Before capturing:
- [ ] Verify pattern is reusable (not one-time)
- [ ] Confirm solution is correct
- [ ] Test examples work
- [ ] Gather all relevant information

During capture:
- [ ] Extract core information (problem, solution, prevention)
- [ ] Generalize from specific case to pattern
- [ ] Structure using appropriate template
- [ ] Write clear, runnable examples
- [ ] Add cross-references
- [ ] Use consistent formatting

After capture:
- [ ] Review for accuracy and completeness
- [ ] Test documentation by following it
- [ ] Integrate into knowledge base
- [ ] Update indexes and cross-references
- [ ] Tag with relevant keywords

Maintenance:
- [ ] Schedule regular review (quarterly)
- [ ] Update when APIs change
- [ ] Archive outdated content
- [ ] Consolidate duplicates
