---
name: go-deeper
description: Root-cause analysis and redesign protocol. Use when a fix keeps failing, you're stuck in a loop, or patching symptoms instead of fixing causes.
---

# Go Deeper

## When to go deeper

| Signal | Action |
|--------|--------|
| Single failure with clear cause | Fix it directly |
| Same failure class in multiple areas | Design question → diverge |
| 3+ fix attempts on the same problem | **Stop. Trace the root cause.** |
| Critique scores plateau despite iterations | Rethink evaluation OR architecture |
| Patching at the current layer isn't working | Go back to an earlier layer |

## "Go Back to Move Forward"

When a higher layer can't succeed because a lower layer doesn't support it, the right fix is at the lower layer — even if it means:
- Rewriting foundational code
- Resetting all tests from scratch
- Invalidating prior critique results

This is not waste. This is finding the right level of abstraction.

**Anti-pattern: Reward hacking** — making surface changes that improve metrics without fixing the underlying problem. If the data model doesn't support the feature, fix the data model. Don't patch the presentation layer.

## Protocol

### 1. Stop fixing

Explicitly acknowledge the current approach isn't working. State what you've tried and why it failed.

### 2. Trace the layers

- **Surface**: What symptom are you seeing?
- **Layer 1**: What design decision or system structure made this problem possible?
- **Layer 2**: What assumption or constraint created that structure?

For each layer, articulate: "What would fixing it HERE look like? What breaks? What improves?"

### 3. Present options at each depth

- **Surface fix**: Fast, narrow, doesn't prevent recurrence
- **Layer 1 fix**: Moderate effort, prevents this class of problem
- **Layer 2 fix**: Significant change, prevents entire problem categories

The existing code is not sacred. If the root cause is architectural, the fix is architectural.

### 4. Diverge at the right level

Once you've identified the deepest viable fix level, use the **diverge** skill to brainstorm solutions at that level — not at the symptom level. Root-cause analysis and the subsequent diverge must use **top-tier frontier models** (`claude-opus-4.6`, `gpt-5.2`) — depth recognition requires the strongest reasoning available.

## Scope of redesign

Not every escalation requires a full rewrite:

| Level | What it means | Example |
|-------|--------------|---------|
| **Parameter** | Just needs better values | Thresholds, sizes, timings |
| **Algorithm** | Same architecture, different approach | Sort strategy, layout algorithm |
| **Architecture** | Restructure how components relate | New data model, layer split |
| **Vision** | The goal itself needs refinement | Rare — involves the user |

Start at the lowest level that addresses the root cause. Escalate up only if it doesn't resolve.
