# Step 6 viewer scope narrowing

Date: 2026-08-01

Changes completed:

- `@cadflux/renderer-webgl` locale surface is now English-only.
- `@mlightcad/cad-simple-viewer` root export surface is now narrowed to the symbols still consumed by CadFlux production packages.
- `@mlightcad/cad-pdf-plugin` and `@mlightcad/cad-svg-plugin` no longer import the `cad-simple-viewer` package root for active code paths; they now import only the specific app/editor/plugin submodules they need.
- `packages/cad-simple-viewer/src/plugin/AcApPluginExample.ts` was removed because it was not referenced by active CadFlux production code.
- The unused About dialog chain was removed:
  - `packages/cad-simple-viewer/src/command/AcApAboutCmd.ts`
  - `packages/cad-simple-viewer/src/ui/AcUiAboutDialog.ts`
  - `packages/cad-simple-viewer/src/ui/AcUiDialog.ts`
  - `packages/cad-simple-viewer/src/ui/index.ts`
- `packages/cad-simple-viewer/src/i18n` is now English-only:
  - `AcApLocale` was narrowed to `en`
  - `cs/*`, `tr/*`, and `zh/*` locale files were removed
  - locale registration now loads only English command/jig/main messages
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
- Active package-root imports of `@mlightcad/cad-simple-viewer` are now reduced to README/example text references instead of production code.
- The plugin surface no longer exports the unused example plugin.
- `AcApDocManager` no longer registers the `about` command in the active viewer command set.
- `cad-simple-viewer` locale payload was reduced from multi-language message bundles to English-only runtime data.

Observed bundle change in this slice:

- before: `cad-simple-viewer.js` `2,542.02 kB` / gzip `684.77 kB`
- after: `cad-simple-viewer.js` `2,437.65 kB` / gzip `660.79 kB`

Deletion completed in this slice:

- `packages/renderer-webgl/src/cadflux-editor/**`
- `packages/renderer-webgl/src/mlightcad-bridge/editor.ts`
- `packages/renderer-webgl/src/mlightcad-bridge/service.ts`

Validation:

- `pnpm --filter @cadflux/renderer-webgl build`
- `pnpm test:minimization`
