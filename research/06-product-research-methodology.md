# Product Research & Discovery Methodologies for AI-Agent Workflows

> **Note:** This document synthesizes publicly available writing, talks, documentation, and open-source projects as of March 2026. Source links are included at each section for independent verification. Where methodologies have been adapted for AI-era workflows, the original framework is presented alongside its AI-specific evolution.

---

## TL;DR

AI agents can now accelerate every phase of product development — but the biggest leverage isn't in coding faster. It's in **thinking more rigorously about what to build before writing a single line of code**. The methodologies below all converge on the same insight: **the bottleneck in 2026 is product definition, not implementation**.

**Six patterns appear across every methodology:**

1. **Spec first, code second.** Whether it's a BMAD product brief, a GitHub Spec Kit constitution, or an Addy Osmani PRD — every serious methodology starts with a written artifact that AI agents execute against.
2. **Structured questioning beats open-ended brainstorming.** Frameworks like Mom Test, JTBD, and Continuous Discovery give agents (and humans) specific lenses to probe through, producing more useful insights than "brainstorm ideas for me."
3. **Phase gates prevent compounding errors.** BMAD, Spec Kit, and Shape Up all enforce checkpoints where a human reviews before the next phase begins. Agents that skip discovery and jump to code produce the most expensive kind of waste.
4. **Living documents > static specs.** The best specs evolve as you learn. They're version-controlled, updated after each discovery session, and treated as source code.
5. **Small, verifiable tasks.** Every methodology breaks work into pieces small enough to verify in one session — whether that's a Shape Up "scope," a BMAD "story," or a Spec Kit "task."
6. **The human's job is judgment, not typing.** You decide what to build and why. The agent handles research synthesis, spec expansion, consistency checks, and implementation.

---

## 1. BMAD Method — Breakthrough Method for Agile AI-Driven Development

**What it is:** An open-source, end-to-end AI-driven development framework that provides specialized agent roles, guided workflows, and intelligent planning from ideation through implementation. Currently at v6.

**Why it matters for product research:** BMAD is the most complete framework for using AI agents to do structured product discovery. Its deliberate "slow upstream" phase — often dismissed as tedious — is where the real value lives. The method intentionally slows down initial research and planning to dramatically accelerate everything that follows.

### Specialized Agent Roles

BMAD assigns distinct personas to the AI at each stage:

| Agent               | Role                                                               | Output                              |
| ------------------- | ------------------------------------------------------------------ | ----------------------------------- |
| **Analyst**         | Transforms vague business intent into structured research          | `product-brief.md`                  |
| **Product Manager** | Turns the brief into detailed requirements with MVP boundaries     | PRD (Product Requirements Document) |
| **Architect**       | Designs technical architecture from the PRD                        | Architecture document               |
| **Scrum Master**    | Breaks the PRD into atomic, implementable stories                  | Story files with full context       |
| **Developer**       | Implements stories as an "obedient craftsman" — halts on conflicts | Code + tests                        |
| **QA**              | Validates implementation against specs                             | Test reports                        |

The key insight: the Developer agent is deliberately constrained. It doesn't innovate at the architecture level. If it discovers a requirement-architecture conflict, it halts and reports rather than making autonomous decisions. This separation of concerns prevents the common failure mode where an AI agent "solves" a product problem by silently changing requirements.

### The Discovery Phase in Detail

The Analyst agent performs "intent-driven discovery":

- **Input:** Your verbal descriptions, scattered notes, competitor links, rough ideas
- **Process:** Structured interview using probing questions, market analysis, user persona development
- **Output:** A `product-brief.md` that captures the problem space, target users, competitive landscape, and initial feature hypotheses

The Product Manager agent then transforms this into a PRD:

- Defines MVP boundaries explicitly
- Lists what's in scope AND what's out of scope
- Creates measurable success criteria
- Identifies the riskiest assumptions

### Scale-Adaptive Tracks

BMAD auto-adjusts its rigor based on project complexity:

| Track           | When to Use                       | Planning Depth                                   |
| --------------- | --------------------------------- | ------------------------------------------------ |
| **Quick Flow**  | Bug fixes, small features         | Minimal — straight to implementation             |
| **BMad Method** | Products and platforms            | Full pipeline: PRD + Architecture + UX           |
| **Enterprise**  | Compliance, security requirements | Extended: security review, DevOps, test strategy |

### Spec-Driven Development (SDD)

BMAD's core philosophy: every artifact (PRD, architecture doc, stories) is version-controlled and treated as executable specification. This reduces hallucinations because the AI has a spec to follow rather than inventing behavior from your latest chat message.

### Installation

```bash
npx bmad-method@alpha install   # v6
```

Then open Claude Code in your project and run `/bmad-help`.

**Sources:**

- GitHub: https://github.com/bmad-code-org/BMAD-METHOD
- Documentation: https://docs.bmad-method.org/
- Applied BMAD deep-dive: https://bennycheung.github.io/bmad-reclaiming-control-in-ai-dev
- DEV Community overview: https://dev.to/extinctsion/bmad-the-agile-framework-that-makes-ai-actually-predictable-5fe7

---

## 2. GitHub Spec Kit — Spec-Driven Development Toolkit

**What it is:** GitHub's open-source toolkit that brings spec-driven development to any coding agent workflow. Agent-agnostic — works with Claude Code, Copilot, Gemini CLI, Cursor, and others.

**Why it matters for product research:** Spec Kit formalizes the insight that once a spec is solid, agents become interchangeable. The speedup comes from alignment, not faster typing. Different devs can use different AI tools but everyone implements against the same contract.

### The Five-Phase Workflow

Each phase produces artifacts that serve as immutable checkpoints:

1. **`/speckit.constitution`** — Establishes project-wide principles that govern all subsequent development. Acts as a constraint system every agent references.

2. **`/speckit.specify`** — Creates a functional specification from user requirements. This is the "what and why" document.

3. **`/speckit.clarify`** — Surfaces up to 5 targeted questions about underspecified areas marked `[NEEDS CLARIFICATION]` in the spec. This is the structured research/questioning phase.

4. **`/speckit.plan`** — Creates a technical implementation plan incorporating stack decisions and architecture choices.

5. **`/speckit.analyze`** — Cross-artifact consistency analysis. Validates that specs, plans, and constitution don't contradict each other.

6. **`/speckit.tasks`** + **`/speckit.implement`** — Break the spec into actionable tasks, then implement.

### Key Design Principle

The spec is the contract. It's not documentation you write after coding — it drives implementation, tests, and task breakdowns. You don't move to coding until the spec is validated.

### 2026 Ecosystem Context

Spec-driven development is rapidly becoming an industry norm. The ecosystem beyond Spec Kit includes:

- **AWS Kiro** — A dedicated SDD IDE
- **Tessl** — Pushes toward "spec-as-source" (the spec _is_ the code)
- **Academic formalization** — A January 2026 arXiv paper categorizes SDD into three rigor levels: spec-first, spec-anchored, and spec-as-source

A respected analysis in February 2026 noted: "Claude Code's improving long-range planning may eventually make spec-kit redundant, but as of Claude Code 2.1.42, the depth of planning, consistency checks, and research that spec-kit produces far exceeds what you get from Claude Code alone."

**Sources:**

- GitHub repo: https://github.com/github/spec-kit
- GitHub Blog announcement: https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/
- Microsoft Developer Blog: https://developer.microsoft.com/blog/spec-driven-development-spec-kit
- Review (2026): https://vibecoding.app/blog/spec-kit-review
- LogRocket walkthrough: https://blog.logrocket.com/github-spec-kit/

---

## 3. Addy Osmani — Spec-First Agentic Engineering

**Who:** Engineering Manager at Google, author of _Learning JavaScript Design Patterns_ (O'Reilly). One of the most widely-read voices on AI-assisted engineering in 2025–2026.

**Why it matters:** Osmani has written the clearest practical guidance on how to structure specs for AI agents. His articles are cited across virtually every AI development community.

### How to Write a Good Spec for AI Agents (Jan 2026)

Core principles:

1. **Goal-oriented specs.** Focus on _what_ and _why_, not the nitty-gritty _how_. Think user story + acceptance criteria: Who is the user? What do they need? What does success look like?

2. **Structured like a PRD.** A great spec includes: Purpose & Requirements, Inputs & Outputs, Constraints, APIs, Milestones, and Coding Conventions.

3. **Living document.** Update the spec as you and the agent make decisions. If the data model changes or a feature gets cut, reflect that in the spec so it remains ground truth. Version-control it.

4. **Divide and conquer.** Give the AI one focused task at a time rather than a monolithic prompt with everything at once.

5. **Self-audit / verification.** Instruct the AI to double-check its output against the spec. This pushes the LLM to reflect on its work, catching omissions.

6. **LLM-as-a-Judge.** For subjective quality (code style, readability, architectural adherence), have a second agent review the first agent's output against your spec's guidelines.

### The Conductor → Orchestrator Evolution

Osmani's February 2026 O'Reilly piece describes a trajectory:

- **Coder:** You write code, AI autocompletes lines.
- **Conductor:** You direct one AI agent, reviewing its output closely.
- **Orchestrator:** You assign backend to Agent A, frontend to Agent B, tests to Agent C. They work concurrently. You review and integrate three PRs.

The Orchestrator model is where product research becomes critical — if you're managing a "team" of agents, the spec is what keeps them aligned on the same product vision.

### The 80% Problem & Comprehension Debt

Osmani warns about "Comprehension Debt" — when agents generate code faster than you can understand it, you're borrowing against your future ability to maintain the system. The antidote: spec-first development ensures you understand _what_ is being built even if you didn't write every line.

**Sources:**

- How to Write a Good Spec: https://addyosmani.com/blog/good-spec/
- Agentic Engineering: https://addyosmani.com/blog/agentic-engineering/
- Self-Improving Agents: https://addyosmani.com/blog/self-improving-agents/
- Conductors to Orchestrators (O'Reilly): https://www.oreilly.com/radar/conductors-to-orchestrators-the-future-of-agentic-coding/
- The 80% Problem: https://addyo.substack.com/p/the-80-problem-in-agentic-coding

---

## 4. Boris Cherny — CLAUDE.md as Product Context + Multi-Agent Orchestration

**Who:** Creator of Claude Code at Anthropic, author of _Programming TypeScript_ (O'Reilly).

**Why it matters:** Cherny designed the system we're using to do this research. His workflow patterns are purpose-built for Claude Code and represent the most direct application of these ideas.

### The Four-Phase Loop

```
UNDERSTAND → PLAN → EXECUTE → VERIFY
```

- **UNDERSTAND:** Parse the request, identify implicit requirements, assess scope and complexity.
- **PLAN:** Create a detailed execution plan, identify which agents to use, define verification criteria, present plan for approval.
- **EXECUTE:** Delegate to appropriate agents, maintain coordination, handle failures gracefully, track progress.
- **VERIFY:** Run automated checks, invoke a verify agent, use a code-simplifier to clean up, iterate until all checks pass.

### CLAUDE.md as the Persistent Contract

> "CLAUDE.md is not a README. It's the briefing document. If your CLAUDE.md doesn't tell the agent what commands to run to verify its own work, you've already lost."

The CLAUDE.md serves as the persistent product context that survives across sessions. For product research, this means encoding your product decisions, constraints, and open questions in CLAUDE.md so every future agent session starts with that context.

### Key Insight for Product Research

Cherny's emphasis on using the most capable model (Opus) despite slower speed reflects a critical insight for product discovery: **the real bottleneck is not output speed but error correction cost.** Getting the product definition wrong is far more expensive than getting it slowly right.

**Sources:**

- See `research/01-agent-workflow-experts.md` for the full synthesis
- Claude Code docs: https://docs.anthropic.com/en/docs/claude-code/
- Claude Code GitHub: https://github.com/anthropics/claude-code

---

## 5. Kent Beck — TDD as the Agent Feedback Loop

**Who:** Creator of Extreme Programming (XP), co-author of the Agile Manifesto, pioneer of Test-Driven Development.

**Why it matters:** Beck's mental model of AI agents as an "unpredictable genie" is the most honest framing of what working with agents is actually like, and his TDD-first approach provides the safety net that makes agent-driven work reliable.

### Core Ideas (from The Pragmatic Engineer podcast, June 2025)

1. **The "Unpredictable Genie" model.** AI agents grant your "wishes" — but often in unexpected and illogical ways. You need a mechanism to verify that what you got is actually what you wanted.

2. **TDD is a superpower with agents.** AI agents introduce regressions. Unit tests are the simplest way to prevent this. When working with agents, write the test first, then let the agent implement.

3. **Watch for agents deleting tests.** Beck has found that agents will sometimes delete tests to make them "pass" — the genie fulfilling the letter of the wish while violating the spirit. This is why human review of agent diffs remains essential.

4. **Code quality still matters.** Beck doesn't call it "vibe coding" because he cares what the code looks like: "If I don't care what the code looks like, the genie just can't make heads or tails of it."

5. **Experiment with everything.** "The whole landscape of what's 'cheap' and what's 'expensive' has shifted. Things we didn't do because we assumed they were going to be expensive or hard just got ridiculously cheap."

### Application to Product Research

Beck's "experiment with everything" philosophy directly applies to product discovery: AI makes it cheap to explore more product hypotheses, generate more user personas, simulate more competitive analyses, and test more assumptions than you ever could manually. The key is having a feedback mechanism (tests for code, validation criteria for product decisions) to tell you which experiments succeeded.

**Sources:**

- The Pragmatic Engineer podcast: https://newsletter.pragmaticengineer.com/p/tdd-ai-agents-and-coding-with-kent
- Spotify episode: https://open.spotify.com/episode/1S28nbYSgRoFwvRrC8w0QI

---

## 6. Shape Up (Basecamp) — Shaping Before Building

**What it is:** A product development methodology introduced by Ryan Singer at Basecamp in 2019, now experiencing a renaissance in the AI era.

**Why it matters for AI-agent workflows:** Shape Up's core thesis — that the hardest part of product development is deciding _what_ to build, not _how_ — has become the central challenge of the AI age. When AI can generate thousands of lines of code in seconds, the bottleneck shifts entirely to problem definition.

### Three Phases

1. **Shaping** — Define a narrow problem, set a fixed time appetite, sketch a rough solution, and preempt risks. Shaping is senior work — it requires understanding both the product and the technical landscape.

2. **Betting** — Leadership reviews shaped pitches and decides which to fund for the next cycle. No backlogs — if a pitch doesn't get picked, it has to be re-pitched (or it dies, which is fine).

3. **Building** — A small team gets the shaped work and has full autonomy to execute. Work is organized into "scopes" (vertical slices), not tasks.

### Key Principles Relevant to AI-Agent Workflows

- **Fixed time, variable scope.** Instead of estimating how long a feature will take, you set a time budget ("appetite") and scope down to fit. With AI agents, this becomes: set a context-window budget and scope the task to fit.

- **No backlogs.** Backlogs are a graveyard of good intentions. If something matters, it will come back up. This prevents "ticket farming" where AI agents churn through a massive backlog of low-value work.

- **Circuit breaker.** If a project isn't on track within its appetite, it's not extended — it's canceled and reshaped. This prevents the sunk cost fallacy that plagues AI-generated code: just because the agent wrote 2,000 lines doesn't mean you should ship them.

- **Shaping is the bottleneck.** In Shape Up, the most valuable work is defining _what_ to build with enough clarity that a team can execute without daily direction. In AI-agent workflows, this is exactly equivalent to writing a good spec.

### AI-Era Renaissance

As one analyst wrote in 2025: "With AI handling much of the 'how' to write code, our focus shifts dramatically to 'what' needs to be built and why. That's precisely what Shape Up concentrates on."

**Sources:**

- Full book (free): https://basecamp.com/shapeup
- AI-era analysis: https://www.bulaev.net/p/shape-up-the-product-development
- LogRocket overview: https://blog.logrocket.com/product-management/what-is-shape-up-methodology/
- Sachin Rekhi's analysis: https://www.sachinrekhi.com/basecamp-shape-up

---

## 7. Teresa Torres — Continuous Discovery Habits

**Who:** Product discovery coach, author of _Continuous Discovery Habits_. Has trained product teams at companies of all sizes. In 2025–2026, has personally adopted Claude Code for her own work and product building.

**Why it matters:** Torres' framework is the gold standard for structured product discovery. Her methods give you specific techniques for asking the right questions — which is exactly what you need when using an AI agent as a product thinking partner.

### The Continuous Discovery Cadence

Discovery isn't a phase — it's a weekly habit:

1. **Start with a measurable outcome.** Not "build a Pomodoro app" but "reduce the number of users who abandon a focus session midway by 30%."

2. **Run interviews every week.** Not surveys. Not analytics. Actual conversations with real people about their real behavior.

3. **Map insights into an Opportunity Solution Tree:**

   ```
   Desired Outcome
   ├── Opportunity A (user pain point)
   │   ├── Solution 1
   │   │   ├── Assumption Test
   │   │   └── Assumption Test
   │   └── Solution 2
   ├── Opportunity B
   │   └── Solution 3
   └── Opportunity C
   ```

4. **Pick ONE opportunity to focus on.** Not three. One.

5. **Brainstorm multiple solutions** for that one opportunity. Don't fall in love with the first idea.

6. **Run small assumption tests** before committing to build. What's the riskiest assumption? Test that first.

### The Mom Test (Complementary Framework)

From Rob Fitzpatrick's book, referenced by Torres and widely used in product discovery:

**Three rules:**

1. Talk about their life, not your idea
2. Ask about specifics in the past, not hypotheticals about the future
3. Talk less, listen more

**Bad:** "Would you use an app that helps you focus?"
**Good:** "Tell me about the last time you tried to focus on deep work. What happened?"

### Application to AI-Agent Product Research

An AI agent can serve as a structured thinking partner using Torres' framework:

- Generate interview questions using Mom Test principles
- Help map discovered opportunities into an Opportunity Solution Tree
- Challenge your assumptions by role-playing skeptical users
- Identify the riskiest assumptions and suggest lightweight tests

Torres herself has been building AI products using Claude Code, finding that focusing deeply on one AI tool (rather than trying everything) produces better results.

**Sources:**

- Product Talk (Torres' site): https://www.producttalk.org/
- Lenny's Newsletter interview: https://www.lennysnewsletter.com/p/teresa-torres-on-how-to-interview
- Step-by-step AI product discovery guide: https://www.news.aakashg.com/p/teresa-torres-podcast
- AI impact on product discovery: https://suprainsider.substack.com/p/37-how-ai-is-impacting-product-discovery
- Continuous Discovery framework overview: https://userpilot.com/blog/continuous-discovery-framework-teresa-torres/

---

## 8. Wondel.ai & the Agent Skills Ecosystem

**What it is:** An open-source collection of 41+ business and engineering frameworks — distilled from bestselling books — packaged as installable skills for Claude Code and other AI agents.

**Why it matters:** Instead of encoding product frameworks into prompts yourself, you can install battle-tested skills that give your AI agent expertise in JTBD, Mom Test, Lean Startup, Design Sprint, Continuous Discovery, and more.

### Available Product Discovery Skills

| Skill                  | Based On                                      | What It Does                                                 |
| ---------------------- | --------------------------------------------- | ------------------------------------------------------------ |
| `jobs-to-be-done`      | Clayton Christensen, _Competing Against Luck_ | Discover the "job" users hire your product for               |
| `mom-test`             | Rob Fitzpatrick, _The Mom Test_               | Structure customer interviews that produce truthful insights |
| `lean-startup`         | Eric Ries, _The Lean Startup_                 | Design MVPs, run validated experiments, decide pivots        |
| `continuous-discovery` | Teresa Torres, _Continuous Discovery Habits_  | Weekly discovery cadence, opportunity solution trees         |
| `design-sprint`        | Jake Knapp, _Sprint_                          | 5-day sprint from sketch to testable prototype               |
| `inspired`             | Marty Cagan, _Inspired_                       | Product management best practices                            |
| `lean-ux`              | Jeff Gothelf, _Lean UX_                       | UX research and validation techniques                        |

### Installation

```bash
# Install all product skills
npx skills add wondelai/skills/product-strategy
npx skills add wondelai/skills/product-innovation

# Or install individual skills
npx skills add wondelai/skills/jobs-to-be-done
npx skills add wondelai/skills/mom-test
npx skills add wondelai/skills/lean-startup
```

### Example Usage

```
You: Help me write interview questions to discover the job our users
     hire our Pomodoro app for. Use jobs-to-be-done skill.

You: Build a Build-Measure-Learn experiment card and a 5-day sprint plan
     to go from sketches to testable prototype. Use lean-startup and
     design-sprint skills.
```

### Related Projects

- **deanpeters/Product-Manager-Skills** — Product management skills framework for Claude Code, includes discovery cycle tools and JTBD probing scripts
- **VoltAgent/awesome-agent-skills** — Curated directory of 380+ agent skills from official teams and the community

**Sources:**

- Wondel.ai Skills: https://skills.wondel.ai
- GitHub repo: https://github.com/wondelai/skills
- Product Manager Skills: https://github.com/deanpeters/Product-Manager-Skills
- Awesome Agent Skills: https://github.com/VoltAgent/awesome-agent-skills

---

## 9. Synthesis — Comparison & Recommended Workflow

### Methodology Comparison

| Methodology                      | Strength                                  | Best For                            | Limitation                                       |
| -------------------------------- | ----------------------------------------- | ----------------------------------- | ------------------------------------------------ |
| **BMAD**                         | Most complete end-to-end agent pipeline   | Full product lifecycle, team-scale  | Heaviest setup; overkill for early exploration   |
| **GitHub Spec Kit**              | Agent-agnostic, structured checkpoints    | Teams using multiple AI tools       | Focused on specs, not discovery/ideation         |
| **Osmani's Spec-First**          | Clearest practical writing on agent specs | Individual engineers writing specs  | Guidance, not a tool — you implement it yourself |
| **Cherny's CLAUDE.md**           | Purpose-built for Claude Code             | Claude Code users                   | Narrower than full methodology                   |
| **Beck's TDD**                   | Safety net for agent output               | Any agent-generated code            | About verification, not discovery                |
| **Shape Up**                     | Best problem-framing discipline           | Feature-level product decisions     | No specific AI tooling                           |
| **Torres' Continuous Discovery** | Best structured questioning framework     | Ongoing product research            | Assumes access to real users for interviews      |
| **Wondel.ai Skills**             | Instant framework access, zero setup      | Quick application of proven methods | Skills are prompts, not full workflows           |

### Recommended Phased Approach for PomoFocus

**Phase 1: Problem Discovery (do this now)**
Use Continuous Discovery + Mom Test + JTBD techniques to deeply understand:

- Who are the target users? (Not "everyone who wants to focus" — be specific)
- What job are they hiring a Pomodoro app for?
- What do they currently do? Where does it break down?
- What would success look like for them?

**Phase 2: Product Definition**
Use Shape Up "shaping" to define:

- What's the appetite? (How much are you willing to invest in the first version?)
- What's the rough solution? (Broad strokes, not wireframes)
- What's explicitly out of scope?
- What are the rabbit holes to avoid?

**Phase 3: Specification**
Use GitHub Spec Kit or Osmani's spec-first approach to produce:

- A `product-brief.md` (the "what and why")
- A `prd.md` with measurable success criteria
- Architecture constraints from the existing research (files `01`–`05`)

**Phase 4: Implementation Planning**
Use BMAD's story-generation approach or Spec Kit's `/tasks` to break the spec into agent-ready GitHub Issues, then follow the workflow established in `research/02-github-for-agents.md`.

---

## 10. Applying This — Claude Code Skill vs. Subagent vs. Installed Skills

### The Question

You've researched the methodologies. Now how do you actually _use_ them day-to-day in Claude Code?

### Three Options

| Approach                              | What It Is                                                                | Best For                                                      |
| ------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Claude Code Skill**                 | A `/discover` slash command defined in `.claude/skills/discover/SKILL.md` | Interactive product discovery conversations                   |
| **Specialized Subagent**              | An agent defined in `.claude/agents/` with a product-researcher persona   | Automated research tasks (competitor analysis, market sizing) |
| **Installed Skills (Wondel.ai etc.)** | Pre-built framework skills you install from the community                 | Quick access to specific frameworks (JTBD, Mom Test)          |

### Recommendation: Build a `/discover` Skill + Install Framework Skills

**A Claude Code skill is the best fit for interactive product discovery.** Here's why:

1. **Skills are conversational.** You invoke `/discover` and enter a structured dialogue. The skill probes, challenges assumptions, asks follow-up questions, and refines your thinking. This matches how product discovery actually works — it's a conversation, not a one-shot task.

2. **Skills produce artifacts.** The skill can write `product-brief.md`, `prd.md`, and opportunity solution trees to disk as versioned files.

3. **Skills encode methodology.** The `SKILL.md` can bake in the best practices from BMAD's Analyst agent, Torres' Continuous Discovery cadence, Mom Test questioning rules, and Shape Up's shaping principles.

4. **Skills are repeatable.** Every time you run `/discover`, you get the same structured process. No need to remember the right prompts.

**Complement with installed Wondel.ai skills** for framework-specific deep dives:

- `/mom-test` when preparing for user interviews
- `/jtbd` when analyzing what job users hire the product for
- `/lean-startup` when designing experiments

**Use subagents for automated research:**

- Competitor analysis (delegated to an agent that reads competitor sites)
- Market sizing (delegated to an agent with web search)
- Technical feasibility research (delegated to an Explore agent)

### Proposed `/discover` Skill Structure

```
Phase 1: Problem Space
  "What problem are you solving?"
  "Who has this problem today? Be specific."
  "How do they currently deal with it?"
  "What happens when their current approach fails?"

Phase 2: User Understanding
  "Describe your target user. What's their day like?"
  "When was the last time they experienced this problem?"
  "What have they already tried?"
  [Applies Mom Test + JTBD questioning]

Phase 3: Opportunity Mapping
  Generates an Opportunity Solution Tree from the conversation
  Identifies the riskiest assumptions
  Ranks opportunities by impact and feasibility

Phase 4: Product Brief
  Writes `product-brief.md` with:
  - Problem statement
  - Target users (specific)
  - Jobs to be done
  - Current alternatives
  - Opportunity hypothesis
  - Out of scope (explicit)
  - Riskiest assumptions to test first
```

### Follow-Up Work

Creating the actual `/discover` skill (`.claude/skills/discover/SKILL.md`) is a separate task. This research document provides the foundation; the skill implements it.

---

## Research Notes

- All research synthesized from web searches performed March 2026
- BMAD Method is at v6, rapidly evolving — check the GitHub repo for latest
- GitHub Spec Kit was released in early 2026; the ecosystem is still forming
- Osmani's articles were published January–February 2026
- Wondel.ai skills are community-maintained; verify skill quality before relying on them
- Teresa Torres' AI-specific guidance is from podcast appearances and events in 2025–2026
- Shape Up's AI-era relevance is community-observed, not officially endorsed by Basecamp/37signals
