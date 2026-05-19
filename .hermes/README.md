# Ornet ERP — .hermes/ Directory

This directory contains project-specific AI agent rules for Ornet ERP.

## Purpose

These files travel with the repo and define how AI agents (Hermes, Codex, Claude, or any other tool) should behave when working on this project. They are source-of-truth project rules, not orchestration policy — orchestration policy lives in the Hermes multi-agent-orchestrator skill.

## File Index

| File | Purpose | When To Read |
|---|---|---|
| `README.md` (this file) | Directory overview, file index, load order | Always |
| `project-rules.md` | Stack, architecture, source of truth, commands, forbidden actions | Always |
| `agent-rules.md` | Agent ownership boundaries, parallel work rules, review requirements | During planning and delegation |
| `review-checklists.md` | Domain-specific review checklists for every change type | During review phase |

## Recommended Load Order

1. `README.md` — understand what's available
2. `project-rules.md` — understand the project
3. Any domain-specific file if relevant
4. `agent-rules.md` — before delegating tasks
5. `review-checklists.md` — before running review

## Maintenance Rules

- These files are source of truth. Update them when project structure changes.
- If a rule appears in both Hermes-side skill and here, the repo-local version wins.
- Don't duplicate long sections from CLAUDE.md — reference it instead.
