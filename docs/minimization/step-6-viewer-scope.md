# Step 6 viewer scope narrowing

Date: 2026-08-01

Changes completed:

- Replaced the `@cadflux/renderer-webgl` MLightCAD bridge with a CadFlux-owned document-driven viewer core.
- Removed direct `@mlightcad/*` imports from `packages/renderer-webgl`.
- Deleted the now-inactive `packages/cad-simple-viewer` and `packages/three-renderer` directories.
- Removed the legacy renderer-webgl source surfaces:
  - `src/cadflux-app/**`
  - `src/cadflux-i18n/**`
  - `src/mlightcad-bridge/**`
- Added a small render-plan pipeline that consumes `@cadflux/drawing-model`.
- Added a small canvas-based viewer core with:
  - fit-to-view
  - zoom in / zoom out
  - pointer pan
  - layout switching
  - layer visibility toggles
- Added lightweight renderer-webgl tests for:
  - block-reference expansion
  - hidden-layer filtering
  - viewport fit math
  - world-to-screen transform behavior
- Enabled DXF browser preview input through `@cadflux/cad-import` by allowing DXF parsing from in-memory bytes.
- Left DWG browser preview as a documented lightweight limitation; server-side DWG conversion remains unchanged.

Active workspace impact:

- active workspace count dropped from `23` to `21`
- production-reachable workspace count dropped from `23` to `21`
- MLightCAD reference count dropped from `52` to `32`

Remaining production viewer dependencies:

- `@cadflux/cad-import`
- `@cadflux/drawing-model`
- `vue`

Removed from the active production viewer graph:

- `@mlightcad/cad-simple-viewer`
- `@mlightcad/three-renderer`
- `@mlightcad/mtext-renderer`
- `@mlightcad/mtext-input-box`
- `@mlightcad/data-model`
- `@mlightcad/libredwg-converter`

Validation:

- `pnpm install --frozen-lockfile`
- `pnpm check:mlightcad-boundary`
- `pnpm check:mlightcad-production`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:minimization`
- `pnpm build:cadflux`
- `pnpm test:integration`
- `pnpm minimize:analyze`
- `pnpm minimize:measure`
