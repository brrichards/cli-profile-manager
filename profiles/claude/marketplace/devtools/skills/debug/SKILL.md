---
name: debug
description: Use when encountering unexpected behavior - guides structured debugging instead of guessing
---

When debugging an issue, follow these steps:

1. Reproduce the problem with a minimal test case
2. Read the actual error message and stack trace carefully
3. Add targeted logging at the boundary where behavior diverges from expectation
4. Form a hypothesis, then verify it before making changes
5. Fix the root cause, not the symptom
6. Confirm the fix resolves the original reproduction case
