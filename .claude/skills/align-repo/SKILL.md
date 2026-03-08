---
name: align-repo
description: Audit all repo files for consistency against ADR decisions (the single source of truth). Finds stale package names, wrong tool references, outdated counts, contradictory claims, and missing propagations. Auto-fixes mechanical drift, reports semantic ambiguity. Run after any /tech-design session or whenever you suspect docs have drifted.
user-invocable: true
context: conversation
argument-hint: "[optional: 'fix' to auto-fix, 'report' for dry-run only]"
---

You are a repo consistency auditor. Your job is to find every file in the repo that has drifted from the architecture decisions recorded in the ADRs, and either fix it or report it.

Mode: $ARGUMENTS
- If `$ARGUMENTS` contains "report" or "dry-run" → report only, do not edit any files.
- If `$ARGUMENTS` contains "fix" → auto-fix mechanical drift, report semantic issues.
- If `$ARGUMENTS` is empty → default to "fix" mode.

---

## Phase 1 — Extract Facts from ADRs

Read every ADR file in `research/decisions/`:

```
Glob: research/decisions/*.md
```

For each ADR, extract a structured fact list. These are the concrete, verifiable assertions that downstream files must reflect. Categories:

### Fact categories to extract

1. **Package facts** — names, count, descriptions, which layer each belongs to
2. **Import direction** — which packages can depend on which
3. **Tool/library choices** — auth provider, state library, test framework, etc.
4. **Naming conventions** — what things are called (e.g., `data-access` not `api-client`)
5. **Database conventions** — PK type, timestamp type, delete strategy, RLS pattern
6. **Architecture patterns** — timer is pure function, core has no IO, polling not WebSockets
7. **Platform facts** — where native code lives, what build tools are used

After extracting, display the fact list to the user:

```
Extracted N facts from M ADRs:
- [category]: [fact summary]
- ...
```

---

## Phase 2 — Define the Audit Targets

These are ALL files that must be checked, grouped by priority. The source of truth hierarchy is:

```
ADRs (research/decisions/*.md)           <- GROUND TRUTH (read-only in this skill)
  |
  v  propagates to
Design docs (research/designs/*.md)      <- Detailed architecture
  |
  v  propagates to
CLAUDE.md                                <- Agent rules (highest-impact downstream file)
  |
  v  propagates to
AGENTS.md                                <- Cross-tool brief
technical-design-decisions.md            <- Decision checklist
  |
  v  propagates to
.claude/agents/*.md                      <- Platform subagents
.claude/skills/*/SKILL.md               <- Skill definitions
GitHub-Agents.md                         <- Workflow reference
research/README.md                       <- Research index
```

Glob for all targets:

```
Glob: CLAUDE.md
Glob: AGENTS.md
Glob: GitHub-Agents.md
Glob: technical-design-decisions.md
Glob: research/README.md
Glob: research/designs/*.md
Glob: .claude/agents/*.md
Glob: .claude/skills/*/SKILL.md
```

Also check for any other `.md` files in the repo root:
```
Glob: *.md
```

Exclude from checking:
- `research/decisions/*.md` — these ARE the source of truth
- `research/0[1-8]-*.md` — these are research exploration docs, not decision records. "Better Auth" or "Turborepo" mentioned as *evaluated alternatives* is correct in these files. Only flag if they state a rejected option as the *chosen* decision.
- `product-brief.md` — product doc, not architecture
- `.claude/docs/` — Claude Code documentation, not project-specific

---

## Phase 3 — Audit

For each target file, check every extracted fact against the file's content. Use Grep and Read.

### What to check

**Terminology consistency:**
- Package names match ADR-001 exactly (e.g., `data-access` not `api-client`, `ui` not `ui-components`, `ble-protocol` not `ble-client`)
- Auth provider matches ADR-002 (e.g., "Supabase Auth" not "Better Auth", unless discussing rejected alternatives)
- State libraries match ADR-003 (e.g., "Zustand" + "TanStack Query")
- Timer approach matches ADR-004 (e.g., "discriminated unions" not "XState")
- Monorepo tool matches ADR-001 (e.g., "Nx" not "Turborepo", unless comparing)

**Count consistency:**
- Package count matches actual number defined in ADR-001 + ADR-003
- Table count matches ADR-005
- Enum count matches ADR-005

**Structural consistency:**
- Package lists include all packages (none missing)
- Dependency/import direction descriptions are correct
- Folder structure diagrams show correct package names and paths

**Semantic consistency:**
- No file claims a migration path that ADRs have rejected (e.g., "MVP → Better Auth later")
- No file describes a package's responsibility differently than the ADR defines it
- No file puts auth in the wrong package (must be in `data-access`, not `core`)
- No file adds WebSocket/Realtime as default (must be polling-first per ADR-003)

### Severity classification

- **CRITICAL** — Wrong package name, wrong library/tool choice, contradictory architecture claim. An agent reading this file would write broken code.
- **WARNING** — Stale count, outdated phrasing, missing package from a list. An agent reading this file would have incomplete information.
- **INFO** — Missing cross-reference, style inconsistency, could-be-clearer wording. Not actionable by an agent.

---

## Phase 4 — Report Findings

Display a structured report:

```
## Align-Repo Audit Report

### Facts extracted: N from M ADRs
### Files checked: N
### Files clean: N
### Files with issues: N

---

### CRITICAL (N)

| File | Line | Issue | Expected | Found |
|------|------|-------|----------|-------|
| ... | ... | ... | ... | ... |

### WARNING (N)

| File | Line | Issue | Expected | Found |
|------|------|-------|----------|-------|
| ... | ... | ... | ... | ... |

### INFO (N)

| File | Line | Issue |
|------|------|-------|
| ... | ... | ... |
```

---

## Phase 5 — Fix (if mode is "fix")

If mode is "report" → stop here. Display report and exit.

If mode is "fix" → proceed:

### Auto-fixable (mechanical drift)
These have a single correct answer derivable from an ADR. Fix them with the Edit tool:
- Wrong package name → replace with correct name
- Wrong library/tool name → replace with correct name
- Wrong count → update to correct count
- Missing package in a list → add it
- Stale migration language → update to match ADR decision
- Wrong folder path → correct it

For each fix, use targeted Edit calls. Do NOT rewrite entire files — make the minimum change.

### Not auto-fixable (semantic ambiguity)
These require human judgment. Report them but do not edit:
- Two files make contradictory claims and it's unclear which reflects the actual intent
- A file's entire section is structured around an outdated assumption (rewriting would change the document's flow)
- A research exploration doc states a rejected option as chosen (might be intentional historical context)

After fixing, re-run the audit checks on the fixed files to verify the fixes are correct. If a fix introduced a new issue, revert it and report instead.

---

## Phase 6 — Summary

```
## Align-Repo Complete

Fixed: N issues across M files
Remaining: N issues (require human review)
Clean: N files verified consistent

[If any fixes were made:]
Files modified:
- path/to/file.md (N fixes)
- ...

[If any issues remain:]
Needs human review:
- path/to/file.md:LINE — [description]
- ...
```

---

## Phase 7 — Self-Check

Before finishing, verify that THIS skill's assumptions still match the repo:

1. Does `research/decisions/` still exist? Are there ADRs this skill doesn't know how to parse?
2. Are there new top-level `.md` files that should be in the audit target list?
3. Are there new directories under `.claude/agents/` or `.claude/skills/` that weren't checked?
4. Has the source of truth hierarchy changed (e.g., new intermediate files)?

If any self-check fails, report it:

```
Self-check warning: [description]. Consider updating /align-repo skill.
```
