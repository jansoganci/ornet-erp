# Finance UI Polish Follow-ups

## Recurring Expenses

- [x] Fix Recurring Expenses table column alignment.
- [x] Add missing third column header.
- [x] Rename / clarify `GYK` label.
- [x] Make category and burden type badges visually clearer.
- [x] Improve spacing/borders between category, burden type, amount, payment, invoice columns.
- [ ] Show user-friendly error when recreating a soft-deleted template with the same name.
- [ ] Consider restore flow for soft-deleted recurring templates.

## Proposal 
- [ ] We need to categorize income types into groups.

## Analysis Prompts

### Prompt 3 — Proposal income type grouping

```text
Analyze Proposal income type grouping from docs/active/finance-ui-and-general-polish-followups.md.

Scope:
- We need to categorize income types into groups.

Goal:
Return a concise product/technical analysis before implementation.
Identify current income_type / revenue_type values, where they are used, and where grouping should appear.
Clarify whether this is only UI grouping or whether reporting/filtering/data model changes are needed.
Return an exact implementation plan and risks.
Do not implement yet.
Do not mix this with Work Order fulfillment or finance safety work.
```
