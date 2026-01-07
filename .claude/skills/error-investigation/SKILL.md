---
name: "Error Investigation"
description: "Systematically investigate and resolve application errors. Use for debugging production issues, recurring errors, and system failures."
allowed-tools:
  - mcp__observe-mcp__get_error_groups
  - mcp__observe-mcp__get_error_group_by_grouping_hash
  - mcp__observe-mcp__query_dataset
  - Grep
  - Read
  - Bash
---

# Error Investigation Skill

Systematically investigate and resolve application errors using a structured debugging approach.

## Purpose

Debug errors efficiently by following a consistent investigation protocol that combines code analysis, log review, reproduction testing, and root cause identification. This skill applies to any error type: runtime exceptions, API failures, UI bugs, or data inconsistencies.

## Primary Agents

- **Chaos Monkey** (QA Engineer) - Test reproduction, regression analysis
- **Scotty** (DevOps Engineer) - Production errors, operational issues
- **Morpheus** (Performance Expert) - Performance-related errors
- **Architect** (Technical Architect) - Complex system errors

## When to Use

- Application crashes or exceptions
- API request failures
- UI rendering errors
- Data validation failures
- Integration errors
- Unexpected behavior or bugs
- Regression after deployment

## Prerequisites

- Error message or exception details
- Stack trace (if available)
- Steps to reproduce (optional but helpful)
- Access to relevant logs and code

## Step-by-Step Process

### 1. Gather Error Context

Collect all available information about the error.

**What to Gather**:
- Error message and exception type
- Full stack trace
- Timestamp when error occurred
- Affected component/module
- User actions leading to error
- Environment (production, staging, local)
- Recent changes (deployments, config updates)

**Example**:
```
Error: TypeError: Cannot read property 'id' of undefined
  at processOrder (services/orders.js:156)
  at OrderController.create (controllers/orders.js:42)

Occurred: 2025-01-15 14:32:45 UTC
Environment: Production
Frequency: 89 occurrences in 20 minutes
Deployment: v2.3.4 deployed 14:25 UTC
```

### 2. Reproduce the Error

Attempt to recreate the error in a controlled environment.

**Steps**:
1. Set up test environment matching production
2. Follow steps that triggered the error
3. Verify error occurs consistently
4. Document exact reproduction steps
5. Note any variations or edge cases

**If Can't Reproduce**:
- Check environment differences (data, config, version)
- Review timing/race conditions
- Check for environmental dependencies
- Look for intermittent issues

### 3. Read the Code

Examine the code where the error occurs.

**File**: `services/orders.js:156`
```javascript
function processOrder(order) {
  const customerId = order.customer.id;  // ← Line 156: Error here
  // ...
}
```

**Questions to Ask**:
- What is the code trying to do?
- What assumptions does it make?
- Under what conditions would it fail?
- Is there missing null checking?
- Are there type mismatches?

### 4. Trace the Data Flow

Follow data from input to error point.

**Example Trace**:
```
1. POST /api/orders/create (controller/orders.js:42)
   ↓
2. OrderController.create() validates request
   ↓
3. Calls processOrder(order) (services/orders.js:156)
   ↓
4. Attempts to access order.customer.id
   ↓
5. ERROR: order.customer is null/undefined
```

**Look For**:
- Where does data originate?
- What transformations occur?
- Where could null/undefined be introduced?
- Are there missing validation steps?

### 5. Check Logs and Monitoring

Review logs around the error time.

**Production Logs** (if available):
```bash
# Using Observe (see observe-investigate skill)
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

**Local Logs**:
```bash
# Grep for error patterns
grep -A 5 "Cannot read property 'id' of undefined" logs/app.log
```

**What to Look For**:
- Request parameters
- Preceding warnings
- Related errors
- Timing information

### 6. Identify Root Cause

Synthesize findings to determine why the error occurs.

**Common Root Causes**:

| Error Type | Typical Causes |
|------------|----------------|
| TypeError: Cannot read property 'X' of undefined | Missing null check, data not loaded, API returned null |
| ReferenceError: X is not defined | Variable not declared, scope issue, import missing |
| SyntaxError | Code typo, invalid syntax, version mismatch |
| Network/API errors | Service down, timeout, rate limit, auth failure |
| Database errors | Query syntax, constraint violation, connection issue |
| Race condition | Async timing, state mutation, concurrent access |

**Example Root Cause**:
```
Order.customer is null when orders are created via guest checkout.
Code assumes customer object always exists but doesn't handle guest orders.
```

### 7. Develop Fix

Create a solution that addresses the root cause.

**Example Fix**:
```javascript
// Before (broken):
function processOrder(order) {
  const customerId = order.customer.id;
  // ...
}

// After (fixed):
function processOrder(order) {
  const customerId = order.customer?.id || 'guest';
  // ... handle guest orders
}
```

**Fix Checklist**:
- [ ] Addresses root cause (not just symptoms)
- [ ] Handles edge cases
- [ ] Doesn't introduce new issues
- [ ] Follows coding standards
- [ ] Includes error handling

### 8. Test the Fix

Verify the fix resolves the error.

**Testing Steps**:
1. Apply fix in local/test environment
2. Reproduce original error scenario → Should now work
3. Test edge cases (null, empty, invalid data)
4. Run existing test suite → Should pass
5. Test related functionality → Should not break

**Test Cases to Add**:
```javascript
describe('processOrder', () => {
  it('handles guest checkout orders', () => {
    const guestOrder = { customer: null, items: [...] };
    expect(() => processOrder(guestOrder)).not.toThrow();
  });

  it('handles registered customer orders', () => {
    const customerOrder = { customer: { id: 123 }, items: [...] };
    const result = processOrder(customerOrder);
    expect(result.customerId).toBe(123);
  });
});
```

### 9. Deploy and Monitor

Roll out fix with monitoring to catch regressions.

**Deployment**:
1. Create fix branch and PR
2. Code review with focus on edge cases
3. Deploy to staging, verify fix
4. Deploy to production with monitoring

**Monitoring**:
```bash
# Watch error rates
mcp__observe-mcp__range_metrics_query
  query: 'rate(error_count{service="orders"}[5m])'
  timeRange: "now-1h"
```

**Success Criteria**:
- Error occurrence drops to zero
- No new errors introduced
- Performance not degraded
- Related functionality works

### 10. Document the Issue

Create documentation to prevent recurrence.

**Template**:
```markdown
## Bug Fix: [Error Description]

### Issue
**Error**: TypeError: Cannot read property 'id' of undefined
**Affected**: POST /api/orders/create
**Frequency**: 89 occurrences in 20 minutes
**Impact**: Guest checkout orders failing

### Root Cause
Code assumed `order.customer` always exists but didn't handle guest checkout
orders where customer is null.

### Solution
Added null-safe customer ID access with fallback to 'guest':
```javascript
const customerId = order.customer?.id || 'guest';
```

### Prevention
- Added test cases for guest checkout
- Updated validation to check customer presence
- Added type definitions requiring customer check

### Related Issues
- Similar pattern in processRefund() - fixed preemptively
```

## Common Debugging Patterns

### Pattern 1: Null Pointer / Undefined Reference

**Symptoms**:
- TypeError: Cannot read property 'X' of undefined
- TypeError: Cannot read property 'X' of null

**Investigation**:
1. Find where variable is supposed to be set
2. Check if API can return null/undefined
3. Look for async timing issues
4. Check conditional logic

**Fix**:
- Add null checks: `if (obj) { ... }`
- Use optional chaining: `obj?.property`
- Provide defaults: `obj?.property || defaultValue`

### Pattern 2: Async Race Condition

**Symptoms**:
- Intermittent failures
- Works sometimes, fails other times
- Error depends on timing

**Investigation**:
1. Look for async operations (promises, setTimeout)
2. Check if state is accessed before ready
3. Look for missing await keywords
4. Check for concurrent modifications

**Fix**:
- Add proper await keywords
- Use Promise.all for parallel operations
- Add loading states
- Use locks/semaphores for critical sections

### Pattern 3: Type Mismatch

**Symptoms**:
- Unexpected behavior with type coercion
- Operations on wrong type

**Investigation**:
1. Check input validation
2. Look for loose equality (==) instead of strict (===)
3. Check API response types
4. Look for implicit conversions

**Fix**:
- Add type validation
- Use strict equality
- Add TypeScript or PropTypes
- Validate API responses

### Pattern 4: API / Network Error

**Symptoms**:
- 500, 404, 401 errors
- Timeout errors
- Connection refused

**Investigation**:
1. Check API endpoint and method
2. Verify authentication/authorization
3. Check request payload format
4. Review API rate limits
5. Check network connectivity

**Fix**:
- Correct endpoint/method
- Add/refresh auth tokens
- Fix payload format
- Implement retry logic
- Add error handling

## Debugging Tools

### Code Analysis
```bash
# Find where function is called
grep -r "processOrder" src/

# Find variable usage
grep -r "order.customer" src/

# Find recent changes
git log -p -- services/orders.js
```

### Runtime Debugging
```javascript
// Console logging
console.log('Order:', JSON.stringify(order, null, 2));

// Debugger breakpoint
debugger;

// Conditional breakpoint
if (order.customer === null) debugger;
```

### Production Debugging
```bash
# Query error logs
mcp__observe-mcp__get_error_groups
  service: ["shopify-production"]
  timeRange: "now-1h"

# Get stack traces
mcp__observe-mcp__get_error_group_by_grouping_hash
  grouping_hash_resolved: "abc123"

# Query metrics
mcp__observe-mcp__range_metrics_query
  query: 'rate(http_requests_total{status=~"5.."}[5m])'
```

## Error Handling Best Practices

1. **Validate Early**: Check inputs at entry points
2. **Fail Fast**: Detect errors as soon as possible
3. **Provide Context**: Include helpful error messages
4. **Handle Gracefully**: Don't crash, show user-friendly errors
5. **Log Thoroughly**: Include context for debugging
6. **Monitor Proactively**: Alert before users report
7. **Test Edge Cases**: Null, empty, invalid, extreme values

## Output Format

```markdown
## Error Investigation: [Error Type]

### Error Details
**Message**: [Error message]
**Location**: [File:Line]
**Frequency**: [How often it occurs]
**Environment**: [Production/Staging/Local]

### Reproduction Steps
1. [Step 1]
2. [Step 2]
3. [Error occurs]

### Code Analysis
**File**: `services/orders.js:156`
```javascript
// Problematic code
const customerId = order.customer.id;
```

**Issue**: Assumes customer always exists

### Data Flow
1. POST /api/orders/create
2. Validation (missing customer check)
3. processOrder() called
4. ERROR: customer is null

### Root Cause
Guest checkout orders have `customer: null` but code doesn't handle this case.

### Solution
```javascript
// Fixed code
const customerId = order.customer?.id || 'guest';
```

### Testing
- [x] Tested with guest order → Works
- [x] Tested with customer order → Works
- [x] Added test case for guest checkout
- [x] All existing tests pass

### Deployment
- PR #1234: https://github.com/...
- Deployed: 2025-01-15 15:30 UTC
- Monitoring: Error rate dropped to 0

### Prevention
- Added validation for customer presence
- Created test cases for guest checkout
- Updated coding guidelines
```

## Related Skills

- **observe-investigate** - Debug production errors with Observe
- **metrics-analysis** - Query metrics to find performance issues

## Checklist

Investigation phase:
- [ ] Gather error message and stack trace
- [ ] Note when error started (correlate with deployments)
- [ ] Attempt to reproduce in test environment
- [ ] Read code at error location
- [ ] Trace data flow to error point
- [ ] Check logs for additional context
- [ ] Identify root cause

Resolution phase:
- [ ] Develop fix addressing root cause
- [ ] Test fix with original error case
- [ ] Test edge cases
- [ ] Run full test suite
- [ ] Get code review
- [ ] Deploy to staging
- [ ] Deploy to production with monitoring
- [ ] Document the issue and fix
- [ ] Update tests to prevent regression
