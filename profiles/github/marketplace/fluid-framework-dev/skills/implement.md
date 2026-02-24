---
name: implement
description: End-to-end feature/fix workflow — from GH issue or prompt to merged PR
argument-hint: "#<issue-number> or plain-text description"
---

# /implement — End-to-end feature/fix workflow

Orchestrates the full lifecycle: input → plan → implement → build/test → lint → review → PR.
**CRITICAL** Only execute commands that are mentioned in this document. Do NOT execute other commands.

**Input:** The argument — either a GH issue reference (`#123`) or a plain-text feature description.

---

## Phase 1: Parse Input

If the argument matches `#<digits>` or contains `github.com` and `/issues/`, extract the issue number and run:

```bash
gh issue view <number> --repo microsoft/FluidFramework --json title,body,labels,comments
```

Structure the result into a **feature brief**:
- **Title**, **Description**, **Acceptance criteria** (checklists from the body), **Labels**

Otherwise treat the argument as the description directly.

Show the feature brief to the user before continuing.

---

## Phase 2: Plan

Invoke **@planner**. Pass it the feature brief from Phase 1 as the prompt.

Once it returns, **present the plan clearly to the user and wait for explicit approval.**
Do not continue to Phase 3 until the user approves.

---

## Phase 3: Create Branch

```bash
gh api user --jq '.login'
git checkout -b <github-username>/<camelCase-feature-slug-from-plan>
```

Example: `git checkout -b dhr-verma/addHealthEndpoint`

Confirm the branch was created before continuing.

---

## Phase 4: Implement

Invoke **@coder**. Pass it the full approved plan as the prompt.

If the agent reports a build failure, invoke **@coder** again with the error output and the original plan, asking it to fix only the reported errors. Repeat up to **3 attempts** total. If still failing, surface the errors to the user and halt.

---

## Phase 5: Build & Test

```bash
pnpm run build:compile
pnpm run test
```

If tests fail, invoke **@coder** with the test failure output and the original plan, asking it to fix only the failing tests. Re-run `pnpm run build:compile` and `pnpm run test` after each fix. Repeat up to **2 attempts**. If still failing, surface the failures to the user and **halt**.

---

## Phase 6: Lint Fix

```bash
pnpm run lint:fix
```

If this modifies any files, stage those changes and report which files were touched. If there are lint failures, invoke **@coder** with the failure output and the original plan, asking it to fix only the error. Re-run `pnpm run build:compile` and `pnpm run test` after each fix. Repeat up to **2 attempts**. If still failing, surface the failures to the user and **halt**.

---

## Phase 7: Code Review — Cycle 1

Invoke **@reviewer**. Pass it a summary of what was changed and why (from the plan and the coder's file list).

- **BLOCKING issues found** → invoke **@coder** with the review output and original plan to fix them. Proceed to Cycle 2.
- **Only NON-BLOCKING issues (or none)** → collect the notes for the PR description and skip to Phase 9.

---

## Phase 8: Code Review — Cycle 2

Re-invoke **@reviewer** on the updated code.

- **No blocking issues** → proceed to Phase 9.
- **Blocking issues remain** → present a summary to the user, **halt**, and ask how to proceed. Do not create the PR.

---

## Phase 9: Create PR

```bash
git add <specific files only — never git add -A>
git commit -m "<type(scope): description>"
gh pr create --title "[Copilot generated PR] <concise description under 60 chars>" --body "$(cat <<'EOF'
## Summary
- <bullet 1>
- <bullet 2>

## Test plan
- [ ] `pnpm run build:compile` passes
- [ ] `pnpm run test` passes
- [ ] <feature-specific scenario>

## Related
Closes #<issue number if applicable>

## Review notes
<non-blocking notes from review, if any>
EOF
)"
```

Return the PR URL to the user.
