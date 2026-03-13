---
name: clarify
description: Run a structured clarification interview before implementing any feature or change. Use this when a request is vague, the scope is unclear, or before any task that would touch more than 3 files. Produces a written spec, then implements it.
user-invocable: true
context: fork
agent: general-purpose
argument-hint: '[optional: brief description of what you want to build]'
metadata:
  author: PomoFocus
  version: 1.0.0
---

You are running a structured clarification interview to prevent misalignment between what the user wants and what gets implemented. Your job is to gather enough information to write an unambiguous spec, then implement it.

## Step 1 — Intake Interview

Use the AskUserQuestion tool to ask the following questions. Ask them ONE AT A TIME, waiting for each answer before asking the next. Do not ask all 5 at once.

Ask these questions in order:

1. **Goal**: "What is the goal of this task? Describe the end state you want — what should be true when it's done?"

2. **Scope**: "Which files, components, or areas of the codebase are in scope? Name them specifically if you know."

3. **Constraints**: "Are there any technical constraints or approaches I must use or avoid? (e.g., must use X library, cannot change Y API)"

4. **What must NOT change**: "What existing behavior, UI, or functionality must stay exactly the same? What is out of scope?"

5. **Success criteria**: "How will you know this is done correctly? What test, demo, or check proves it works?"

If the user invoked this skill with $ARGUMENTS, use that as context when asking — reference it in your first question.

## Step 2 — Write the Spec

After collecting all answers, write a spec file to `.claude/specs/` using this format:

Filename: `.claude/specs/YYYY-MM-DD-<kebab-case-goal>.md`
Use today's date: !`date +%Y-%m-%d`

```markdown
# Spec: [Goal from Step 1]

**Date:** [today]
**Status:** Ready to implement

## Goal

[User's answer to question 1]

## Scope

[User's answer to question 2 — list specific files if named]

## Constraints

[User's answer to question 3]

## Out of Scope / Must Not Change

[User's answer to question 4]

## Success Criteria

[User's answer to question 5]

## Implementation Notes

[Your brief analysis: key risks, dependencies to check, approach you'll take]
```

Show the user the spec and ask: "Does this accurately capture what you want? Any corrections before I start implementing?"

## Step 3 — Implement

Once the user confirms the spec:

1. Read every file mentioned in the scope before touching anything
2. Implement according to the spec — nothing more, nothing less
3. If you discover something that would change the scope, STOP and tell the user rather than inferring

Reference the written spec throughout implementation. If the spec doesn't cover a decision, use the least-invasive approach and note it in your summary.

## Step 4 — Summary

When done, report:

- What was changed (file list)
- What was explicitly left unchanged
- How to verify success (from the success criteria)
- Any deviations from the spec and why
