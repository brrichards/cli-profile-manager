---
name: refactor
description: Use when restructuring code - ensures refactors preserve behavior and stay focused
---

When refactoring code:

1. Ensure tests exist for the code being changed. If not, add them first.
2. Make one structural change at a time. Run tests after each change.
3. Do not change behavior during a refactor. If you find a bug, fix it in a separate commit.
4. Prefer extracting functions over inlining. Prefer renaming over commenting.
5. Delete dead code. Do not comment it out.
