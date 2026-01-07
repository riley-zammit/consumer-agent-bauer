---
name: "Calendar & Email Planning"
description: "Create prioritized daily/weekly plans from calendar and email. Use for morning planning, weekly reviews, and meeting preparation."
allowed-tools:
  - mcp__gworkspace-mcp__list_calendars
  - mcp__gworkspace-mcp__calendar_events
  - mcp__gworkspace-mcp__calendar_availability
  - mcp__gworkspace-mcp__read_mail
  - mcp__gworkspace-mcp__search_drive
---

# Calendar & Email Planning Skill

Create prioritized daily/weekly plans from calendar events and email inbox.

## Purpose

Systematically review calendar and email to extract action items, identify priorities, and create a structured plan for the day or week. This skill transforms scattered information into an organized, actionable task list with time estimates and priority rankings.

## Primary Agent

- **Cortana** (Communications & Planning) - Daily planning, email triage, meeting prep

## Supporting Agents

- **Oracle** (Research) - Background research for meetings
- **WALL-E** (Archivist) - Document decisions and action items
- **Monopoly Man** (Business Strategist) - Prioritize business-critical tasks

## When to Use

- Start of day planning
- Start of week planning
- Before/after vacation
- After receiving many emails
- Preparing for important meetings
- Reorganizing priorities

## Prerequisites

- Access to Google Workspace MCP tools (`mcp__gworkspace-mcp__*`)
- Google Calendar access
- Gmail access
- Understanding of priorities and goals

## Step-by-Step Process

### 1. Review Calendar

Get upcoming events and identify time commitments.

```bash
mcp__gworkspace-mcp__calendar_events
  calendar_id: "primary"
  time_min: "today"  # or specific date like "2025-01-15T00:00:00Z"
  time_max: "tomorrow"  # or "next week"
  max_results: 20
  include_attendees: true
  attendee_detail_level: "basic"
```

**What to Extract**:
- Meeting times and durations
- Meeting topics and objectives
- Required preparation
- Attendees (for context)
- Conflicts or overlaps
- Available work blocks

**Analysis Questions**:
- How much time is blocked for meetings?
- How much time is available for focused work?
- Which meetings need preparation?
- Are there scheduling conflicts?
- Which meetings are high priority?

### 2. Categorize Calendar Events

Group events by type and priority.

**Event Categories**:

| Type | Description | Prep Required |
|------|-------------|---------------|
| **Critical Meetings** | Customer calls, exec reviews | High - prep slides/data |
| **Team Meetings** | Standups, syncs, planning | Medium - status updates |
| **1-on-1s** | Individual conversations | Medium - feedback/topics |
| **Focus Time** | Blocked work time | None - protect this time |
| **Optional** | Can skip if needed | Low - review agenda |

**Priority Assessment**:
- 🔴 P0 - Critical, cannot be rescheduled
- 🟠 P1 - Important, should attend
- 🟡 P2 - Useful, attend if time allows
- 🟢 P3 - Optional, can decline

### 3. Review Email Inbox

Get unread emails and extract action items.

```bash
mcp__gworkspace-mcp__read_mail
  query: "is:unread"  # or "in:inbox after:2025/01/14"
  max_results: 50
  include_body: true
  include_attachments: false
```

**What to Extract**:
- Action items (tasks requiring response)
- FYI emails (information only)
- Urgent requests
- Meeting requests
- Questions awaiting response
- Threads to follow up on

**Email Triage Categories**:
- ✅ **Action Required** - Needs response or task
- 📋 **Reference** - Save for later, no action
- 🗑️ **Delete/Archive** - No value, clear it out
- 📥 **Delegated** - Forward to appropriate person
- ⏰ **Scheduled** - Needs response, but not today

### 4. Extract Action Items

Identify concrete tasks from both calendar and email.

**From Calendar**:
```markdown
Meeting: Q4 Business Review (10am-11am)
Action Items:
- [ ] Prepare revenue slides
- [ ] Update GMV projections
- [ ] Review competitive analysis

Meeting: Partner App Demo (2pm-3pm)
Action Items:
- [ ] Set up demo store
- [ ] Test checkout extension
- [ ] Prepare Q&A talking points
```

**From Email**:
```markdown
Email: Partner API Question from John
- [ ] Research metafields API bulk operations
- [ ] Send example code snippet
- [ ] Schedule follow-up call

Email: Production Error Report
- [ ] Investigate error group abc123
- [ ] Deploy fix if identified
- [ ] Update error monitoring dashboard
```

### 5. Estimate Time and Effort

Assign realistic time estimates to each task.

**Time Estimation**:
- 🕐 **Quick (15 min)** - Simple response, lookup, review
- 🕑 **Short (30 min)** - Email response with research, small fix
- 🕒 **Medium (1 hour)** - Investigation, documentation, prep work
- 🕓 **Long (2+ hours)** - Complex implementation, deep debugging

**Effort Estimation**:
- 💡 **Low** - Straightforward, no obstacles
- ⚡ **Medium** - Some complexity, may need help
- 🔥 **High** - Complex, high risk, needs focus time

**Example**:
```markdown
Task: Investigate production error abc123
Time: 🕒 Medium (1 hour)
Effort: ⚡ Medium
Reasoning: Need to query Observe, analyze traces, identify root cause
```

### 6. Prioritize Tasks

Rank tasks by urgency and importance.

**Eisenhower Matrix**:

```
                    URGENT
        │ 🔴 P0: Do First      │ 🟡 P2: Schedule  │
IMPORT  │ (Critical & Urgent)  │ (Important, Not  │
        │                      │  Urgent)         │
        ├──────────────────────┼──────────────────┤
        │ 🟠 P1: Delegate/     │ 🟢 P3: Eliminate │
        │  Do Quick            │ (Not Important,  │
        │ (Urgent, Not Import) │  Not Urgent)     │
```

**Prioritization Criteria**:
1. **Customer Impact** - Blocking customers = highest priority
2. **Deadlines** - Due today/tomorrow = high priority
3. **Dependencies** - Blocking others = high priority
4. **Strategic Value** - Aligns with goals = medium priority
5. **Quick Wins** - High value, low effort = fit in gaps

### 7. Allocate Time Blocks

Map tasks to available calendar time.

**Available Time Analysis**:
```markdown
## Today's Schedule (Jan 15, 2025)

08:00-09:00 ⬜ Focus Time (1 hour)
09:00-10:00 📅 Team Standup
10:00-11:00 📅 Q4 Business Review
11:00-12:00 ⬜ Focus Time (1 hour)
12:00-13:00 🍽️ Lunch
13:00-14:00 ⬜ Focus Time (1 hour)
14:00-15:00 📅 Partner App Demo
15:00-16:00 ⬜ Focus Time (1 hour)
16:00-17:00 📅 Team Sync
17:00-18:00 ⬜ Wrap-up (1 hour)

Total Available: 5 hours focused work time
```

**Task Allocation**:
```markdown
08:00-09:00 🔴 Investigate production error (1h)
           → Blocking customers, must fix today

11:00-12:00 🔴 Prepare Q4 Business Review slides (1h)
           → Meeting at 10am tomorrow, need review time

13:00-14:00 🟡 Research metafields bulk API (30min)
           🟡 Set up partner demo store (30min)
           → Both needed for 2pm demo

15:00-16:00 🟠 Respond to backlog emails (1h)
           → Clear inbox before end of day

17:00-18:00 🟢 Optional: Document error fix (30min)
           🟢 Optional: Plan tomorrow (30min)
```

### 8. Identify Preparation Needs

Determine what needs to be ready for meetings.

**Prep Template**:
```markdown
### Meeting: Q4 Business Review
**Time**: 10:00-11:00 (Tomorrow)
**Attendees**: Leadership team
**Objective**: Review Q4 performance

**Preparation Needed**:
- [ ] Revenue slides (1h) - Due tonight
- [ ] GMV projections (30min) - Due tonight
- [ ] Competitive analysis (15min) - Review existing

**Background Research**:
- Review Q3 results for comparison
- Check recent market trends
- Prepare talking points for questions

**Success Criteria**:
- Clear data visualization
- Actionable insights
- Recommendations for Q1

**Materials**:
- Slide deck: /path/to/deck.pdf
- Data source: BigQuery dashboard link
- Previous quarter: /path/to/q3-review.pdf
```

### 9. Handle Meeting Conflicts

Identify and resolve scheduling issues.

**Conflict Detection**:
```bash
mcp__gworkspace-mcp__calendar_availability
  email_list: ["team-member@shopify.com", "partner@example.com"]
  time_min: "2025-01-15T14:00:00Z"
  time_max: "2025-01-15T15:00:00Z"
```

**Conflict Resolution Options**:
1. **Decline lower priority** - Skip optional meeting
2. **Reschedule** - Move meeting to open slot
3. **Delegate** - Send team member instead
4. **Shorten** - Reduce meeting from 1h to 30min
5. **Async** - Request email update instead

**Example**:
```markdown
CONFLICT DETECTED:
- 2:00-3:00pm: Partner App Demo (P1)
- 2:30-3:30pm: Team Planning (P2)

RESOLUTION:
- Attend Partner Demo (customer-facing, P1)
- Delegate Team Planning to teammate (internal, P2)
- Request async notes from Team Planning
```

### 10. Create Daily Plan

Synthesize into actionable daily plan.

**Plan Format**:
```markdown
# Daily Plan: Wednesday, January 15, 2025

## Priorities
🔴 P0: Fix production error
🔴 P0: Prep Q4 business review
🟠 P1: Partner demo preparation
🟡 P2: Clear email backlog

## Schedule

### Morning (8am-12pm)
**08:00-09:00 | 🔴 URGENT: Production Error**
- Investigate error group abc123
- Deploy fix if possible
- Time: 1 hour | Effort: Medium

**09:00-10:00 | 📅 Team Standup**
- Status update on active projects
- Prep: Review sprint board

**10:00-11:00 | 📅 Q4 Business Review**
- Present revenue analysis
- Prep: Finalize slides (do at 11am)

**11:00-12:00 | 🔴 Q4 Review Prep**
- Update revenue slides
- Add GMV projections
- Time: 1 hour | Effort: Low

### Afternoon (1pm-5pm)
**01:00-02:00 | 🟠 Partner Demo Prep**
- Research metafields bulk API (30min)
- Set up demo store (30min)
- Time: 1 hour | Effort: Medium

**02:00-03:00 | 📅 Partner App Demo**
- Walk through checkout extension
- Answer technical questions
- Prep: Test demo store at 1pm

**03:00-04:00 | 🟡 Email Triage**
- Respond to urgent emails
- Archive/delegate others
- Time: 1 hour | Effort: Low

**04:00-05:00 | 📅 Team Sync**
- Weekly planning
- No prep required

### Evening (5pm-6pm)
**05:00-06:00 | Wrap-up**
- 🟢 Optional: Document error fix (30min)
- 🟢 Optional: Plan tomorrow (30min)

## Email Action Items
- [ ] ✅ John - metafields API response (01:00pm)
- [ ] ✅ Sarah - error report follow-up (08:00am)
- [ ] ✅ Partner inquiry - demo confirmation (01:30pm)
- [ ] 📋 Newsletter - file for later
- [ ] 🗑️ Spam - archive

## Meeting Prep Checklist
- [x] Q4 Review slides → 11am-12pm
- [x] Partner demo store → 1pm-2pm
- [ ] Team standup status (quick review)

## Key Decisions Needed
1. Should we prioritize feature X or Y in Q1? (Q4 Review)
2. Partner wants custom checkout flow - feasible? (Demo)

## Risks & Blockers
- ⚠️ Production error might take longer than 1 hour
- ⚠️ Q4 data not finalized yet (check with TARS)

## Success Metrics
- ✅ Production error resolved
- ✅ Q4 review slides ready
- ✅ Partner demo successful
- ✅ Inbox < 10 unread emails
```

## Common Patterns

### Pattern 1: Overbooked Calendar

**Problem**: Too many meetings, not enough work time.

**Solution**:
1. Decline P3 optional meetings
2. Delegate P2 meetings to teammates
3. Shorten P1 meetings (60min → 30min)
4. Block focus time and protect it
5. Request async updates instead of meetings

### Pattern 2: Email Overwhelm

**Problem**: 100+ unread emails, can't keep up.

**Solution**:
1. Filter by unread in last 24 hours
2. Triage: Action / Reference / Delete
3. Star action items
4. Batch respond (not one at a time)
5. Unsubscribe from low-value emails
6. Set up filters for FYI emails

### Pattern 3: Meeting Prep Crunch

**Problem**: Multiple meetings tomorrow, no prep time.

**Solution**:
1. Block prep time before each meeting
2. Identify which meetings are optional
3. Delegate meetings that others can attend
4. Request agenda in advance (or decline)
5. Schedule prep for highest priority meetings first

### Pattern 4: Context Switching Fatigue

**Problem**: Jumping between tasks, low productivity.

**Solution**:
1. Batch similar tasks (all emails together)
2. Block 2-hour focus time (no interruptions)
3. Schedule meetings in clusters (morning or afternoon)
4. Use "focus mode" to block notifications
5. Plan context switches at natural breaks

## Output Format

```markdown
# Daily Plan: [Day, Date]

## Top Priorities
1. 🔴 [Most critical task]
2. 🔴 [Second critical task]
3. 🟠 [Important task]

## Time Allocation
**Meetings**: X hours
**Focused Work**: Y hours
**Email/Admin**: Z hours

## Schedule
[Time-blocked schedule with tasks]

## Email Action Items
- [ ] [Recipient] - [Topic] ([Time])

## Meeting Preparation
- [ ] [Meeting name] - [Prep tasks] ([Time needed])

## Key Decisions
- [Decision point 1]
- [Decision point 2]

## Risks
- ⚠️ [Potential blocker]

## Success Criteria
- ✅ [Done when...]
```

## Best Practices

1. **Plan Evening Before** - Review next day in evening
2. **Limit Daily Tasks** - 3-5 major tasks max
3. **Buffer Time** - Add 25% buffer for overruns
4. **Protect Focus Time** - Block and defend deep work time
5. **Batch Meetings** - Cluster meetings together
6. **Review Regularly** - Check plan at lunch and EOD
7. **Be Realistic** - Don't overcommit

## Related Skills

- **document-pattern-capture** - Document recurring workflows
- **merchant-feedback-research** - Research for meetings

## Checklist

Morning planning:
- [ ] Review calendar for today
- [ ] Review calendar for tomorrow (prep needs)
- [ ] Check email inbox (unread count)
- [ ] Extract action items from emails
- [ ] Identify meeting prep needs
- [ ] Allocate tasks to time blocks
- [ ] Set top 3 priorities

During day:
- [ ] Check plan at start of each time block
- [ ] Update completed tasks
- [ ] Adjust if priorities shift
- [ ] Track blockers and risks

End of day:
- [ ] Review what got done
- [ ] Move incomplete tasks to tomorrow
- [ ] Plan tomorrow's top priorities
- [ ] Clear urgent emails
- [ ] Document key decisions
