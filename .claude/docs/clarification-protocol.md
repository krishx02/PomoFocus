# Clarification Protocol

## Overview

This document describes the three-layer mechanism for preventing intent misalignment between the human and Claude Code agents in the PomoFocus project. Each layer catches a different class of ambiguity.

---

## Layer 1 — CLAUDE.md Rules (Always Active)

**File:** `/Users/krishg/Documents/GitHub/PomoFocus/CLAUDE.md`

Rules are loaded into every session. Key clarification rules:

- `IMPORTANT: Before implementing, always ask "What should NOT change?"`
- `YOU MUST ask one clarifying question if:` scope is vague, >3 files will be touched, request uses "everywhere"/"all"/"refactor" without specifics, or two developers would implement it differently
- `NEVER infer scope from a vague request`
- `When asking for clarification, ask EXACTLY ONE targeted question`

**Rationale:** CLAUDE.md is Claude's "first-day brief." Rules written with `IMPORTANT:` and `YOU MUST` have higher compliance rates than soft suggestions. Negative constraints ("never infer") are more reliable than positive instructions.

**Limitation:** Model compliance is probabilistic. CLAUDE.md rules reduce misalignment but do not eliminate it. Use Layers 2 and 3 for enforcement.

---

## Layer 2 — UserPromptSubmit Hook (Automatic Detection)

**Hook config:** `.claude/settings.local.json`
**Script:** `.claude/hooks/ambiguity-check.py`

### How It Works

On every prompt submission, the hook script:

1. Reads the prompt from the event JSON on stdin
2. Calls `claude-haiku-4-5-20251001` with a classifier prompt
3. If `{"ambiguous": true}` is returned, injects `additionalContext` instructing Claude to ask one clarifying question before proceeding
4. If `{"ambiguous": false}` or the API call fails, exits 0 with no output (fail-open)

### Ambiguity Classifier Criteria

Haiku flags a prompt as ambiguous if:
- Uses broad scope terms without named targets: "everywhere", "all", "refactor", "clean up", "update", "fix"
- Would require >3 files but doesn't name them
- Doesn't specify what existing behavior to preserve
- Two developers would implement it differently

Haiku always clears:
- Short conversational messages and questions
- "explain X", "what does Y do" — meta-requests
- Prompts that name specific files/functions

### Fail-Open Design

If `ANTHROPIC_API_KEY` is unset, the network call fails, or JSON parsing errors, the hook exits 0 silently. The check is advisory — it must never block work.

### Latency

Haiku response time: ~300–800ms. This adds a small delay on every prompt. If this becomes disruptive, the hook can be disabled per-session by unsetting `ANTHROPIC_API_KEY` or removing the hook from settings temporarily.

---

## Layer 3 — /clarify Skill (User-Initiated Deep Intake)

**File:** `.claude/skills/clarify/SKILL.md`
**Invoke:** `/clarify [optional description]`

### When to Use

- Before any feature with unclear scope
- Before any task touching more than 3 files
- Whenever the hook fires and the clarifying question reveals the task is larger than expected
- As standard practice before starting a new PomoFocus platform target

### What It Does

Runs a 5-question structured interview (one question at a time):
1. Goal — end state description
2. Scope — specific files/components in scope
3. Constraints — technical requirements and restrictions
4. What must NOT change — out-of-scope behavior
5. Success criteria — verifiable completion check

Writes a spec to `.claude/specs/YYYY-MM-DD-<goal>.md`, asks for user confirmation, then implements according to the spec.

### Spec Files

Specs are persisted in `.claude/specs/` and committed to git. They serve as:
- Implementation contracts for agent sessions
- Audit trail for what was intended vs. what was built
- Input for future `/fix-issue` skill sessions

---

## Mechanical Confirmation — Destructive Operations

**Config:** `permissions.ask` array in `.claude/settings.local.json`

These operations always trigger a confirmation dialog, regardless of context:
- `git reset*`
- `git push --force*` / `git push --force-with-lease*`
- `rm -rf*`
- `git clean -f*`
- `git checkout -- *` (discards uncommitted changes)

This is a mechanical guard, not a prompt-level instruction. It cannot be overridden by prompt injection.

---

## Validation Test Set

Use this test set to measure mechanism effectiveness. Run with and without the hook active.

### Clear Prompts (target: <10% clarification rate)

1. "Read `CLAUDE.md` and tell me what clarification rules are currently set"
2. "Add a `README.md` section explaining the `/clarify` skill"
3. "In `.claude/hooks/ambiguity-check.py`, change the timeout from 8 to 5 seconds"
4. "What does the `check_ambiguity` function do?"
5. "List all files in `.claude/skills/`"
6. "Show me the current `settings.local.json`"
7. "Run `git status` and tell me what's untracked"
8. "Fix the typo 'succcess' in `clarification-protocol.md`"
9. "What model does the ambiguity hook use?"
10. "Add a comment above `main()` in `ambiguity-check.py` explaining what it does"

### Vague Prompts (target: 80%+ clarification rate)

1. "Refactor the hooks"
2. "Update the documentation"
3. "Clean up the settings file"
4. "Fix the permissions everywhere"
5. "Make the clarify skill better"
6. "Add error handling"
7. "Update all the skills"
8. "Improve the CLAUDE.md"
9. "Make it faster"
10. "Reorganize the .claude folder"

### Metrics to Track

| Metric | Target |
|--------|--------|
| Clarification rate on vague prompts | 80%+ |
| False positive rate on clear prompts | <10% |
| Hook latency (p95) | <1s |
| User bypass rate (skipping clarification) | Track — if >30%, threshold is too aggressive |

---

## Tuning the Hook

If false positives are too high (clear prompts flagged):
- Tighten the classifier system prompt — add more "always clear" examples
- Raise the threshold (add a `confidence` field and only inject if confidence > 0.8)

If ambiguous prompts still slip through:
- Add more trigger patterns to the CLAUDE.md `YOU MUST ask` rule
- Use the `/clarify` skill proactively at the start of each session

---

## External Framework References

For future iteration, these frameworks are relevant:

- **AGENT-CQ** — generate + evaluate clarifying questions with a separate critic model
- **RTADev** — alignment checkpoints between agent phases (plan → implement → verify)
- **Intent Engineering Framework** — 7-component spec: objective, outcomes, constraints, stop rules, format, tone, examples
- **ICLR 2025: "Modeling Future Conversation Turns"** — predict whether correction will be needed before execution

These patterns can inform a future `PreToolUse` spec-gating hook that blocks `Edit|Write` until a spec file is confirmed.
