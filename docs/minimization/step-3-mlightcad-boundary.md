# Step 3 — MLightCAD boundary

Date: August 1, 2026

This step introduced an explicit CadFlux-owned import boundary:

- `@cadflux/cad-import`
- `@cadflux/drawing-model`

What changed:

- added `packages/cad-import` as the public inspect/parse facade;
- moved `apps/server/src/worker-child.ts` from direct `@cadflux/dwg-adapter` / `@cadflux/dxf-adapter` usage to `@cadflux/cad-import`;
- moved `apps/cli/src/cli.ts` inspection flow to `@cadflux/cad-import`;
- extended `@cadflux/drawing-model` with:
  - `DRAWING_MODEL_SCHEMA_VERSION = 1`
  - serializable document, layer, layout, block, entity, style, color, and diagnostic types
  - CadFlux-owned 2D matrix helpers;
- added boundary enforcement:
  - `tools/minimization/mlightcad-import-allowlist.json`
  - `tools/minimization/check-mlightcad-boundary.mjs`
  - root script `pnpm check:mlightcad-boundary`;
- added targeted tests:
  - `packages/drawing-model/src/index.test.ts`
  - `packages/cad-import/src/index.test.ts`

Current boundary shape:

```text
apps/server, apps/cli
        ↓
@cadflux/cad-import
        ↓
@cadflux/dwg-adapter / @cadflux/dxf-adapter
```

Important limitation:

- the current `cad-import` parse implementation is still a transitional facade over legacy inspection-level behavior;
- it returns a deterministic, serializable CadFlux document shape, but not full geometric normalization yet;
- WebGL viewer, SVG runner, PDF runner, and legacy viewer packages remain on the allowlist because they still depend directly on upstream MLightCAD runtime packages.

Why this is still useful:

- production app/worker code now has a CadFlux-owned import seam;
- later parser normalization work can land behind `@cadflux/cad-import` without changing worker/CLI call sites;
- the boundary checker prevents new arbitrary direct `@mlightcad/*` imports outside approved packages.

Validation run in this step:

- `node tools/minimization/check-mlightcad-boundary.mjs`
- `node --experimental-vm-modules ./node_modules/jest/bin/jest.js packages/drawing-model/src/index.test.ts packages/cad-import/src/index.test.ts`
- `pnpm --filter @cadflux/server exec tsc -p tsconfig.json --noEmit`
- `pnpm --filter @cadflux/cli exec tsc -p tsconfig.json --noEmit`

Next technical milestone:

1. implement real DXF/DWG normalization inside `@cadflux/cad-import`;
2. move renderer-worker parse inputs to `DrawingDocument` rather than source-path inspection only;
3. shrink `renderer-webgl` direct legacy viewer imports behind a local facade;
4. continue shrinking the allowlist by removing remaining renderer-side direct upstream imports where possible.
