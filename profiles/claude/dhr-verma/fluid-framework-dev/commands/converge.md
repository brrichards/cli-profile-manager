---
name: converge
description: Cross-model evaluation and synthesis. Use when multiple proposals exist, or any artifact needs independent review before committing.
---

# Converge

## When to converge

- Multiple proposals exist (after diverge)
- A design doc, critique prompt, or architecture needs review
- Code changes span multiple files or touch core abstractions
- Any artifact where "looks good to me" isn't sufficient

## Protocol

### 1. Define criteria first

Before evaluating anything, make "good" explicit:
- What dimensions matter? (clarity, extensibility, performance, risk, etc.)
- What does excellent look like? What does poor look like?
- Are all dimensions equally weighted, or do some dominate?

**Always include "proportionality"** — is the solution's complexity proportional to the problem's complexity? A 3-line problem doesn't need a framework. A library adoption for 3 pieces of state may be over-engineering. This dimension catches the failure mode where sophisticated solutions win on technical merit but lose on context-fit.

If criteria already exist for this domain (in `.claude/criteria/` or the project plan), use them. If not, write them — they become a reusable artifact.

### 2. Launch evaluators

**Use top-tier frontier models from different families** than the ones that generated the proposals (e.g., `claude-opus-4.6`, `gpt-5.2`). Evaluation requires the strongest reasoning — do not use fast/cheap models for critique. Each evaluator gets:
- All proposals (or the artifact under review)
- The evaluation criteria
- The original design question / context

Ask evaluators to score each dimension AND identify: the single strongest element, the single weakest element, and what tradeoff each proposal makes.

Don't ask "which is best?" — ask "what does each gain and lose?"

### 3. Analyze disagreement

Where evaluators agree → high confidence, report briefly.

Where evaluators **disagree** → this is the most important finding. Present:
- The specific disagreement
- Each evaluator's reasoning
- What underlying design tension it reveals

Disagreement means you've found a real tradeoff that needs a conscious decision, not smoothing.

### 4. Stress-test the minority

Before synthesizing, take the lowest-scored proposal and ask: "What if this is right for this specific context?" Construct the strongest case for it. If that case is stronger than the majority's, say so — even if it feels contrarian.

### 5. Synthesize

The best solution often combines elements from multiple proposals. Write up:
- The chosen direction with rationale
- What was explicitly rejected and why
- Unresolved tensions (if any) flagged for the user

### 5. Review the criteria themselves

If evaluation results surprise you, the criteria may be wrong — not the evaluator. Improve the criteria and re-evaluate — but limit to 2 rubric revisions per decision. After that, surface the remaining tension as an explicit tradeoff for the user.

Persist criteria in the repo (e.g., `.claude/criteria/`) so they improve across sessions.

## What gets reviewed

Everything substantive: design documents, architecture decisions, code changes, critique prompts, vision docs, plan updates. Trivial changes (typos, formatting) skip formal review.

## When model diversity is unavailable

If only one model family is available: do ideation and evaluation as explicitly separate passes with different framing. Label the limitation in your output so the user knows the review wasn't cross-model.

## Criteria format

Keep criteria lightweight — a markdown table is sufficient:

```markdown
| Dimension | Weight | Excellent (5) | Poor (1) |
|-----------|--------|---------------|----------|
| Extensibility | High | New features add files, not modify | Every change touches core |
| Risk | Medium | Failure is isolated | Failure cascades |
```

## Anti-patterns

- **Generator-as-judge**: The agent that proposed shouldn't evaluate. Separate roles.
- **Consensus worship**: Unanimous agreement may mean groupthink. Lone dissent is valuable signal. **2-of-3 agreement is not a decision rule** — it means 2 models share the same bias. When a minority evaluator disagrees, engage the substance of their argument before siding with the majority. Ask: "What would have to be true for the minority view to be correct?" If the answer involves the specific problem context (not generic best practices), the minority may be right.
- **Overriding critics**: If you don't like the verdict, improve the criteria — don't ignore the review.
