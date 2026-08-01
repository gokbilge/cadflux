<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Copyright (C) 2026 CadFlux contributors -->

# Step 4 — low-risk removals

Date: August 1, 2026

Completed removals:

- `packages/cad-agent-plugin`
- `packages/cad-html-exporter-cli`
- `packages/cad-html-plugin`
- `packages/cad-simple-viewer-example`
- `packages/cad-viewer-example`
- `packages/examples`
- `packages/vite-config`
- obsolete web shim files under `apps/web/src/shims`

Result:

- non-production example/plugin/reference workspaces were removed from the active monorepo;
- the active workspace set dropped to the CadFlux web/server/CLI and required conversion/runtime packages;
- no production preview, queue, auth, or conversion workflow was intentionally removed.

Validation used:

- `pnpm install --frozen-lockfile`
- `pnpm test:minimization`
- `pnpm build:cadflux`

Known remaining legacy surface:

- `packages/cad-simple-viewer`
- `packages/three-renderer`
- `@mlightcad/mtext-renderer`
- `@mlightcad/mtext-input-box`
- `@mlightcad/libredwg-converter`
