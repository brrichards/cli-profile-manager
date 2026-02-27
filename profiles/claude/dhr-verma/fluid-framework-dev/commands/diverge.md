---
name: diverge
description: Multi-agent brainstorming protocol. Use when facing a non-trivial decision, choosing between approaches, or needing fresh ideas on a stuck problem.
---

# Diverge

## When to diverge

- Choosing between 2+ valid approaches
- A fix has failed 3+ times (invoke **go-deeper** first to find the right level, then diverge there)
- User suggests a direction change
- Adding a new system or component
- Critique results plateau despite iteration
- **You already know the answer.** This is the most important trigger. If your first instinct is to skip divergence because the solution is "obvious," that's anchoring bias — the exact failure mode divergence prevents. At minimum, name 3 structural alternatives before committing to any one.

## The 3-Option Rule

Every non-trivial architectural decision gets at least 3 distinct proposals: **conservative** (minimal change), **balanced** (moderate restructuring), **radical** (rethink from scratch). This is not optional — it's how you avoid anchoring on the first idea.

## Protocol

### 1. Frame the question

Write a design brief with:
- **Context**: What the system does, what's been tried
- **Problem**: What's not working or what decision needs making
- **Constraints**: What must be preserved, what's negotiable
- **Reference docs**: Vision, architecture, existing design decisions

Do NOT include your preferred solution. Let agents think freely.

### 2. Generate alternatives

Launch 3+ agents with the SAME brief. **Use top-tier frontier models from different families** (e.g., `claude-opus-4.6`, `gpt-5.2`). Design thinking requires the strongest reasoning — do not use fast/cheap models (Haiku, mini, codex-mini) for ideation.

Each agent gets these instructions:
> "Think as a creative director. Cost, feasibility, and refactor scope are NOT your concern during ideation. Propose your boldest idea. Do not self-censor toward practical or incremental — that's someone else's job."

No agent sees another's proposal. Independence prevents anchoring.

### 3. Collect raw

Present all proposals without commentary or ranking. Hand off to the **converge** skill for evaluation.

## Anti-patterns

- **Anchoring**: Including your current approach biases ideation. Frame the problem, not the solution.
- **Premature convergence**: Don't pick the first reasonable idea. Let all proposals develop before comparing.
- **Self-censoring**: Agents naturally filter toward safe/incremental. The explicit "don't self-censor" instruction counters this.
- **Too few options**: 2 options creates a false binary. 3 is the minimum; scale with stakes.
