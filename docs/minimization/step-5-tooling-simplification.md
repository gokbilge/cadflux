<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Copyright (C) 2026 CadFlux contributors -->

# Step 5 — workspace and tooling simplification

Date: August 1, 2026

Completed changes:

- removed root dependency on:
  - `nx`
  - `@nx/js`
  - `typedoc`
  - `@changesets/cli`
  - `rollup-plugin-visualizer`
- replaced Nx-based root scripts with `tools/run-workspace-script.mjs`
- replaced Typedoc-based docs build with `tools/build-docs-site.mjs`
- replaced visualizer-based bundle HTML with lightweight HTML generation in `tools/minimization/summarize-web-bundle.mjs`
- removed:
  - `nx.json`
  - `typedoc.base.jsonc`
  - `packages/cad-pdf-plugin/project.json`
  - `packages/cad-svg-plugin/project.json`

Root script behavior now:

- `pnpm clean` → runs workspace `clean` scripts without Nx
- `pnpm lint` → runs workspace `lint` scripts without Nx
- `pnpm lint:fix` → runs workspace `lint:fix` scripts without Nx
- `pnpm docs:build` → generates lightweight static docs index and site metadata
- `pnpm minimize:bundle` → still produces JSON, Markdown, and HTML bundle reports without the visualizer dependency

Validation used:

- `pnpm install --lockfile-only`
- `pnpm install --frozen-lockfile`
- `pnpm lint`
- `pnpm docs:build`
- `pnpm minimize:bundle`
- `pnpm build:cadflux`
