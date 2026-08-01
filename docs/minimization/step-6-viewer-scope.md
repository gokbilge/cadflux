# Step 6 viewer scope narrowing

Date: 2026-08-01

Changes completed:

- `@cadflux/renderer-webgl` locale surface is now English-only.
- `packages/renderer-webgl/src/mlightcad-bridge/app.ts` now exports only the symbols required by the active read-only viewer path.
- `packages/renderer-webgl/src/cadflux-app/index.ts` no longer re-exports the broad MLightCAD bridge surface.
- `packages/renderer-webgl/src/CadFluxWebViewer.ts` no longer depends on `mlightcad-bridge/service.ts` for layer event typing.
- `packages/renderer-webgl/tsconfig.json` now excludes:
  - `src/cadflux-editor/**/*.ts`
  - `src/mlightcad-bridge/editor.ts`
  - `src/mlightcad-bridge/service.ts`

Effect:

- The production viewer build is now centered on a read-only preview flow.
- Legacy editor, command-line, osnap, grip, and MText editing paths remain in-repository but are no longer part of the `@cadflux/renderer-webgl` build surface.
- These excluded files are now direct Step 6 deletion candidates once the remaining package-level references are cleaned.

Immediate deletion candidates produced by this change:

- `packages/renderer-webgl/src/cadflux-editor/**`
- `packages/renderer-webgl/src/mlightcad-bridge/editor.ts`
- `packages/renderer-webgl/src/mlightcad-bridge/service.ts`

Validation:

- `pnpm --filter @cadflux/renderer-webgl build`
- `pnpm test:minimization`
