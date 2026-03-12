---
title: "[0.6] Configure branch protection rules for main"
labels: ["agent-ready", "effort:small", "phase:0", "platform:infra", "chore"]
---

## Goal

Branch protection rules are documented (and optionally configured via `gh` CLI or GitHub UI) for the `main` branch, requiring CI checks to pass before merge.

## Context & Background

Phase 0, sub-item 0.6 of the [MVP Roadmap](../../research/mvp-roadmap.md).
**Depends on:** #034 — CI workflow must exist so required checks can reference it.

Branch protection prevents merging broken code into main. At minimum, the CI workflow checks must be required to pass. This may require manual GitHub UI configuration or `gh api` calls.

**Referenced ADRs:**
- [ADR-009](../../research/decisions/009-ci-cd-pipeline-design.md) — CI as gatekeeper for PRs.

## Affected Files

- `.github/BRANCH_PROTECTION.md` — Document the required branch protection settings (in case manual setup is needed)

## Acceptance Criteria

- [ ] Branch protection documentation exists specifying: require CI checks to pass, require branch to be up to date, no force pushes to main
- [ ] If `gh` CLI is available: protection rules are applied via `gh api`
- [ ] Direct pushes to `main` are blocked (PRs required)
- [ ] CI check "CI" (or workflow name) is a required status check

## Out of Scope

- Do NOT require code review (single developer for now)
- Do NOT configure CODEOWNERS

## Test Plan

```bash
# If gh CLI is available:
gh api repos/{owner}/{repo}/branches/main/protection --jq '.required_status_checks'
# Otherwise: verify .github/BRANCH_PROTECTION.md exists
test -f .github/BRANCH_PROTECTION.md && echo "docs exist"
```

## Platform

Infrastructure
