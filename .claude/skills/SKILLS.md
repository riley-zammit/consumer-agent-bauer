# Skills Reference

Skills are reusable, multi-step workflows that agents can follow to accomplish complex tasks. Each skill has detailed documentation with prerequisites, steps, error handling, and examples.

## How Skills Work

- Skills are documented in `.claude/skills/[skill-name]/SKILL.md`
- Agents reference skills by name in their workflow sections
- Skills include step-by-step processes, error handling, and examples
- Skills can be composed together for complex workflows

## Available Skills

### Core Shopify Development Skills

#### create-local-app
**Purpose**: Bootstrap new Shopify apps with CLI, configure scopes, set up development environment
**Agents**: Baymax, Architect
**Location**: `.claude/skills/create-local-app/SKILL.md`
**When to Use**: Creating new Shopify apps, initializing development projects

**Process Overview**:
1. Verify prerequisites (Node.js 18.20+, Shopify CLI)
2. Check for existing apps in `./apps/`
3. Ensure user is logged into Shopify CLI
4. Run `shopify app init` (interactive - not background)
5. Configure access scopes from `./constants/shopifyAppAccessScopes.md`
6. Remind user about protected customer data access
7. Update `./apps/currentApp.md` with selection

---

#### shopify-store-query
**Purpose**: Make GraphQL requests to live Shopify stores using local app credentials
**Agents**: Baymax, Oracle
**Location**: `.claude/skills/shopify-store-query/SKILL.md`
**When to Use**: Testing GraphQL queries, validating API behavior, debugging store data

**Process Overview**:
1. Check which apps exist in `./apps/`
2. Ask user which app if multiple exist
3. Find the SQLite database with credentials
4. Extract shop and accessToken from Session table
5. Make GraphQL requests with curl and validate responses

---

#### partner-app-data-lookup
**Purpose**: Query Shopify's BigQuery data warehouse for partner and app metrics
**Agents**: TARS, Monopoly Man
**Location**: `.claude/skills/partner-app-data-lookup/SKILL.md`
**When to Use**: Looking up app install counts, GMV data, partner metrics

**Process Overview**:
1. Understand the data question
2. Search data platform for relevant tables
3. Get metadata for schema understanding
4. Write and execute BigQuery query
5. Analyze and present results with context

---

### Debugging & Investigation Skills

#### observe-investigate
**Purpose**: Debug production issues using Observe logs, traces, and metrics
**Agents**: Scotty, TARS, Morpheus
**Tools**: `mcp__observe-mcp__*`
**When to Use**: Production errors, performance issues, system debugging

**Process Overview**:
1. Get Observe documentation for query syntax
2. Identify relevant datasets (logs, traces, error analytics)
3. Search for error groups or trace patterns
4. Query detailed data
5. Analyze metrics and correlate events
6. Report findings with evidence

---

#### error-investigation
**Purpose**: Investigate and resolve production errors systematically
**Agents**: Scotty, Chaos Monkey, Morpheus
**When to Use**: Production incidents, recurring errors, system failures

**Process Overview**:
1. Gather error context (logs, traces, metrics)
2. Reproduce the error if possible
3. Identify root cause through analysis
4. Propose fix with validation plan
5. Document findings and prevention measures

---

### Data & Analytics Skills

#### metrics-analysis
**Purpose**: Query and analyze Prometheus metrics from Observe
**Agents**: Morpheus, TARS, Scotty
**Tools**: `mcp__observe-mcp__*_metrics_query`
**When to Use**: Performance analysis, capacity planning, system monitoring

**Process Overview**:
1. Get Observe metrics documentation
2. Search for relevant metrics by name
3. Understand metric labels and dimensions
4. Write PromQL queries with aggregations
5. Analyze trends and identify anomalies
6. Present insights with visualizations

---

#### merchant-feedback-research
**Purpose**: Aggregate merchant pain points from support tickets, reviews, and surveys
**Agents**: Quark, Oracle
**Tools**: `mcp__scout__*`
**When to Use**: Understanding merchant needs, feature prioritization, pain point analysis

**Process Overview**:
1. Define research question (what merchant problem to investigate)
2. Search support tickets with filters (date, plan, GMV, country)
3. Search app reviews for feedback patterns
4. Search sales conversations for strategic context
5. Search Reddit r/Shopify for community discussions
6. Synthesize findings across sources
7. Present prioritized pain points with evidence

---

#### slack-search
**Purpose**: Search internal Slack messages for context, decisions, and solutions
**Agents**: Oracle, TARS, Scotty, Architect
**Tools**: `mcp__data-portal__query_bigquery`
**When to Use**: Before saying "I don't know", when codebase search lacks context, finding team decisions

**Process Overview**:
1. Identify keywords (error messages, feature names, team names)
2. Query `shopify-dw.people.slack_messages` via BigQuery
3. Filter by time range (default: last 30 days)
4. Look for PRs, docs links, and solution threads
5. Synthesize findings into actionable context

---

#### ux-audit
**Purpose**: Audit UI code for accessibility, Polaris compliance, and UX best practices
**Tools**: `mcp__shopify-dev-mcp__*` (Polaris), `validate_component_codeblocks`
**When to Use**: Reviewing component code, checking WCAG compliance, validating Polaris usage

**Process Overview**:
1. Identify UI type and appropriate Polaris API
2. Load Polaris context with learn_shopify_api
3. Review component usage against Polaris patterns
4. Run accessibility checklist (contrast, focus, keyboard, ARIA)
5. Validate with validate_component_codeblocks
6. Report findings by severity (critical/major/minor)

---

### Documentation & Knowledge Skills

#### document-pattern-capture
**Purpose**: Transform agent work into reusable documentation and patterns
**Agents**: WALL-E
**When to Use**: After successful workflows, when discovering reusable patterns

**Process Overview**:
1. Review the agent's work and output
2. Identify what's reusable (pattern, process, knowledge)
3. Extract the repeatable steps
4. Create appropriate documentation (skill, guide, reference)
5. Test that it's complete and understandable
6. File in the correct location
7. Update indexes and cross-references

---

#### graphql-schema-exploration
**Purpose**: Systematically explore and document GraphQL schemas
**Agents**: Oracle, Baymax
**Tools**: `mcp__shopify-dev-mcp__introspect_graphql_schema`
**When to Use**: Learning new APIs, finding operations, understanding field requirements

**Process Overview**:
1. Use learn_shopify_api to understand API context
2. Search schema with operation types (create, update, delete, list)
3. Introspect specific operations for field details
4. Fetch full documentation pages
5. Test operations against live store (with Baymax)
6. Document findings with working examples

---

### Planning & Coordination Skills

#### calendar-email-planning
**Purpose**: Create daily/weekly plans based on calendar and email commitments
**Agents**: Cortana
**Tools**: `mcp__gworkspace-mcp__*`
**When to Use**: Morning planning, weekly planning, meeting preparation

**Process Overview**:
1. Fetch calendar events for the day/week
2. Read recent/unread emails
3. Extract action items and deadlines
4. Cross-reference commitments (email vs calendar)
5. Create time-blocked schedule with focus blocks
6. Identify conflicts and preparation needs
7. Present prioritized plan with recommendations

---

## Multi-Agent Workflow Examples

### Research → Validate → Document
**Agents**: Oracle → Baymax → WALL-E
**Use Case**: Investigating and documenting new APIs

1. **Oracle** uses `graphql-schema-exploration` to research API
2. **Baymax** uses `shopify-store-query` to validate findings
3. **WALL-E** uses `document-pattern-capture` to save pattern

---

### Data → Business → Strategy
**Agents**: TARS → Monopoly Man → Cortana
**Use Case**: Analyzing metrics for business decisions

1. **TARS** uses `partner-app-data-lookup` to get metrics
2. **Monopoly Man** analyzes business impact and ROI
3. **Cortana** synthesizes insights for strategic planning

---

### Debug → Fix → Monitor
**Agents**: Scotty → Morpheus → Chaos Monkey
**Use Case**: Resolving production performance issues

1. **Scotty** uses `observe-investigate` to find root cause
2. **Morpheus** uses `metrics-analysis` to measure impact
3. **Chaos Monkey** creates test plan to prevent regression

---

## Creating New Skills

When creating a new skill, use this structure:

### File Location
`.claude/skills/[skill-name]/SKILL.md`

### Frontmatter Format
```yaml
---
name: "Skill Name"
description: "One-line description of what this skill does and when to use it"
allowed-tools:
  - Tool1
  - Tool2
  - mcp__server__function
---
```

### Content Structure
```markdown
# Skill Name

## Purpose
[What problem this solves]

## When to Use
[Scenarios where this skill applies]

## Prerequisites
- [Requirement 1]
- [Requirement 2]

## Process

### Step 1: [Step Name]
[Detailed instructions]

### Step 2: [Step Name]
[More instructions]

## Examples

### Example 1: [Scenario]
[Working example with output]

## Troubleshooting

### Issue: [Common problem]
**Solution**: [How to fix it]

## Important Rules
- [Critical guideline]
- [Another rule]

## Related Skills
- [Link to related skill]
```

---

## Skill Best Practices

### For Skill Creators (WALL-E)
- **Test everything** - Validate all steps and examples work
- **Include error handling** - Document common issues and solutions
- **Show working examples** - Don't just describe, demonstrate
- **Update cross-references** - Link related skills and agents
- **Maintain consistency** - Follow the standard structure

### For Skill Users (All Agents)
- **Follow the process** - Don't skip steps in the workflow
- **Check prerequisites** - Verify requirements before starting
- **Adapt when needed** - Skills are guidelines, not rigid scripts
- **Report issues** - If a skill doesn't work, tell WALL-E to update it
- **Suggest improvements** - If you find a better way, document it

---

## Skill Selection

Skills are **not rigidly assigned** to agents. Any agent can use any skill if:
1. The task matches the skill's purpose
2. The agent has access to the required tools
3. The skill fits the agent's domain expertise

**How agents pick skills:**
- Read the skill's "When to Use" section
- Check if they have the `allowed-tools` listed in frontmatter
- Adapt the process to their specific task

This allows flexible collaboration - e.g., Scotty might use `slack-search` for debugging context, while Oracle uses it for research.

---

## Related Documentation

- **Agent Definitions**: `.claude/agents/*.md`
- **Main Configuration**: `.claude/CLAUDE.md`
- **Repository Guide**: `CLAUDE.md` (root)
- **Shopify Access Scopes**: `./constants/shopifyAppAccessScopes.md`
