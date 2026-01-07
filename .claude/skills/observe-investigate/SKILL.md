---
name: "Observe Investigate"
description: "Debug production issues using Observe logs, traces, and error analytics. Use this for production errors, performance issues, and incident investigation."
allowed-tools:
  - mcp__observe-mcp__get_observe_ai_docs
  - mcp__observe-mcp__get_investigate_query_docs
  - mcp__observe-mcp__get_error_groups
  - mcp__observe-mcp__get_error_group_by_grouping_hash
  - mcp__observe-mcp__query_dataset
  - mcp__observe-mcp__get_observe_metrics
  - mcp__observe-mcp__range_metrics_query
---

# Observe Investigate Skill

Debug production issues using Observe logs, traces, and error analytics.

## Purpose

Systematically investigate production errors, performance issues, and operational problems using Shopify's Observe platform. This skill combines error group analysis, trace investigation, and log correlation to identify root causes.

## Primary Agents

- **Scotty** (DevOps Engineer) - Production debugging, incident response
- **Morpheus** (Performance Expert) - Performance analysis, latency investigation
- **TARS** (Data Analyst) - Log pattern analysis, metric correlation

## When to Use

- Production errors or 500s
- Performance degradation or latency spikes
- Service outages or downtime
- Debugging specific error groups
- Investigating trace IDs from alerts
- Correlating errors with deployments

## Prerequisites

- Access to Observe MCP tools
- Service name (e.g., "shopify-production")
- Time range for investigation
- Optional: Specific error hashes or trace IDs

## Step-by-Step Process

### 1. Get Observe Documentation (MANDATORY)

**Always start here** to understand available datasets and query syntax.

```bash
# Get general Observe docs
mcp__observe-mcp__get_observe_ai_docs

# Get query syntax reference
mcp__observe-mcp__get_investigate_query_docs
```

**Why**: Provides dataset schemas, query examples, and best practices. Required before any other Observe queries.

### 2. Identify Error Groups

Find the most frequent errors in the timeframe.

```bash
mcp__observe-mcp__get_error_groups
  service: ["shopify-production"]
  timeRange: "now-1h"  # or "2025-01-15T14:00:00/2025-01-15T15:00:00"
```

**Expected Output**:
- List of error groups with occurrence counts
- Grouping hash for each error
- Service and slice information
- Time of first occurrence

**Analysis Questions**:
- Which error is most frequent?
- Did errors start after a deployment?
- Are errors isolated to specific slices?
- Is error rate increasing or stable?

### 3. Investigate Specific Error

Get detailed information about the top error group.

```bash
mcp__observe-mcp__get_error_group_by_grouping_hash
  grouping_hash_resolved: "abc123def456"
  timeRange: "now-4h"
```

**Expected Output**:
- Full stack trace
- Error message and type
- Affected endpoints/functions
- Sample error events with trace IDs
- Error status (open, resolved, muted)

**Look For**:
- Common patterns in error events
- Specific request parameters causing failures
- Correlation with user segments or shops
- Trace IDs for detailed investigation

### 4. Query Trace Dataset

Use trace IDs from errors to get full request context.

```bash
mcp__observe-mcp__query_dataset
  query:
    datasets: ["trace"]
    filters: [
      {column: "service", op: "=", value: "shopify-production"},
      {column: "trace_id", op: "=", value: "789xyz"}
    ]
    timeRange: "now-1h"
    result_type: "summary"
```

**Expected Output**:
- Full trace duration breakdown
- Span timings (database, API calls, business logic)
- Request headers and parameters
- Parent/child span relationships

**Analysis**:
- Where is time spent in the request?
- Are external API calls timing out?
- Is database query slow?
- What's the error propagation path?

### 5. Query Core Logs

Get related log events for additional context.

```bash
mcp__observe-mcp__query_dataset
  query:
    datasets: ["core"]
    filters: [
      {column: "component", op: "=", value: "platform"},
      {column: "name", op: "=", value: "http_request_finish"},
      {column: "trace_id", op: "=", value: "789xyz"}
    ]
    timeRange: "now-1h"
```

**Expected Output**:
- HTTP request/response logs
- Business logic logs
- Database query logs
- External API interaction logs

**Correlation**:
- Match log timestamps with trace spans
- Identify error propagation sequence
- Find warnings before errors
- Detect resource exhaustion

### 6. Analyze Root Cause

Synthesize findings to identify the root cause.

**Common Patterns**:

| Symptom | Likely Cause | Validation |
|---------|-------------|------------|
| Timeout errors + slow DB queries | Missing index, N+1 query | Check query explain plan |
| Sudden error spike at specific time | Recent deployment | Check deploy logs at spike time |
| Errors for specific shops | Shop-specific data issue | Query those shop IDs |
| Memory errors + high traffic | Resource exhaustion | Check container metrics |
| External API errors | Third-party service degradation | Check external status pages |

### 7. Document Findings

Create incident report with timeline and resolution.

**Template**:

```markdown
## Incident Report: [Error Description]

### Timeline
- **14:25 UTC** - Deploy v2.3.4
- **14:32 UTC** - Error rate spike to 45%
- **14:35 UTC** - Investigation started
- **14:42 UTC** - Root cause identified
- **14:47 UTC** - Fix deployed
- **14:50 UTC** - Error rate back to baseline

### Root Cause
[Specific technical explanation]

### Evidence
- Error group: [grouping hash]
- Trace analysis: [key findings]
- Log correlation: [relevant logs]

### Resolution
**Immediate Fix**: [What was done to stop the bleeding]
**Long-term Fix**: [Permanent solution]

### Prevention
- [ ] Action item 1
- [ ] Action item 2
- [ ] Update runbook
```

## Common Patterns

### Pattern 1: Database Connection Exhaustion

**Symptoms**:
- "Connection timeout" errors
- Spike in error rate
- Slow response times

**Investigation**:
1. Get error group for "connection timeout"
2. Check trace duration (should be unusually high)
3. Query logs for database connection pool metrics
4. Correlate with traffic spike or deployment

**Resolution**:
- Increase connection pool size
- Fix long-running queries
- Add connection pool monitoring

### Pattern 2: Downstream Service Failure

**Symptoms**:
- External API error messages
- Timeout on specific endpoints
- Error rate matches downstream SLA

**Investigation**:
1. Identify error group mentioning external service
2. Get trace showing external call timing out
3. Check external service status page
4. Verify retry/fallback logic

**Resolution**:
- Add circuit breaker
- Implement retry with backoff
- Add fallback behavior

### Pattern 3: Memory Leak

**Symptoms**:
- Gradual error rate increase
- Out of memory errors
- Container restarts

**Investigation**:
1. Get error groups for OOM errors
2. Query memory metrics over time
3. Correlate with traffic patterns
4. Check for resource cleanup

**Resolution**:
- Fix resource leaks
- Increase memory limits
- Add memory monitoring alerts

## Error Handling

### If Observe is Down
- Check status page: status.observe.com
- Use backup monitoring (Prometheus, CloudWatch)
- Escalate to Observe team if critical

### If No Data Found
- Verify service name is correct
- Check time range (may be too narrow/wide)
- Confirm service is instrumented
- Check data retention policies

### If Query Times Out
- Reduce time range
- Add more specific filters
- Use summary instead of raw data
- Query in smaller chunks

## Output Format

```markdown
## Production Investigation: [Issue]

### Summary
**Error**: [Error type and message]
**Impact**: [Number of requests, % of traffic]
**Duration**: [When started, when resolved]
**Service**: [Service name]

### Evidence

**Error Group** (hash: abc123):
- Frequency: 1,247 occurrences
- First seen: 14:32 UTC
- Stack trace:
  ```
  Error: Connection timeout
    at pool.connect (pool.js:123)
    at OrderController.create (orders.js:45)
  ```

**Trace Analysis** (trace_id: 789xyz):
- Total duration: 5,234ms (normal: ~200ms)
- Database query: 5,100ms (TIMEOUT)
- API call: 134ms

**Log Correlation**:
- Connection pool at 100% utilization
- No available connections for 3 seconds
- Spike started after deploy at 14:25 UTC

### Root Cause
Database connection pool exhausted due to:
1. Long-running query introduced in recent deploy
2. Query missing index on `orders.created_at`
3. Connection pool limit (20) insufficient for traffic

### Resolution
**Immediate**: Increased pool to 50, rolled back deploy
**Long-term**: Add index, implement query timeout, add pool monitoring

### Prevention
- [ ] Require query review before production deploy
- [ ] Add connection pool usage alert (>80%)
- [ ] Implement automatic query timeout (2s)
- [ ] Update deployment runbook
```

## Related Skills

- **error-investigation** - Broader error debugging workflow
- **metrics-analysis** - Query Prometheus metrics
- **partner-app-data-lookup** - Query BigQuery for historical data

## Best Practices

1. **Always get docs first** - `get_observe_ai_docs` and `get_investigate_query_docs` are mandatory
2. **Start broad, then narrow** - Get error groups before specific traces
3. **Correlate multiple sources** - Errors + traces + logs + metrics
4. **Document as you investigate** - Don't rely on memory
5. **Look for patterns** - Single errors are noise, patterns are signals
6. **Check recent changes** - Most production issues follow deployments
7. **Use proper time ranges** - Too narrow misses context, too wide is slow

## Tool Reference

| Tool | Purpose | Required Parameters |
|------|---------|---------------------|
| `get_observe_ai_docs` | Get Observe documentation | None (call first!) |
| `get_investigate_query_docs` | Get query syntax reference | None |
| `get_error_groups` | List error groups | service, timeRange |
| `get_error_group_by_grouping_hash` | Get error details | grouping_hash_resolved |
| `query_dataset` | Query logs/traces | query (with datasets, filters) |
| `get_observe_metrics` | List available metrics | metric_name (optional) |
| `range_metrics_query` | Query metrics over time | query (PromQL), timeRange |

## Example Commands

```bash
# Get all errors for service in last hour
mcp__observe-mcp__get_error_groups \
  service=["shopify-production"] \
  timeRange="now-1h"

# Get specific error details
mcp__observe-mcp__get_error_group_by_grouping_hash \
  grouping_hash_resolved="a1b2c3d4e5f6" \
  timeRange="now-4h"

# Query trace by ID
mcp__observe-mcp__query_dataset \
  query='{"datasets":["trace"],"filters":[{"column":"trace_id","op":"=","value":"789xyz"}],"timeRange":"now-1h"}'

# Query HTTP request logs
mcp__observe-mcp__query_dataset \
  query='{"datasets":["core"],"filters":[{"column":"component","op":"=","value":"platform"},{"column":"name","op":"=","value":"http_request_finish"}],"timeRange":"now-1h"}'
```

## Checklist

Before starting investigation:
- [ ] Get Observe docs (`get_observe_ai_docs`)
- [ ] Get query syntax (`get_investigate_query_docs`)
- [ ] Have service name
- [ ] Have time range for investigation
- [ ] Have incident severity assessment

During investigation:
- [ ] Get error groups
- [ ] Identify most frequent error
- [ ] Get error group details with stack trace
- [ ] Extract trace IDs from error events
- [ ] Query trace dataset for timing breakdown
- [ ] Query core logs for additional context
- [ ] Correlate with recent deployments
- [ ] Check for related metric anomalies

After investigation:
- [ ] Document root cause with evidence
- [ ] Propose immediate mitigation
- [ ] Propose long-term fix
- [ ] Create prevention action items
- [ ] Update runbook if needed
- [ ] Set up monitoring to prevent recurrence
