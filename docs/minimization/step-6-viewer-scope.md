# Step 6 viewer scope narrowing

Date: 2026-08-01

Changes completed:

- `@cadflux/renderer-webgl` locale surface is now English-only.
- `@mlightcad/cad-simple-viewer` root export surface is now narrowed to the symbols still consumed by CadFlux production packages.
- `packages/renderer-webgl/src/mlightcad-bridge/app.ts` now exports only the symbols required by the active read-only viewer path.
- `packages/renderer-webgl/src/cadflux-app/index.ts` no longer re-exports the broad MLightCAD bridge surface.
- `packages/renderer-webgl/src/CadFluxWebViewer.ts` no longer depends on `mlightcad-bridge/service.ts` for layer event typing.
- The legacy files were removed:
  - `packages/renderer-webgl/src/cadflux-editor/AcEdCommandLine.ts`
  - `packages/renderer-webgl/src/cadflux-editor/AcEdGripManager.ts`
  - `packages/renderer-webgl/src/cadflux-editor/AcEditor.ts`
  - `packages/renderer-webgl/src/cadflux-editor/AcEdMTextEditor.ts`
  - `packages/renderer-webgl/src/cadflux-editor/AcEdOsnapResolver.ts`
  - `packages/renderer-webgl/src/cadflux-editor/AcEdViewKeyHandler.ts`
  - `packages/renderer-webgl/src/mlightcad-bridge/editor.ts`
  - `packages/renderer-webgl/src/mlightcad-bridge/service.ts`

Effect:

- The production viewer build is now centered on a read-only preview flow.
- Legacy editor, command-line, osnap, grip, and MText editing paths have been removed from `@cadflux/renderer-webgl`.
- The remaining production viewer path is now the narrower read-only bridge.
- `cad-simple-viewer` no longer re-exports broad `util`, `service`, `command`, `editor`, `i18n`, `plugin`, `view`, and `ui` wildcard surfaces from its package root.

Deletion completed in this slice:

- `packages/renderer-webgl/src/cadflux-editor/**`
- `packages/renderer-webgl/src/mlightcad-bridge/editor.ts`
- `packages/renderer-webgl/src/mlightcad-bridge/service.ts`

Validation:

- `pnpm --filter @cadflux/renderer-webgl build`
- `pnpm test:minimization`
