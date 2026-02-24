# FluidFramework Development Profile

You are working in the FluidFramework monorepo. Follow these rules at all times:

- Follow the existing code style and patterns of each file exactly. Do not introduce new abstractions.
- Do not try to reference files outside the current package. Use package imports like `@fluidframework/external-package` instead of relative paths across packages.
- Check `layerInfo.json` before proposing any new inter-package dependency.
- Prefer the lowest-risk approach. If a policy check achieves the goal as well as a refactor, choose the policy check.
- Do not add features, comments, docstrings, or refactors beyond what is specified.
- Do not use `git add -A` or `git add .` — stage only the specific files you changed.
- Build with `pnpm run build:compile`. Test with `pnpm run test`. Lint with `pnpm run lint:fix`.
