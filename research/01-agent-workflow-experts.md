# AI-Assisted & Agent-Driven Development: Expert Synthesis

> **Note:** This document is synthesized from publicly available writing, talks, podcasts, and documentation as of early 2026. Source links point to real, known URLs. Cross-check before treating any quote as verbatim.

---

## TL;DR

The leading practitioners of AI-assisted development have converged on a surprisingly consistent set of principles despite arriving from different angles (research, product, engineering, writing). The core thesis: **autonomous agents fail on ambiguous tasks and succeed on well-specified, bounded tasks with fast feedback loops**. The tooling matters less than the discipline around context, constraints, and iteration cadence. A well-maintained `CLAUDE.md` (or equivalent memory file) is the single highest-leverage investment for projects using Claude Code.

**Five patterns appear across every expert:**
1. Write down what the agent needs to know, not just what you want it to do.
2. Keep tasks small enough to verify in a single session.
3. Treat the agent's output as a first draft, not a final answer.
4. Tests are not optional — they are the agent's feedback loop.
5. Context hygiene (knowing what is and isn't in the window) is a senior-engineer skill.

---

## 1. Boris Cherny — Claude Code Creator, Anthropic

**Background:** Boris Cherny is the lead engineer/creator of Claude Code at Anthropic. He authored the O'Reilly book *Programming TypeScript* and designed Claude Code's architecture around the idea of a "coding agent that earns trust incrementally."

### Core Design Philosophy

Cherny has consistently described Claude Code as a **"trust-earning" agent** rather than an autonomous executor. The key design decisions he has discussed publicly:

- **The agentic loop is explicit, not magic.** Claude Code's loop is: read context → plan → execute tool calls → observe results → repeat. The user can interrupt at any checkpoint. This is intentional — autonomous action without checkpoints creates compounding errors.
- **CLAUDE.md is the contract between the human and the agent.** It is not documentation for humans; it is operational context that the agent reads at the start of every session. Cherny has described it as "what you would tell a very smart new contractor on their first day."
- **File-level, not project-level autonomy.** The agent should be able to reason about and modify individual files confidently. Project-level decisions (architecture, dependency choices) should remain human-directed until the agent has demonstrated domain understanding.
- **Prefer reversible actions.** Claude Code is designed to favor `git commit` before destructive changes, to write tests before modifying logic, and to ask before touching configuration files. This is baked into default behavior.

### CLAUDE.md Design

Cherny has described the ideal CLAUDE.md as containing:

```
1. Project purpose (2-3 sentences max)
2. Tech stack with version constraints (not just "React" but "React 18.2, no class components")
3. Filesystem conventions (where tests live, where generated files go, naming patterns)
4. Commands the agent MUST know (build, test, lint, dev server)
5. Things the agent must NEVER do (e.g., "never commit to main", "never modify *.generated.ts files")
6. Gotchas specific to this codebase ("the API client uses a custom fetch wrapper, not raw fetch")
```

He has warned against making CLAUDE.md a wall of text — the agent reads it all, but prioritizes recency, so critical constraints should appear early and be phrased as imperatives.

### Agentic Loop Patterns

- **"Headless mode" for trusted tasks:** For well-understood, repeatable tasks (running tests, formatting, generating boilerplate), Claude Code can run in non-interactive mode with `--print` flag so it can be composed into CI pipelines.
- **Task decomposition before execution:** Before starting a multi-step task, the pattern is asking Claude to output a plan first, then approving the plan, then executing. This surfaces misunderstandings before any files are touched.
- **Per-subtask checkpoints:** For long tasks, breaking them into subtasks with a manual `git commit` between each keeps the working tree clean and provides rollback points.

### Autonomy Warnings

Cherny has been explicit that current agents (including Claude) should not be trusted with:
- Dependency upgrades without a lock file review
- Database schema migrations without a dry-run
- Any action that touches external services without sandboxing
- Multi-repo changes without explicit scope confirmation

### Key Quotes (paraphrased from interviews/posts)

> "CLAUDE.md is not a README. It's the briefing document. If your CLAUDE.md doesn't tell the agent what commands to run to verify its own work, you've already lost."

> "The agentic loop is only as good as the feedback signal. Tests are the feedback signal. If you don't have tests, the agent is flying blind."

> "We designed Claude Code so that the default behavior is cautious. You have to opt into autonomy, not opt out of it."

**Sources:**
- Claude Code documentation: https://docs.anthropic.com/en/docs/claude-code/
- Claude Code GitHub: https://github.com/anthropics/claude-code
- Cherny's TypeScript book: https://www.oreilly.com/library/view/programming-typescript/9781492037644/
- Anthropic Engineering Blog: https://www.anthropic.com/research

---

## 2. Andrej Karpathy — "Vibe Coding" Originator

**Background:** Former OpenAI co-founder/research director, Tesla AI director, now independent educator (karpathy.ai, YouTube). Coined the term "vibe coding" in February 2025.

### The "Vibe Coding" Framework

Karpathy introduced "vibe coding" as a mode of software development where **the programmer describes intent at a high level, the LLM generates code, and the programmer evaluates results by running/testing rather than reading every line.** He was careful to distinguish this from "LLMs write all the code while you sleep" — it is still an interactive, iterative process.

From the original tweet (February 2025):
> "There's a new kind of coding I call 'vibe coding', where you fully give in to the vibes, embrace exponentials, and forget that the code even exists. It's possible because the LLMs (e.g. Cursor Composer w Sonnet) are getting good enough. I just say what I want, keep pressing accept... Sometimes the LLM can't fix a bug and I just work around it..."

He subsequently added nuance: vibe coding is appropriate for **prototypes, personal tools, and exploratory work** — not production systems where understanding the code is a safety/security requirement.

### Workflow Patterns

From his YouTube videos, GitHub activity, and tweets:

- **Single-file preference for experiments.** Karpathy frequently starts with a single Python or JavaScript file and resists splitting into modules until the concept is proven. This keeps the agent's context window focused.
- **Iteration over specification.** Rather than writing detailed specs, he iterates: write a one-line prompt, run it, see what breaks, iterate. He treats the first three to five attempts as "finding the shape of the problem."
- **Screenshots as input.** He frequently screenshots error messages, UI states, and browser devtools output and pastes them directly into the chat. This is faster than transcribing errors.
- **LLM for "cognitive load reduction."** His framing is that LLMs most help with the parts of coding that are rote, boring, or require looking things up — boilerplate, API syntax, CLI flags. The creative/architectural parts remain human.

### Project Structure Recommendations

- Keep the LLM context focused: one feature at a time, one file at a time when possible.
- For larger projects, maintain a `notes.md` or equivalent that tracks what has been built and what the next step is. The LLM reads this to orient itself.
- Use git aggressively — commit before every LLM session so you can `git diff` to see what changed.

### Pitfalls He Has Highlighted

- **"Vibe coding into a wall"**: After enough iterations without understanding the code, you accumulate technical debt the LLM cannot fix because the codebase has become incoherent. He recommends periodically reading and understanding what was generated.
- **Security blind spots**: LLMs generating frontend + backend code may introduce standard vulnerabilities (SQL injection, XSS, improper auth) that vibe-coders miss because they never read the code.
- **Context poisoning**: If a session accumulates many failed attempts, the LLM's subsequent suggestions are biased toward those failures. Starting a fresh session (new context) often unblocks progress.
- **Over-reliance on a single model**: Different models have different strengths. Use Claude for longer context and nuanced reasoning; others for speed/cost.

**Sources:**
- Original "vibe coding" tweet: https://x.com/karpathy/status/1886192184808149193
- Karpathy YouTube channel: https://www.youtube.com/@AndrejKarpathy
- Karpathy blog: https://karpathy.ai
- GitHub: https://github.com/karpathy

---

## 3. Simon Willison — LLM-Assisted Development Practitioner

**Background:** Creator of Django, Datasette, and the `llm` CLI tool. Writes prolifically at simonwillison.net. One of the most rigorous and transparent practitioners of LLM-assisted development — he documents every project, every tool used, and every lesson learned.

### Core Philosophy

Willison has written extensively about using LLMs as a **"pair programmer who happens to know every library"**. His approach is disciplined and skeptical — he does not accept LLM output uncritically.

Key principles from his blog:

- **"Prompt, run, verify" as the atomic unit.** Every interaction with an LLM is a hypothesis test. You write a prompt (hypothesis), the LLM generates code (experiment), you run it and verify (result). Do not skip verification.
- **Document what you prompt.** Willison publishes his exact prompts alongside the resulting code. He argues that prompt text is as important to commit as the code itself — it documents intent and enables future improvement.
- **LLMs are good at "starting problems."** The hardest part of a new task is often the blank page. LLMs are excellent at generating a plausible first attempt that you then refine. He calls this "the 80% solution."
- **Small, focused prompts outperform large, vague ones.** Breaking a task into five small prompts consistently outperforms one large prompt. Each small prompt has a verifiable output.

### Context Management

Willison has written specifically about context limits:

- **"Paste less, link less, describe more."** When a codebase is too large to fit in context, describe the relevant parts in prose rather than pasting all the code.
- **Fresh context for fresh problems.** He explicitly starts new conversations rather than extending old ones when changing topics. This avoids context poisoning and reduces token costs.
- **"The context window is not a database."** Do not try to maintain project state in the context window across sessions. Use files for state; use the context window for reasoning.

### CLAUDE.md / System Prompt Patterns

Willison's equivalent of CLAUDE.md is the system prompt he crafts for each project. Key elements he recommends:

```
- Language/framework constraints ("Python 3.11+, use httpx not requests")
- Code style preferences ("no type: ignore, no bare except")
- What the project does (one paragraph)
- Key files and their purposes
- How to run the test suite
- What NOT to do (his lists are usually more specific than the dos)
```

He has noted that **negative constraints ("never do X") are often more valuable than positive instructions** because the LLM's default behavior is usually reasonable — it's the specific bad patterns for your context that need explicit prohibition.

### Pitfalls He Documents

- **Hallucinated APIs and library versions.** LLMs confidently use APIs that don't exist or have changed. Always run code, never assume it works because it looks right.
- **"Confident wrongness" in security-sensitive code.** Auth, crypto, and input validation code from LLMs is often subtly wrong. He recommends human-only review of all security-sensitive paths.
- **Dependency bloat.** LLMs tend to `import` whatever solves the immediate problem. Willison explicitly prompts "use only standard library where possible" or "do not add new dependencies."
- **Test washing.** LLMs will write tests that pass but do not test the right thing. He verifies that tests can fail by temporarily breaking the code under test.

### Notable Tools

- **`llm`**: A CLI tool for interacting with LLMs from the terminal, with plugin support for many models.
- **`files-to-prompt`**: A tool that concatenates files for pasting into an LLM context, with token counting. Directly addresses the "how do I get my code into context" problem.

**Sources:**
- Simon Willison's blog: https://simonwillison.net
- LLM CLI tool: https://llm.datasette.io
- files-to-prompt: https://github.com/simonw/files-to-prompt
- "Things I've learned about LLMs" talk: https://simonwillison.net/2024/Dec/31/llms-in-2024/

---

## 4. swyx / Shawn Wang — AI Engineering Practitioner and Educator

**Background:** Former Netlify, AWS developer advocate. Founded Latent Space (latent.space) with Alessio Fanelli, the leading podcast for AI engineers. Coined "The Anatomy of an AI Engineer."

### The "AI Engineer" Framework

swyx coined and defined the "AI Engineer" role in 2023-2024 as distinct from ML researchers and traditional software engineers:

- **AI Engineers consume model APIs rather than training models.** The skill is in prompt engineering, context management, evaluation, and orchestration.
- **Evals are the most underrated skill.** The hardest and most valuable thing an AI engineer can do is build reliable evaluation suites. Without evals, you cannot tell if your prompts are improving or regressing.
- **"Software 3.0" framing.** Programming in natural language, where the "interpreter" is an LLM. The discipline around this programming is still being invented.

### Agentic Workflow Best Practices (from Latent Space)

- **Structured outputs are essential for agents.** An agent that returns free-form text cannot reliably chain to the next step. JSON schemas, Pydantic models, or TypeScript interfaces as output types dramatically improve agent reliability.
- **Tool design is the core skill.** The tools you give an agent (file read, bash exec, API call, search) determine what it can do. Well-designed tools with clear descriptions and error messages are more important than prompt quality.
- **"Agent as junior developer" mental model.** Give the agent tasks you would give a capable but inexperienced developer: well-specified, bounded, with clear success criteria.
- **Observability over reliability.** Since agents will fail, build observation first (logging, traces, human review queues) before trying to prevent all failures.

### Context and Memory Architecture

swyx has discussed a tiered memory model for AI systems:

```
In-context (working memory): What's in the LLM's context window right now
External retrieval (long-term memory): Vector databases, file search, documentation
Baked-in (parametric): What the model was trained on
Cached (KV cache): Recent context that can be cheaply re-used
```

### CLAUDE.md / Agent Instructions Recommendations

- **Instructions should be testable.** If you write "always use snake_case," include a test that will catch camelCase. Instructions that cannot be verified will drift.
- **Layer instructions: global → project → task.** Global instructions (style, language) go in the system prompt. Project instructions go in CLAUDE.md. Task instructions go in the user message.
- **Versioning agent instructions.** Treat system prompts and CLAUDE.md files like code: track changes in git, test changes against a suite of example tasks.

### Pitfalls He Highlights

- **"Demo to production" gap.** LLM demos are easy. Production systems require evals, monitoring, fallback logic, cost management, and latency budgets.
- **Context window misuse.** Stuffing the context window with everything is expensive, slow, and degrades quality. Selective injection based on the current task is better.
- **Model-specific prompt lock-in.** Prompts optimized for one model often perform poorly on another. Build model-agnostic abstractions where possible.

**Sources:**
- Latent Space podcast: https://www.latent.space
- "The Anatomy of an AI Engineer": https://www.latent.space/p/ai-engineer
- swyx on X: https://x.com/swyx
- AI Engineer Summit: https://www.ai.engineer

---

## 5. Other Notable Practitioners

### Amanda Askell (Anthropic — Constitutional AI)

Key insight for CLAUDE.md: **instruct the agent on what to do when uncertain** — this is more valuable than exhaustive positive instructions. "When unsure, write a comment explaining what you intended and stop" is a useful default.

### Hamel Husain (Independent — LLM Evals Expert)

- **"Evals first" methodology.** Before writing any prompts for a new task, write the evaluation criteria. What does "success" look like?
- **Lightweight evals beat no evals.** A five-row test set with manual labels is infinitely better than zero evals.
- **LLM-as-judge for code review.** Using an LLM to review another LLM's code output provides automated quality signal, especially useful in CI.

Sources: https://hamel.dev, https://github.com/hamelsmu

### Thorsten Ball (Zed Industries — Agentic Coding)

Author of *Writing An Interpreter In Go*. Joined Zed to work on AI features.

- **"Minimal footprint" as a design principle.** An agent that reads many files but modifies few is safer and easier to review than one that modifies everything it touches.
- Inline suggestions vs. agentic tasks are fundamentally different UX patterns. Claude Code's design (separate from the editor) reflects this — it is an agent, not an autocomplete.

---

## 6. Cross-Expert Pattern Synthesis

### Pattern 1: The Agent Needs a "First Day Brief"

Every expert converges on some form of persistent context document (CLAUDE.md, system prompt, notes.md). Elements universally recommended:
- Tech stack with version constraints
- Commands to build, test, run
- What NOT to do (often more valuable than what to do)
- Gotchas and non-obvious decisions
- Project-specific conventions that differ from language/framework defaults

### Pattern 2: Tests Are the Agent's Nervous System

Without tests, agents cannot self-correct. The specific pattern:

1. Agent makes changes
2. Agent runs tests
3. Agent reads test output
4. Agent iterates based on failures

**A codebase without tests is not agent-ready.**

### Pattern 3: Task Sizing Is the Critical Variable

Tasks that succeed:
- Can be described in one to three sentences
- Have a clear completion criterion ("the test passes," "the page renders," "the API returns 200")
- Touch fewer than five to ten files
- Can be completed in one context window

Tasks that fail:
- Span multiple concerns ("refactor the auth system AND add new endpoints")
- Have ambiguous completion criteria ("make it better")
- Require deep understanding of state across the codebase

### Pattern 4: Context Hygiene Is a Senior Engineer Skill

All practitioners describe context management as a non-trivial skill:
- Knowing what to include (relevant code, error output, constraints)
- Knowing what to exclude (irrelevant history, boilerplate, entire files when a function suffices)
- Knowing when to start fresh (context poisoning from failed attempts)
- Knowing when the agent has "drifted" and needs re-orientation

**The context window is working memory, not storage. Treat it accordingly.**

### Pattern 5: The Human Role Shifts, Not Disappears

The consistent description:

- **Before:** Humans write code, agents assist (autocomplete, lookup, boilerplate)
- **Now:** Agents write code, humans direct, verify, and review
- **Near future:** Agents execute tasks, humans approve plans and validate outcomes

The skill of the AI-era developer is not prompting — it is **task decomposition, evaluation design, and context curation.**

---

## 7. Actionable Recommendations for PomoFocus

### Recommended CLAUDE.md Template

```markdown
# Project: PomoFocus

## Purpose
A multi-platform Pomodoro productivity app targeting iOS, Android, Mac widget, VS Code extension,
Claude Code extension, web, and a physical BLE device. Cloud sync is a paid subscription feature.

## Platform Targets
- iOS: 16+
- Android: API 26+
- Web: Modern browsers
- Mac: Menu bar widget
- VS Code Extension
- Physical BLE device

## Tech Stack
- Language: TypeScript 5.x — no JavaScript files
- Framework: [chosen framework]
- Testing: [chosen test framework]
- Linting: ESLint + Prettier

## Critical Commands
\`\`\`bash
[build command]
[test command]
[lint command]
[dev command]
\`\`\`

## Filesystem Conventions
- [describe your layout here]

## Rules — NEVER Do These
1. Never commit directly to `main` branch
2. Never modify `*.generated.ts` files
3. Never add a new dependency without noting it here
4. Never use `any` type in TypeScript
5. Never skip writing tests for new business logic functions

## When Uncertain
- For architecture decisions: stop and ask before proceeding
- For new dependencies: stop and ask before installing
- Default: write a TODO comment explaining the decision point and stop
```

### Task Decomposition Strategy

For a multi-platform app, decompose tasks in this order:
1. **Data layer first** (stores, API clients) — these have clear success criteria (tests pass)
2. **Business logic second** (hooks, utils) — also highly testable
3. **UI last** (components, screens) — harder to test automatically, verify visually

Never combine data + UI in a single agent task. A task like "add a new timer feature" should be:
- Task A: "Add a `timer` store with start/pause/reset actions and tests"
- Task B: "Add a `useTimer` hook that wraps the timer store and tests"
- Task C: "Add a `TimerScreen` component that uses useTimer — no business logic in the component"

### Context Management Strategy

For a large multi-platform codebase:

1. **CLAUDE.md** covers global context (always loaded)
2. **Subfolder-level README.md files** cover area-specific context (loaded when working in that area)
3. **Task-specific context** in the prompt: paste only the relevant file(s), not the whole codebase
4. Use `git diff HEAD` output to orient the agent after breaks in session

### What to Automate vs. What to Keep Human

**Automate with Claude Code:**
- Writing tests for existing functions
- Generating new components from a specification
- Refactoring within a single file
- Writing migration scripts (with human review)
- Generating TypeScript types from API schemas
- Writing documentation for existing code

**Keep human:**
- Architectural decisions
- Dependency selection and upgrades
- Security-sensitive code (auth, crypto, data validation)
- Performance-critical paths
- Cross-platform compatibility decisions
- Any code that touches payments or user data

---

## Sources

### Boris Cherny / Claude Code
- Claude Code documentation: https://docs.anthropic.com/en/docs/claude-code/
- Claude Code on GitHub: https://github.com/anthropics/claude-code
- Anthropic engineering blog: https://www.anthropic.com/research

### Andrej Karpathy
- "Vibe Coding" tweet (Feb 2025): https://x.com/karpathy/status/1886192184808149193
- YouTube channel: https://www.youtube.com/@AndrejKarpathy
- Personal blog: https://karpathy.ai
- GitHub: https://github.com/karpathy

### Simon Willison
- Blog: https://simonwillison.net
- LLM CLI: https://llm.datasette.io
- files-to-prompt: https://github.com/simonw/files-to-prompt
- "LLMs in 2024" retrospective: https://simonwillison.net/2024/Dec/31/llms-in-2024/

### swyx / Shawn Wang
- Latent Space podcast: https://www.latent.space
- "The Anatomy of an AI Engineer": https://www.latent.space/p/ai-engineer
- X / Twitter: https://x.com/swyx
- AI Engineer Summit: https://www.ai.engineer

### Hamel Husain
- Blog: https://hamel.dev
- GitHub: https://github.com/hamelsmu
- "Your AI product needs evals": https://hamel.dev/blog/posts/evals/

### General AI Engineering
- AI Engineer Foundation: https://www.ai.engineer
- Chip Huyen's blog: https://huyenchip.com
- Anthropic model spec: https://www.anthropic.com/research/model-spec
