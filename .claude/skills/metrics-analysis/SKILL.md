---
name: "Metrics Analysis"
description: "Query and analyze Prometheus metrics for performance monitoring, capacity planning, and latency analysis. Use for system health checks and performance debugging."
allowed-tools:
  - mcp__observe-mcp__get_observe_metrics_docs
  - mcp__observe-mcp__get_observe_metrics
  - mcp__observe-mcp__get_observe_metric_labels
  - mcp__observe-mcp__instant_metrics_query
  - mcp__observe-mcp__range_metrics_query
---

# Metrics Analysis Skill

Query and analyze Prometheus metrics for performance monitoring, capacity planning, and operational insights.

## Purpose

Systematically query Shopify's Prometheus metrics to analyze system performance, identify trends, debug issues, and plan capacity. This skill provides access to service-level metrics like request rates, latency percentiles, error rates, and resource utilization.

## Primary Agents

- **Morpheus** (Performance Expert) - Performance analysis, optimization
- **Scotty** (DevOps Engineer) - Operational monitoring, alerts
- **TARS** (Data Analyst) - Metric trends, pattern analysis

## When to Use

- Analyzing service performance
- Setting up monitoring and alerts
- Investigating latency spikes
- Capacity planning
- SLO/SLI tracking
- Correlating metrics with errors
- Validating optimization impact

## Prerequisites

- Access to Observe Metrics MCP tools (`mcp__observe-mcp__*`)
- Service name or metric name to query
- Time range for analysis
- Understanding of PromQL basics

## Step-by-Step Process

### 1. Get Metrics Documentation (MANDATORY)

**Always start here** to understand available metrics and query syntax.

```bash
mcp__observe-mcp__get_observe_metrics_docs
```

**Why**: Provides:
- Available metrics and their meanings
- PromQL query syntax
- Aggregation function reference
- Best practices for metric queries

### 2. Search for Relevant Metrics

Find metrics related to your investigation.

```bash
mcp__observe-mcp__get_observe_metrics
  metric_name: "http"
```

**Returns**: List of metrics matching the search pattern
- `http_requests_total` - Total request count
- `http_request_duration_seconds` - Request latency
- `http_requests_in_flight` - Current concurrent requests

**Common Metric Patterns**:
- `*_total` - Counters (always increasing)
- `*_seconds` - Durations/latency
- `*_in_flight` - Current active operations
- `*_created` - Resource creation counters

### 3. Get Metric Labels

Understand how to filter the metric.

```bash
mcp__observe-mcp__get_observe_metric_labels
  metric_name: "http_requests_total"
```

**Returns**: Available labels
- `service` - Service name (e.g., "shopify-production")
- `endpoint` - API endpoint (e.g., "/api/orders/create")
- `method` - HTTP method (GET, POST, etc.)
- `status` - HTTP status code (200, 404, 500, etc.)

### 4. Get Label Values

Find specific values for filtering.

```bash
mcp__observe-mcp__get_observe_metrics_label_values
  metric_name: "http_requests_total"
  label_name: "service"
```

**Returns**: List of service names
- shopify-production
- checkout-service
- orders-api
- payments-gateway

### 5. Query Metrics (Instant)

Get current metric value at a point in time.

```bash
mcp__observe-mcp__instant_metrics_query
  query: 'sum(rate(http_requests_total{service="shopify-production"}[5m]))'
  time: 1704672000  # Unix timestamp (optional, defaults to now)
```

**Use Cases**:
- Current request rate
- Latest error count
- Current resource usage
- Snapshot at specific time

**Important**: Always use aggregation functions (sum, avg, max, etc.)

### 6. Query Metrics (Range)

Get metric values over a time range.

```bash
mcp__observe-mcp__range_metrics_query
  query: 'sum(rate(http_requests_total{service="shopify-production"}[5m]))'
  timeRange: "now-1h"
  step: "1m"
```

**Parameters**:
- `query`: PromQL query string
- `timeRange`: Relative ("now-1h") or absolute ("2025-01-15T10:00:00 to 2025-01-15T11:00:00")
- `step`: Data resolution (e.g., "1m", "5m", "1h")

**Use Cases**:
- Trend analysis over time
- Identifying spikes or drops
- Correlating with deployments
- Performance degradation detection

### 7. Analyze Results

Interpret metric data to answer questions.

**Common Analyses**:

#### Request Rate Analysis
```promql
# Requests per second
sum(rate(http_requests_total{service="shopify-production"}[5m]))

# Requests per second by endpoint
sum(rate(http_requests_total{service="shopify-production"}[5m])) by (endpoint)
```

#### Error Rate Analysis
```promql
# Error rate (percentage)
sum(rate(http_requests_total{service="shopify-production",status=~"5.."}[5m]))
/
sum(rate(http_requests_total{service="shopify-production"}[5m]))
* 100

# Error count by endpoint
sum(rate(http_requests_total{status=~"5.."}[5m])) by (endpoint)
```

#### Latency Analysis
```promql
# P95 latency
histogram_quantile(0.95,
  sum(rate(http_request_duration_seconds_bucket[5m])) by (le)
)

# P50, P95, P99 comparison
histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m])) by (le) or
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) by (le) or
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) by (le)
```

#### Resource Utilization
```promql
# CPU usage
avg(rate(container_cpu_usage_seconds_total{service="shopify-production"}[5m])) * 100

# Memory usage
avg(container_memory_usage_bytes{service="shopify-production"}) / 1024 / 1024 / 1024
```

### 8. Create Alerts

Define alert conditions based on metric thresholds.

**Alert Examples**:

```yaml
# High error rate
alert: HighErrorRate
expr: |
  sum(rate(http_requests_total{status=~"5.."}[5m]))
  /
  sum(rate(http_requests_total[5m]))
  > 0.05  # 5% error rate
for: 5m
severity: critical

# High latency
alert: HighLatency
expr: |
  histogram_quantile(0.95,
    sum(rate(http_request_duration_seconds_bucket[5m])) by (le)
  ) > 1.0  # P95 > 1 second
for: 10m
severity: warning

# High CPU
alert: HighCPU
expr: |
  avg(rate(container_cpu_usage_seconds_total[5m])) > 0.80  # 80% CPU
for: 15m
severity: warning
```

## PromQL Query Patterns

### Rate Calculations

**Counter Metrics** (always use `rate()` or `increase()`):
```promql
# Per-second rate over 5 minutes
rate(http_requests_total[5m])

# Total increase over 1 hour
increase(http_requests_total[1h])
```

**Why**: Counters reset on restart. `rate()` handles resets correctly.

### Aggregation

```promql
# Sum across all instances
sum(rate(http_requests_total[5m]))

# Average across instances
avg(cpu_usage)

# Maximum value
max(memory_usage)

# Minimum value
min(disk_available)

# Count number of instances
count(up{service="shopify-production"})
```

### Grouping

```promql
# Sum by endpoint
sum(rate(http_requests_total[5m])) by (endpoint)

# Average by service
avg(cpu_usage) by (service)

# Error rate by endpoint and status
sum(rate(http_requests_total[5m])) by (endpoint, status)
```

### Filtering

```promql
# Exact match
{service="shopify-production"}

# Regex match
{status=~"5.."}

# Negative match
{endpoint!="/health"}

# Regex negative match
{service!~"test-.*"}

# Multiple conditions
{service="shopify-production",endpoint="/api/orders",status=~"2.."}
```

### Mathematical Operations

```promql
# Calculate percentage
(metric_a / metric_b) * 100

# Ratio
metric_a / metric_b

# Difference
metric_a - metric_b

# Multiplication (e.g., convert to milliseconds)
metric_seconds * 1000
```

### Time Windows

```promql
# 5-minute window
[5m]

# 1-hour window
[1h]

# 1-day window
[1d]
```

### Quantiles (Percentiles)

```promql
# P50 (median)
histogram_quantile(0.50, rate(metric_bucket[5m]))

# P95
histogram_quantile(0.95, rate(metric_bucket[5m]))

# P99
histogram_quantile(0.99, rate(metric_bucket[5m]))

# P99.9
histogram_quantile(0.999, rate(metric_bucket[5m]))
```

## Common Analysis Patterns

### Pattern 1: Service Health Check

**Golden Signals**: Rate, Errors, Duration

```promql
# Traffic (requests per second)
sum(rate(http_requests_total{service="checkout"}[5m]))

# Errors (error percentage)
sum(rate(http_requests_total{service="checkout",status=~"5.."}[5m]))
/ sum(rate(http_requests_total{service="checkout"}[5m]))
* 100

# Duration (P95 latency in ms)
histogram_quantile(0.95,
  rate(http_request_duration_seconds_bucket{service="checkout"}[5m])
) * 1000
```

### Pattern 2: Endpoint Comparison

Compare performance across endpoints.

```promql
# Request rate by endpoint
sum(rate(http_requests_total{service="shopify"}[5m])) by (endpoint)

# Latency by endpoint
histogram_quantile(0.95,
  sum(rate(http_request_duration_seconds_bucket{service="shopify"}[5m])) by (endpoint, le)
)

# Error rate by endpoint
sum(rate(http_requests_total{status=~"5..",service="shopify"}[5m])) by (endpoint)
```

### Pattern 3: Before/After Deployment

Compare metrics before and after a change.

```bash
# Query 1: Before deployment (1 hour ago to 30 min ago)
mcp__observe-mcp__range_metrics_query
  query: 'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))'
  timeRange: "now-1h to now-30m"

# Query 2: After deployment (last 30 minutes)
mcp__observe-mcp__range_metrics_query
  query: 'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))'
  timeRange: "now-30m"
```

**Compare**:
- Did latency increase?
- Did error rate change?
- Did request rate change?

### Pattern 4: Resource Saturation

Identify capacity constraints.

```promql
# CPU near capacity
avg(rate(container_cpu_usage_seconds_total[5m])) > 0.85

# Memory usage trend
avg(container_memory_usage_bytes) / avg(container_memory_limit_bytes)

# Queue depth growing
avg(queue_depth) > 1000

# Connection pool exhaustion
avg(db_connections_active) / avg(db_connections_max) > 0.90
```

### Pattern 5: Correlation Analysis

Correlate metrics to find relationships.

```promql
# Error rate vs request rate
sum(rate(http_requests_total{status=~"5.."}[5m]))
and
sum(rate(http_requests_total[5m])) > 100

# Latency vs CPU
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
and
avg(cpu_usage) > 0.70
```

## Output Format

```markdown
## Metrics Analysis: [Topic]

### Objective
[What you're trying to understand]

### Metrics Queried
**Primary Metrics**:
- `http_requests_total` - Request volume
- `http_request_duration_seconds` - Latency
- `container_cpu_usage_seconds_total` - CPU usage

**Time Range**: Last 24 hours (2025-01-15 00:00 - 2025-01-16 00:00)
**Service**: shopify-production

### Findings

#### 1. Request Volume
**Query**:
```promql
sum(rate(http_requests_total{service="shopify-production"}[5m]))
```

**Results**:
- Baseline: 1,200 req/sec
- Peak: 3,500 req/sec at 14:30 UTC
- Pattern: Traffic spike coincides with flash sale

**Graph**: [Describe trend - steady, spiking, declining]

#### 2. Error Rate
**Query**:
```promql
sum(rate(http_requests_total{status=~"5..",service="shopify-production"}[5m]))
/ sum(rate(http_requests_total{service="shopify-production"}[5m]))
* 100
```

**Results**:
- Baseline: 0.2% error rate
- Spike: 8.5% error rate from 14:32-14:50 UTC
- Correlation: Errors started 2 minutes after traffic spike

**Top Error Endpoints**:
1. `/api/orders/create` - 65% of errors
2. `/api/inventory/check` - 25% of errors
3. `/api/payments/process` - 10% of errors

#### 3. Latency
**Query**:
```promql
histogram_quantile(0.95,
  sum(rate(http_request_duration_seconds_bucket{service="shopify-production"}[5m])) by (le)
)
```

**Results**:
- Baseline P95: 250ms
- Peak P95: 1,850ms at 14:35 UTC
- Current P95: 280ms (recovered)

**Latency by Percentile**:
- P50: 120ms (baseline 100ms)
- P95: 280ms (baseline 250ms)
- P99: 850ms (baseline 500ms)

### Analysis

**Root Cause**:
Database connection pool exhaustion during traffic spike.

**Evidence**:
1. Request rate increased 3x (1,200 → 3,500 req/sec)
2. DB connection pool hit 100% utilization
3. P95 latency spiked to 1,850ms (normal 250ms)
4. Error rate jumped to 8.5% (normal 0.2%)

**Correlation**:
- Traffic spike at 14:30
- Connection pool saturated at 14:31
- Errors started at 14:32
- Latency peak at 14:35

### Recommendations

**Immediate Actions**:
1. Increase DB connection pool from 50 to 100
2. Add connection pool monitoring alert (>80% usage)
3. Implement connection timeout (5s max)

**Long-term Improvements**:
1. Add horizontal scaling trigger (>80% CPU for 5 min)
2. Implement request queueing with backpressure
3. Cache frequent queries (inventory checks)

### Monitoring Setup

**Proposed Alerts**:
```yaml
- alert: HighErrorRate
  expr: error_rate > 5% for 5 minutes
  severity: critical

- alert: HighLatency
  expr: p95_latency > 1000ms for 10 minutes
  severity: warning

- alert: ConnectionPoolHigh
  expr: db_connection_usage > 80% for 5 minutes
  severity: warning
```

### Query Reference

All queries used in this analysis:
```promql
# Request rate
sum(rate(http_requests_total{service="shopify-production"}[5m]))

# Error rate
sum(rate(http_requests_total{status=~"5.."}[5m]))
/ sum(rate(http_requests_total[5m])) * 100

# P95 latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# DB connection usage
avg(db_connections_active) / avg(db_connections_max) * 100
```
```

## Best Practices

1. **Always use aggregation functions** - PromQL requires `sum()`, `avg()`, etc.
2. **Use rate() for counters** - Don't query counter metrics directly
3. **Choose appropriate time windows** - 5m for real-time, 1h for trends
4. **Filter early** - Add label filters to reduce query scope
5. **Use recording rules** - Pre-compute expensive queries
6. **Set reasonable time ranges** - Large ranges are slow
7. **Test queries incrementally** - Build complex queries step by step

## Error Handling

### Query Errors
- **"no data"**: Check metric name, service name, time range
- **"timeout"**: Reduce time range or add more filters
- **"invalid query"**: Verify PromQL syntax, check labels exist

### Missing Metrics
- Verify service is instrumented
- Check data retention period
- Confirm metric name spelling
- Check if metric is deprecated

## Related Skills

- **observe-investigate** - Debug production issues with logs/traces
- **error-investigation** - Systematic error debugging

## Checklist

Before querying:
- [ ] Get metrics documentation (`get_observe_metrics_docs`)
- [ ] Identify relevant metrics (`get_observe_metrics`)
- [ ] Understand metric labels (`get_observe_metric_labels`)
- [ ] Find label values (`get_observe_metrics_label_values`)

During analysis:
- [ ] Use aggregation functions (sum, avg, max)
- [ ] Use rate() for counter metrics
- [ ] Filter by service/endpoint/status
- [ ] Choose appropriate time range
- [ ] Set reasonable step size

After analysis:
- [ ] Document findings with queries
- [ ] Create graphs/visualizations
- [ ] Propose alerts if needed
- [ ] Correlate with other data sources (logs, errors)
- [ ] Make actionable recommendations
