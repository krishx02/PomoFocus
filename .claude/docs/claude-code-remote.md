# Claude Code — Remote Environments

> Reference for running Claude Code outside of your local machine.

---

## Three Modes

| Mode | Your machine needs to be on? | Repo access |
|------|------------------------------|-------------|
| **SSH Sessions** | Yes (remote machine needs to be on) | Remote machine's filesystem |
| **Cloud Sessions** | No | Cloned directly from GitHub |
| **Remote Control** | Yes (your local machine) | Your local filesystem |

---

## Cloud Sessions (Most Relevant for Agent Workflow)

Anthropic-managed VMs that clone your GitHub repo and run Claude completely independently of your local machine.

### How it works
1. Claude clones your repo from GitHub into an Anthropic VM
2. Runs the task (implements, tests, etc.)
3. Pushes changes to a git branch
4. You review the diff and create a PR — or Claude does it automatically

### Starting a cloud session

**Via web** (easiest): Visit [claude.ai/code](https://claude.ai/code), connect GitHub, submit a task.

**Via CLI:**
```bash
claude --remote "Fix the authentication bug in src/auth/login.ts"
```

Monitor progress:
```bash
/tasks
```

Teleport from cloud back to local terminal:
```bash
/teleport
```

### Pre-installed in the cloud VM
Node.js (LTS), Python 3.x, Ruby, Go, Rust, Java, PostgreSQL 16, Redis 7, Docker CLI, Git, pnpm, bun, yarn.

### Network access
Configure in the environment selector: **limited** (allowlisted domains only, default) / **full** / **none**.

### Pricing
- **Not free** — uses Claude API tokens, same as local sessions
- **No separate VM compute charge** — Anthropic absorbs infrastructure cost; you only pay token rates
- Average: ~$6/dev/day; 90% of users stay under $12/day
- Track usage: `/cost` command inside any session

Requires Pro, Max, Team, or Enterprise plan.

---

## Automatic PR Workflow

Cloud sessions can open PRs automatically. Three approaches:

### Option A: Web interface
1. Go to [claude.ai/code](https://claude.ai/code)
2. Connect GitHub + install the Claude GitHub app
3. Submit a task → Claude shows a diff
4. Click "Create PR"

### Option B: `--remote` flag (CLI)
```bash
claude --remote "Implement feature X per the spec in .claude/specs/feature-x.md"
```
Session runs in cloud, pushes branch, PR link available in web interface.

### Option C: GitHub Actions — `@claude` mentions (most autonomous)

Install the GitHub app via:
```bash
/install-github-app
```

Or manually add the workflow:
```yaml
# .github/workflows/claude.yml
on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]

jobs:
  claude:
    runs-on: ubuntu-latest
    steps:
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

Then in any GitHub Issue or PR comment:
```
@claude implement the feature described in this issue
```

Claude will: analyze the repo → implement → run tests → open a PR. No human steering required.

---

## SSH Sessions

Claude Code runs on a remote machine you control (cloud VM, dev container, etc.).

**Setup (desktop app):**
1. Click environment dropdown → **+ Add SSH connection**
2. Provide: host (`user@hostname` or SSH config alias), port (default 22), identity file
3. Claude Code must be installed on the remote machine

Your remote filesystem, MCP servers, and all tools are available just as if running locally.

---

## Remote Control

Your local session stays on your machine but is accessible from any browser or mobile device.

```bash
claude remote-control
```

Or from inside a session: `/remote-control`

- Outbound HTTPS only — no inbound ports opened
- Your local MCP servers, files, and tools remain available
- Requires Max plan (Pro support coming)
- **Your computer must be on**

---

## For PomoFocus Agent Workflow

| Use case | Best approach |
|----------|---------------|
| Agent picks up GitHub Issue → ships PR | `@claude` GitHub Actions (Option C above) |
| Manual cloud task | `claude --remote "..."` |
| Accessing dev setup from phone/tablet | Remote Control |
| Connecting to a hosted server | SSH Sessions |

The `@claude` GitHub Actions approach is the most aligned with the agent-first workflow — agents autonomously pick up labeled issues and open PRs with no local machine required.
