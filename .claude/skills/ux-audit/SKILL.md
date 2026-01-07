---
name: "UX Audit"
description: "Audit UI code for accessibility, Polaris compliance, and UX best practices. Use when reviewing component code or checking WCAG compliance."
allowed-tools:
  - Read
  - Grep
  - Glob
  - mcp__shopify-dev-mcp__learn_shopify_api
  - mcp__shopify-dev-mcp__search_docs_chunks
  - mcp__shopify-dev-mcp__fetch_full_docs
  - mcp__shopify-dev-mcp__validate_component_codeblocks
---

# UX Audit Skill

Systematically audit UI code for accessibility compliance, Polaris pattern adherence, and UX best practices.

## When to Use

- Reviewing UI component code
- Checking WCAG 2.1 AA/AAA compliance
- Validating Polaris component usage
- Assessing user flow design
- Pre-launch UX review

## Process

### Step 1: Understand Context
- What type of UI? (Admin app, checkout extension, customer account)
- Which Polaris API? (app-home, admin-extensions, checkout-extensions)

### Step 2: Load Polaris Context
```
learn_shopify_api(api: "polaris-app-home")  # or appropriate variant
```

### Step 3: Review Component Usage
- Search docs for correct component patterns
- Compare implementation against Polaris guidelines
- Validate components with `validate_component_codeblocks`

### Step 4: Accessibility Checklist
| Check | Requirement |
|-------|-------------|
| Color contrast | 4.5:1 for text, 3:1 for large text (WCAG AA) |
| Focus indicators | Visible focus states on all interactive elements |
| Keyboard navigation | All functionality accessible via keyboard |
| Screen reader | Proper ARIA labels, roles, and states |
| Touch targets | Minimum 44x44px for mobile |
| Error messages | Clear, specific, and associated with fields |

### Step 5: Pattern Compliance
- Check spacing uses Polaris tokens (not hardcoded values)
- Verify color usage follows semantic tokens
- Confirm typography matches Polaris scale
- Validate layout patterns (Card, Page, Layout)

### Step 6: Report Findings
Structure findings by severity:
- **Critical**: Accessibility blockers, broken functionality
- **Major**: Polaris violations, poor UX patterns
- **Minor**: Suggestions, optimizations

## Example Audit Output

```markdown
## UX Audit: CheckoutExtension.tsx

### Critical
- [ ] Missing aria-label on icon button (line 45)
- [ ] Color contrast 3.2:1 fails WCAG AA (line 78)

### Major
- [ ] Using hardcoded spacing instead of Polaris tokens (lines 23, 56)
- [ ] Non-standard button variant (line 89)

### Minor
- [ ] Consider using Banner instead of custom alert (line 34)
```

## Polaris API Reference

| UI Type | API to Use |
|---------|------------|
| App Home (embedded admin) | `polaris-app-home` |
| Admin extensions | `polaris-admin-extensions` |
| Checkout extensions | `polaris-checkout-extensions` |
| Customer account extensions | `polaris-customer-account-extensions` |
