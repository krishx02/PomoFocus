# Branch Protection Rules — `main`

This document specifies the required branch protection settings for the `main` branch. These rules ensure that broken code cannot be merged into main.

## Required Settings

### 1. Require Pull Requests Before Merging

- **Enabled:** Yes
- Direct pushes to `main` are blocked — all changes must go through a pull request.
- Required approving reviews: **0** (single developer workflow; no code review required for now).
- Do NOT configure CODEOWNERS.

### 2. Require Status Checks to Pass Before Merging

- **Enabled:** Yes
- **Require branches to be up to date before merging:** Yes
- **Required status checks:**
  - `Lint, Test, Type-check, Build` (from the `CI` workflow in `.github/workflows/ci.yml`, job `ci`)

### 3. Restrict Force Pushes

- **Allow force pushes:** No
- No one can force-push to `main`.

### 4. Restrict Deletions

- **Allow deletions:** No
- The `main` branch cannot be deleted.

## Settings NOT Configured (Out of Scope)

- Required code reviews (single developer for now)
- CODEOWNERS file
- Signed commits
- Linear history requirement

## Applying via GitHub UI

1. Go to **Settings > Branches** in the GitHub repository.
2. Click **Add branch protection rule** (or edit the existing `main` rule).
3. Set **Branch name pattern** to `main`.
4. Enable **Require a pull request before merging**. Set required approvals to 0.
5. Enable **Require status checks to pass before merging**.
6. Check **Require branches to be up to date before merging**.
7. Search for and add the required status check: `Lint, Test, Type-check, Build`.
8. Disable **Allow force pushes**.
9. Disable **Allow deletions**.
10. Click **Save changes**.

## Applying via `gh` CLI

Run the following command from the repository root (requires admin access):

```bash
gh api repos/{owner}/{repo}/branches/main/protection \
  --method PUT \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["Lint, Test, Type-check, Build"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
```

> **Note:** `required_pull_request_reviews` must be an object (even with 0 approvals) to block
> direct pushes to `main`. Setting it to `null` only enforces status checks — it does not
> require a PR. The GitHub UI toggle "Require a pull request before merging" maps to this field.

To verify the rules are applied:

```bash
gh api repos/{owner}/{repo}/branches/main/protection --jq '.required_status_checks'
```

Expected output should show `strict: true` and the `Lint, Test, Type-check, Build` context.

## Referenced ADRs

- [ADR-009 — CI/CD Pipeline Design](../research/decisions/009-ci-cd-pipeline-design.md)
