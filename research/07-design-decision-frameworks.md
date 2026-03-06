# Technical Design Decision Frameworks for AI-Assisted Architecture

> **Purpose:** Research synthesis on how to make rigorous technical design decisions with AI assistance — combining proven industry frameworks (Google Design Docs, ADRs, C4 Model, Shape Up) with expert AI coding workflows (Osmani, Cherny, Simon Brown). This research directly informs the `/tech-design` Claude Code skill.
>
> **Context:** PomoFocus needs dozens of architecture decisions across 9+ platforms before writing app code. Agents execute well-defined plans but are weak at making judgment calls. The goal: a structured skill that keeps humans in the decision seat while leveraging AI for research, trade-off analysis, and documentation.

---

## Table of Contents

1. [The Problem: Agents and Architecture Decisions](#the-problem)
2. [Framework 1: Google Design Docs](#google-design-docs)
3. [Framework 2: Architecture Decision Records (ADRs)](#architecture-decision-records)
4. [Framework 3: C4 Model — Zoom Levels](#c4-model)
5. [Framework 4: Osmani's Spec-First Workflow](#osmani-spec-first)
6. [Framework 5: Cherny's CLAUDE.md as Decision Memory](#cherny-claude-md)
7. [Framework Synthesis: The `/tech-design` Skill](#synthesis)
8. [Sources](#sources)

---

## The Problem: Agents and Architecture Decisions {#the-problem}

AI agents excel at executing well-scoped tasks: implement this function, fix this bug, write this test. They struggle with architecture decisions because:

1. **Trade-offs require judgment, not generation.** Choosing between Supabase Realtime vs. Cloudflare Durable Objects for sync isn't a coding problem — it's a judgment call about latency, cost, complexity, and team capability.
2. **Context is distributed.** Architecture decisions depend on business constraints, team experience, budget, timeline, existing infrastructure, and future plans — information that lives in the human's head, not the codebase.
3. **Decisions are irreversible (or expensive to reverse).** A bad function name costs 5 minutes to fix. A bad database choice costs weeks. The cost of getting architecture wrong demands human ownership.
4. **Agents are yes-machines by default.** Without explicit instruction to challenge, they'll validate whatever the user suggests rather than stress-testing it.

**The solution:** Keep humans as the decision-makers, but use AI to:
- Research options and surface trade-offs they might miss
- Apply structured frameworks to prevent sloppy thinking
- Document decisions in version-controlled, machine-readable formats
- Challenge assumptions with devil's advocate questioning

---

## Google Design Docs {#google-design-docs}

**Source:** Malte Ubl, "Design Docs at Google" (industrialempathy.com)

Google's design doc culture is one of the most proven approaches to technical decision-making at scale. Key principles:

### Structure

| Section | Purpose |
|---------|---------|
| **Context & Scope** | Objective background facts. What's the landscape? What's being built? Keep succinct. |
| **Goals & Non-Goals** | Bullet-pointed objectives. Non-goals are NOT negations ("won't crash") — they're things that *could* reasonably be goals but are *deliberately excluded*. |
| **The Actual Design** | The core decision with emphasis on trade-offs. Not an implementation manual. |
| **Alternatives Considered** | What else was evaluated and why it was rejected. This is the most valuable section for future readers. |
| **Cross-Cutting Concerns** | Security, privacy, observability, cost, maintainability. |

### Key Insights

- **"Design docs should be sufficiently detailed but short enough to actually be read."** 10–20 pages for substantial projects, 1–3 pages for incremental improvements.
- **Poor design docs read as implementation manuals.** If there's no genuine ambiguity to resolve, skip the doc and just code.
- **The value is in trade-offs, not specifications.** A design doc that says "we'll use Postgres" without explaining why not SQLite, MongoDB, or DynamoDB is useless.
- **Non-goals are more important than goals.** They signal deliberate scoping decisions: "ACID compliance is a non-goal" tells you more about the system than "it should be fast."

### Relevance to `/tech-design`

The Google design doc structure maps directly to the interview phases of the skill. Phase 1 (Context) → Context & Scope. Phase 2 (Options) → Alternatives. Phase 3 (Stress Test) → Cross-cutting concerns. Phase 4 (Decision) → The actual design.

---

## Architecture Decision Records (ADRs) {#architecture-decision-records}

**Sources:** Michael Nygard (original ADR proposal), MADR 4.0, AWS Prescriptive Guidance, Joel Parker Henderson's ADR repository

ADRs are lightweight, immutable, version-controlled records of individual architecture decisions. They answer: "Why did we choose X over Y?"

### MADR 4.0 Template (Simplified)

```markdown
# ADR-NNN: [Decision Title]

**Status:** Proposed | Accepted | Deprecated | Superseded by ADR-NNN
**Date:** YYYY-MM-DD
**Decision-makers:** [who was involved]
**Consulted:** [who was asked for input]

## Context and Problem Statement

[1-3 sentences: What is the issue? What needs to be decided?]

## Decision Drivers

- [driver 1: e.g., must support offline-first]
- [driver 2: e.g., team has no Go experience]
- [driver 3: e.g., budget constraint of $0/month for MVP]

## Considered Options

1. [Option A]
2. [Option B]
3. [Option C]

## Decision Outcome

Chosen option: "[Option B]", because [justification referencing drivers].

### Consequences

- **Good:** [positive outcomes]
- **Bad:** [negative trade-offs accepted]
- **Neutral:** [neither good nor bad, but worth noting]

## Pros and Cons of the Options

### [Option A]
- Good, because [argument]
- Bad, because [argument]

### [Option B]
- Good, because [argument]
- Bad, because [argument]

### [Option C]
- Good, because [argument]
- Bad, because [argument]
```

### Best Practices (AWS, 200+ ADRs)

1. **One decision per ADR.** Don't combine "which database" with "which ORM."
2. **ADRs are immutable.** Don't edit old ADRs — write a new one that supersedes.
3. **Separate design from decision.** Use a design doc for exploration, an ADR for the final call.
4. **Push for timely decisions.** Most are "two-way door" (reversible). Decide and move.
5. **Keep meetings short.** 30–45 minutes max. 10–15 min reading, then discuss.
6. **Every team member can author.** ADRs aren't only for architects.

### Relevance to `/tech-design`

ADRs are the primary output artifact of the `/tech-design` skill. Every decision session produces at least one ADR in `research/decisions/`. For larger decisions, a design doc is produced alongside.

---

## C4 Model — Zoom Levels {#c4-model}

**Source:** Simon Brown, c4model.com

The C4 Model provides four zoom levels for thinking about architecture. This is valuable for the skill because **different decisions live at different zoom levels**, and the interview should adapt accordingly.

### The Four Levels

| Level | Name | What It Shows | Decision Examples |
|-------|------|---------------|-------------------|
| 1 | **Context** | System in its environment — users, external systems | "How does PomoFocus interact with Apple HealthKit?" |
| 2 | **Container** | Major runtime units — apps, databases, APIs | "Should sync go through Supabase Realtime or Cloudflare DO?" |
| 3 | **Component** | Internal structure of a container | "How should the timer state machine be organized?" |
| 4 | **Code** | Class/module level | "Should we use Zustand or Jotai for state management?" |

### Key Insight for the Skill

**The first question to ask is: what zoom level is this decision at?**

- Level 1–2 decisions need full design docs (high stakes, many stakeholders, hard to reverse).
- Level 3–4 decisions need lightweight ADRs (lower stakes, easier to change, fewer stakeholders).

This maps directly to the user's request for adaptive depth: the skill detects the zoom level and adjusts the interview accordingly.

---

## Osmani's Spec-First Workflow {#osmani-spec-first}

**Source:** Addy Osmani, "My LLM coding workflow going into 2026" and "How to write a good spec for AI agents"

### Core Workflow

1. **Describe the idea** → Ask the LLM to iteratively ask questions until requirements and edge cases are fleshed out
2. **Compile into spec.md** → Requirements, architecture decisions, data models, testing strategy
3. **Generate project plan** → Break into logical, bite-sized tasks
4. **Execute iteratively** → One function, one feature, one fix at a time

### Three-Tier Boundary System

Rather than flat prohibitions, Osmani recommends graduated guidance:

| Tier | Meaning | Example |
|------|---------|---------|
| **Always** | Safe to execute without approval | "Always use TypeScript strict mode" |
| **Ask first** | High-impact, needs human review | "Ask before choosing a new database" |
| **Never** | Hard stops | "Never commit secrets" |

### Six Core Areas for Completeness (GitHub's Analysis of 2,500+ Agent Files)

1. **Commands** — Executable commands with full flags
2. **Testing** — Framework, location, coverage expectations
3. **Project structure** — Explicit paths
4. **Code style** — Real code samples over prose
5. **Git workflow** — Branch naming, commit format, PR requirements
6. **Boundaries** — What the agent must never touch

### Relevance to `/tech-design`

The iterative questioning approach is the core interaction pattern: don't let the user dump a vague request. Ask questions until the decision space is well-defined. The six core areas provide a checklist for completeness when the decision affects project configuration.

---

## Cherny's CLAUDE.md as Decision Memory {#cherny-claude-md}

**Source:** Boris Cherny (creator of Claude Code), via Pragmatic Engineer, InfoQ, VentureBeat

### Key Principles

1. **CLAUDE.md is persistent memory.** Every architecture decision captured in an ADR should be reflected in CLAUDE.md so future agent sessions respect it.
2. **Plan first, then execute.** "A good plan is really important!" — Go back and forth until the plan is right before switching to auto-accept.
3. **Specialization beats generalization.** Use subagents scoped to platforms. An iOS agent shouldn't be making web architecture decisions.
4. **Verification loops.** Every decision should have a way to verify it was implemented correctly.

### The Decision Memory Chain

```
/tech-design produces ADR
        ↓
ADR key points added to CLAUDE.md
        ↓
Future /fix-issue sessions read CLAUDE.md
        ↓
Agents automatically respect the decision
```

This is the critical integration point: decisions made in `/tech-design` must flow into the persistent context that all other skills read.

---

## Framework Synthesis: The `/tech-design` Skill {#synthesis}

### Design Principles

1. **Human decides, AI researches and challenges.** The skill never makes the final call — it presents trade-offs and asks the human to choose.
2. **Adaptive depth.** Detect whether this is a Level 1–2 (full design doc) or Level 3–4 (lightweight ADR) decision and adjust the interview accordingly.
3. **Live web research.** Search for benchmarks, community consensus, and recent developments during the interview — don't rely solely on training data.
4. **Devil's advocate mode.** After the user leans toward an option, actively argue against it to stress-test the choice.
5. **Machine-readable output.** ADRs in consistent MADR format so future agents can parse them.
6. **Decision memory.** Key decisions propagated to CLAUDE.md for cross-session persistence.

### Interview Flow (5 Phases)

```
Phase 1: Context & Scope
  "What needs to be decided? What constraints exist?"
  → Determines zoom level → sets depth of remaining phases
         ↓
Phase 2: Solution Space (with live web research)
  "What are the realistic options? Let me research trade-offs."
  → Presents options with pros/cons from real-world sources
         ↓
Phase 3: Stress Test (Devil's Advocate)
  "You're leaning toward X — here's why that might be wrong."
  → Cross-cutting concerns: security, cost, scalability, team fit
         ↓
Phase 4: Decision & Record
  "Confirm your choice. Let me write the ADR."
  → Produces MADR-format ADR in research/decisions/
         ↓
Phase 5: Integration
  "Here's what needs to update in CLAUDE.md and related docs."
  → Updates persistent project memory
```

### Output Artifacts

| Decision Scale | Output |
|---------------|--------|
| Quick (Level 3–4) | Single ADR in `research/decisions/NNN-title.md` |
| Full (Level 1–2) | Design doc in `research/designs/title.md` + ADR summarizing the decision |

### How It Fits the Workflow

```
/discover → "What should we build and why?"
     ↓
/tech-design → "How should we architect it?"
     ↓
/clarify → "What's the exact scope of this implementation task?"
     ↓
/fix-issue → "Implement it."
```

---

## Sources {#sources}

### Design Docs & Architecture
- [Design Docs at Google — Malte Ubl](https://www.industrialempathy.com/posts/design-docs-at-google/)
- [Design Docs — A Design Doc — Malte Ubl](https://www.industrialempathy.com/posts/design-doc-a-design-doc/)
- [C4 Model — Simon Brown](https://c4model.com/)
- [C4 Model — InfoQ Article](https://www.infoq.com/articles/C4-architecture-model/)

### Architecture Decision Records
- [MADR — Markdown Any Decision Records](https://adr.github.io/madr/)
- [ADR Templates — adr.github.io](https://adr.github.io/adr-templates/)
- [AWS — Master ADR Best Practices](https://aws.amazon.com/blogs/architecture/master-architecture-decision-records-adrs-best-practices-for-effective-decision-making/)
- [AWS — ADR Process](https://docs.aws.amazon.com/prescriptive-guidance/latest/architectural-decision-records/adr-process.html)
- [Microsoft Azure — Maintain an ADR](https://learn.microsoft.com/en-us/azure/well-architected/architect-role/architecture-decision-record)
- [Joel Parker Henderson — ADR Repository](https://github.com/joelparkerhenderson/architecture-decision-record)

### AI-Assisted Design Workflows
- [Addy Osmani — My LLM Coding Workflow Going Into 2026](https://addyosmani.com/blog/ai-coding-workflow/)
- [Addy Osmani — How to Write a Good Spec for AI Agents](https://addyosmani.com/blog/good-spec/)
- [O'Reilly — How to Write a Good Spec for AI Agents](https://www.oreilly.com/radar/how-to-write-a-good-spec-for-ai-agents/)
- [Boris Cherny — Building Claude Code (Pragmatic Engineer)](https://newsletter.pragmaticengineer.com/p/building-claude-code-with-boris-cherny)
- [Boris Cherny — Creator Workflow (InfoQ)](https://www.infoq.com/news/2026/01/claude-code-creator-workflow/)
- [How Boris Uses Claude Code](https://howborisusesclaudecode.com/)

### Agent Architecture & Evaluation
- [Amazon — Evaluating AI Agents](https://aws.amazon.com/blogs/machine-learning/evaluating-ai-agents-real-world-lessons-from-building-agentic-systems-at-amazon/)
- [Addy Osmani — LLM Coding Workflow (Substack)](https://addyo.substack.com/p/my-llm-coding-workflow-going-into)
