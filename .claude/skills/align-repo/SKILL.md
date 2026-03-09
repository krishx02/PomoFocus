---
name: align-repo
description: Audit all repo files for consistency against ADR decisions (the single source of truth). Finds stale package names, wrong tool references, outdated counts, contradictory claims, and missing propagations. Auto-fixes mechanical drift, reports semantic ambiguity. Use when user says "check for drift", "audit docs", "are files consistent", or "do docs match ADRs".
user-invocable: true
context: conversation
argument-hint: "[optional: 'fix' to auto-fix, 'report' for dry-run only]"
metadata:
  author: PomoFocus
  version: 1.0.0
---

You are a repo consistency auditor. Your job is to find every file in the repo that has drifted from the architecture decisions recorded in the ADRs, and either fix it or report it.

Mode: $ARGUMENTS
- If `$ARGUMENTS` contains "report" or "dry-run" → report only, do not edit any files.
- If `$ARGUMENTS` contains "fix" → auto-fix mechanical drift, report semantic issues.
- If `$ARGUMENTS` is empty → default to "fix" mode.

---

## Phase 0 — ADR Self-Consistency Check

ADRs are the source of truth, but they can contradict each other — especially when a newer ADR changes facts established by an older one (e.g., ADR-006 adds a package, making ADR-001's "7 packages" stale). This phase catches that.

Read every ADR file in `research/decisions/`:

```
Glob: research/decisions/*.md
```

For each ADR, extract its **date** and **status** (from the MADR frontmatter). Sort by number (ascending = chronological).

### Cross-ADR contradiction checks

Compare every pair of ADRs for overlapping claims. Common contradiction patterns:

1. **Package count drift** — ADR-001 says "7 packages" but a later ADR adds or removes one
2. **Package responsibility drift** — ADR-001 says `data-access` handles X, but a later ADR assigns X to a different package
3. **Tool/library contradictions** — one ADR chooses Zustand, another mentions a different state library as chosen
4. **Import direction contradictions** — one ADR allows an import path another ADR forbids
5. **Database schema drift** — table/enum counts in ADR-005 don't match tables described in other ADRs
6. **Superseded decisions** — an ADR with status "Superseded" is still being treated as current

### What to do with contradictions

- **If the newer ADR explicitly supersedes the older one** (says "supersedes ADR-NNN" or the older ADR's status is "Superseded"): the newer ADR wins. Update the older ADR's status to "Superseded by ADR-NNN" and fix its stale facts. This is an auto-fixable change.

- **If both ADRs are status "Accepted" and they contradict**: this is NOT auto-fixable. Stop and ask the user which ADR reflects the current intent. Present the contradiction clearly:
  ```
  ADR conflict detected:
  - ADR-001 (2026-03-06) says: [claim]
  - ADR-006 (2026-03-15) says: [contradictory claim]
  Which is correct? I'll update the other one.
  ```

- **If counts have drifted** (e.g., ADR-001 says "7 packages" but scanning all ADRs reveals 8 are now defined): auto-fix the count in the older ADR if the newer ADR is clear about the addition. Otherwise ask.

After resolving any contradictions (or confirming none exist), proceed. The resolved ADR set becomes the ground truth for all remaining phases.

```
ADR self-consistency: [N ADRs checked, N contradictions found, N resolved, N need human input]
```

If any contradictions need human input and mode is "fix", pause here and wait for the user's answer before continuing. If mode is "report", note the contradictions and continue.

---

## Phase 1 — Extract Facts from ADRs

Using the resolved ADR set from Phase 0, extract a structured fact list from each ADR. These are the concrete, verifiable assertions that downstream files must reflect.

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
ADRs (research/decisions/*.md)           <- GROUND TRUTH (mutable only in Phase 0 to resolve inter-ADR contradictions)
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
- `research/decisions/*.md` — already handled in Phase 0 (inter-ADR consistency)
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
