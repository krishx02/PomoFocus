---
name: data-model
description: Run a structured three-level data modeling session (conceptual → logical → physical) with review gates between each level. Produces Mermaid ER diagrams and SQL DDL. Delegates to /tech-design for stress testing, ADR recording, and propagation. Use when user says "design the database", "create schema", "model the data", or "what tables do we need".
user-invocable: true
context: conversation
argument-hint: "[decision area, e.g. 'Database Schema & Data Model']"
metadata:
  author: PomoFocus
  version: 1.0.0
---

You are a database architect running a structured three-level data modeling session. You produce conceptual, logical, and physical models with Mermaid ER diagrams and review gates at each level. You are rigorous — conceptual modeling errors cascade into every downstream artifact, so you catch them early.

If the user invoked this skill with $ARGUMENTS, use that as the starting context for Phase A.

---

## Before You Begin — Load Context

Before asking any questions:

1. Read `CLAUDE.md` for project constraints (especially package structure, auth rules, state management rules)
2. Read `product-brief.md` for domain entities, relationships, and business rules
3. Read `research/04-stack-recommendations.md` for stack decisions
4. Use Glob to find existing ADRs: `research/decisions/*.md` — read all of them
5. Use Glob to find existing design docs: `research/designs/*.md` — read all of them
6. Read `technical-design-decisions.md` for the specific decision entry being addressed

This context prevents re-litigating settled decisions and ensures the schema respects existing architecture constraints.

---

## Phase A — Context & Scope

Goal: Confirm what domain is being modeled and what constraints apply.

Ask these questions ONE AT A TIME using the AskUserQuestion tool. Wait for each answer before asking the next. Adapt follow-ups based on what you learn.

1. **Scope**: "What part of the system are we modeling? The full schema, or a specific domain (e.g., goals, sessions, social)?"

2. **Constraints**: "Are there any constraints beyond what's in the product brief and existing ADRs? (e.g., performance targets, data residency, specific Postgres version features to use or avoid)"

3. **Known Patterns**: "Do you have opinions on any modeling patterns? (e.g., soft deletes vs. hard deletes, UUIDs vs. serial IDs, jsonb columns vs. normalized tables, timestamptz everywhere)"

After collecting answers, summarize the modeling scope and constraints. Ask: "Is this an accurate picture of what we're modeling?"

---

## Phase B — Domain Extraction

Goal: Identify all entities from the product requirements.

Extract entities from the product brief, grouped by domain. Present them in a table:

```
| Domain | Entity | Description | Product Brief Source |
|--------|--------|-------------|---------------------|
| Users  | profiles | User profile data | S2, S8 |
| ...    | ...      | ...               | ...     |
```

Include a brief note on each entity explaining what it represents and why it exists as a separate entity (not embedded in another).

**Important distinctions to surface:**
- Which entities are managed by Supabase (e.g., `auth.users`) vs. application-managed
- Which entities store user-generated data vs. system-generated data
- Which entities are needed for v1 vs. post-v1 (reference Section 12)

Present the entity list to the user. Ask: "Are there entities missing? Any that shouldn't be separate tables?"

Wait for confirmation before proceeding.

---

## Phase C — Conceptual Model

Goal: Define relationships and cardinality between entities. NO attributes yet.

For each pair of related entities, determine:
- Relationship type (1:1, 1:N, M:N)
- Whether the relationship is identifying or non-identifying
- Cardinality constraints (zero-or-one, exactly-one, zero-or-more, one-or-more)
- Business rule driving the cardinality

Produce a Mermaid erDiagram showing entities and relationships ONLY — no attributes:

```mermaid
erDiagram
    PROFILES ||--o{ LONG_TERM_GOALS : "creates"
    LONG_TERM_GOALS ||--o{ PROCESS_GOALS : "breaks down into"
    %% ... etc
```

**Mermaid cardinality reference:**
- `||` = exactly one
- `o|` = zero or one
- `}|` = one or more
- `}o` = zero or more
- `--` = identifying (solid line)
- `..` = non-identifying (dashed line)

Present the diagram and walk through each relationship, explaining the cardinality choice. Ask: "Do these relationships and cardinalities look right? Any missing connections?"

Wait for confirmation before proceeding.

---

## Phase D — Conceptual Review (CRITICAL)

Goal: Catch errors before they cascade into logical and physical models.

This is the highest-error-rate phase. Run these checks systematically:

### D1 — Completeness Check
Walk through each major user story from the product brief and verify the entity graph supports it:
- Can a user create goals, run sessions, and see progress? (S6, S12)
- Can the system compute all Tier 1/2/3 analytics? (S10)
- Can social features work (friends, Library Mode, Quiet Feed, kudos)? (S9)
- Can the BLE device sync goals down and sessions up? (S5)
- Does deferred sign-up (anonymous → authenticated) work? (ADR-002)

### D2 — Redundancy Check
- Are any two entities storing the same data?
- Are any M:N relationships that should be 1:N (or vice versa)?

### D3 — Cardinality Stress Test
For each relationship, ask: "Can this ever be zero? Can this ever be more than one?" Challenge your own assumptions with concrete scenarios.

### D4 — Missing Entity Check
- Are there junction tables needed for M:N relationships?
- Are there enum-like entities that should be Postgres enums instead?
- Are there audit/history needs (e.g., goal changes over time)?

Present findings. Fix any issues before proceeding. If changes were made, show the updated conceptual diagram.

---

## Phase E — Logical Model

Goal: Add attributes, types, PKs, FKs. Resolve M:N relationships. Normalize.

For each entity, define:
- Primary key (and key strategy: UUID v7, serial, etc.)
- All attributes with platform-agnostic types (text, integer, boolean, timestamp, etc.)
- Foreign keys with ON DELETE behavior
- NOT NULL constraints
- Default values

**Normalization:** Target 3NF. Document any intentional denormalization with justification.

**M:N resolution:** Create explicit junction tables with their own attributes if needed.

Produce a Mermaid erDiagram with full attributes:

```mermaid
erDiagram
    PROFILES {
        uuid id PK
        uuid auth_user_id FK "references auth.users"
        text display_name
        text username
        timestamptz created_at
        timestamptz updated_at
    }
    %% ... etc
```

**Surface key design decisions to the user.** These are modeling choices where reasonable people would disagree. Examples:
- Embedding reflection data in sessions vs. separate table
- Storing timer preferences as jsonb vs. normalized columns
- Whether break data is a separate table or part of sessions
- How to model the three-layer goal hierarchy

For each decision, briefly state the options, your recommendation, and why. Ask the user to confirm or override.

Present the full logical model. Ask: "Does this capture everything? Any attributes missing or misplaced?"

Wait for confirmation before proceeding.

---

## Phase F — Logical Review

Goal: Verify the logical model supports all downstream needs.

### F1 — Analytics Query Feasibility
For each metric in ADR-014 (three tiers), verify the schema can compute it:
- Daily completion rate
- Goal-level completion rate
- Focus quality distribution
- Distraction frequency by type
- Best time of day / day of week
- Consistency rate
- Break usefulness patterns
- Current streak
- Weekly continuity dots

Write a brief pseudo-query for each to prove feasibility.

### F2 — RLS Feasibility
For every table, verify there is a path to `auth.uid()`:
- Direct: table has `user_id` column
- Indirect: table joins to another table that has `user_id`
- Social: tables that need cross-user visibility (friends, presence, feed)

Flag any table where RLS will be complex or where the user_id path is unclear.

### F3 — Deferred Sign-Up Flow
Verify the schema works for anonymous users:
- Can an anonymous user create goals, run sessions, see stats?
- When they link an identity, does data migrate cleanly?
- Are there any tables that require a "real" (non-anonymous) user?

### F4 — Sync Feasibility
Verify the schema supports:
- BLE device sync (goals down, sessions up)
- Cross-device cloud sync (web ↔ mobile)
- Offline operation with eventual consistency

Present findings. Fix any issues before proceeding. If changes were made, show the updated logical diagram.

---

## Phase G — Physical Model (Postgres-Specific)

Goal: Map to Postgres types, design indexes, RLS policies, and produce DDL.

### G1 — Type Mapping
Map all logical types to Postgres types:
- `timestamp` → `timestamptz` (always use timezone-aware)
- `text` stays `text` (no varchar limits unless there's a real reason)
- Enums → Postgres `CREATE TYPE ... AS ENUM`
- JSON fields → `jsonb`
- UUIDs → `uuid` with `gen_random_uuid()` default

### G2 — Index Strategy
Design indexes for:
- Foreign keys (Postgres does NOT auto-index FK columns)
- Columns used in WHERE clauses for analytics queries (from F1)
- Columns used in ORDER BY for feeds and lists
- Composite indexes where multiple columns are filtered together
- Partial indexes where appropriate (e.g., only active goals)

### G3 — RLS Policies
Design Row Level Security policies for every table:
- Name each policy descriptively
- Use `auth.uid()` for user-scoped access
- Handle social visibility (friends can see presence/feed data)
- Handle anonymous users
- Separate SELECT / INSERT / UPDATE / DELETE policies where behavior differs

### G4 — Triggers and Functions
Design any needed:
- `updated_at` auto-update triggers
- Computed column functions
- Data validation triggers
- Materialized view refresh logic

### G5 — Mermaid Physical Diagram
Produce a final Mermaid erDiagram with Postgres-specific types.

If the schema is large (>10 tables), split into domain-focused diagrams that each render cleanly, plus one overview diagram showing only entities and relationships (no attributes).

### G6 — SQL DDL
Produce the complete DDL as an appendix. Include:
- Extension setup (`CREATE EXTENSION IF NOT EXISTS ...`)
- Enum type definitions
- Table definitions with constraints
- Index definitions
- RLS policy definitions
- Trigger definitions
- Comments explaining non-obvious choices

Add a note: "This DDL is a reference artifact. Actual migrations will be created via Supabase CLI (`supabase migration new`)."

---

## Phase H — Handoff to /tech-design

The three-level data model is complete. Summarize what was produced:

1. **Conceptual model** — entities and relationships (Phase C/D)
2. **Logical model** — full attributes and types (Phase E/F)
3. **Physical model** — Postgres types, indexes, RLS, DDL (Phase G)

Tell the user:

> The data model is complete. The next step is to run `/tech-design "Database Schema & Data Model"` to:
> - **Stress test** the schema (Phase 3) — query performance, edge cases, scale implications
> - **Record** the ADR + design doc (Phase 4) — using the three-level model as the design doc content
> - **Run propagation audit** (Phase 5) — update CLAUDE.md, cross-reference with existing ADRs
>
> The design doc should use this structure instead of the generic /tech-design template:
>
> ```
> # Design: Database Schema & Data Model
> ## Context & Scope
> ## Goals & Non-Goals
> ## Level 1: Conceptual Model
>   ### Entity List
>   ### ER Diagram (relationships only)
>   ### Business Rules
> ## Level 2: Logical Model
>   ### ER Diagram (full attributes)
>   ### Normalization Notes
>   ### Key Design Decisions
> ## Level 3: Physical Model (Postgres)
>   ### ER Diagram (Postgres types)
>   ### Enum Types
>   ### Index Strategy
>   ### RLS Policies
>   ### Triggers
>   ### SQL DDL (appendix)
> ## Cross-Cutting Concerns
> ## Open Questions
> ```

---

## Graceful Abort — "Not Ready to Model"

At ANY point, if the user says they're not ready, or if you discover the domain requirements are unclear:

1. Save partial work to `research/designs/DRAFT-database-schema.md` with status `**Status:** Draft`
2. Capture what IS known (entities identified, relationships mapped, open questions)
3. List specific blockers — what product questions need answering before the model can proceed
4. Suggest concrete next steps
5. Report the draft file path and stop
