# Step 5 — MText and LibreDWG boundary tightening

Date: 2026-08-01

Baseline before Step 5:

- HEAD: `08e2e89`
- active workspaces: `21`
- production-reachable workspaces: `21`
- MLightCAD package references: `21`
- repository working tree: `722,896,511` bytes
- `node_modules`: `598,559,675` bytes

Baseline validation findings:

- `pnpm install --frozen-lockfile`: passed
- `pnpm lint`: passed
- `pnpm typecheck`: passed
- `pnpm build:cadflux`: passed
- `pnpm test:integration`: passed
- `pnpm test:minimization`: initially failed because the new `drawing-model` submodule export was emitted as `./text` instead of `./text.js` in built ESM output

Implemented in this step:

1. Removed the dead `tools/worker-assets.mjs` helper, which was the only active-tree code file still mentioning:
   - `@mlightcad/mtext-renderer`
   - `@mlightcad/libredwg-converter`
2. Added CadFlux-owned text model types in `@cadflux/drawing-model`:
   - `DrawingTextStyle`
   - `DrawingTextRun`
   - richer `MTextEntity`
3. Added CadFlux-owned MTEXT parsing in `packages/drawing-model/src/text.ts`:
   - paragraph breaks
   - escaped braces
   - escaped backslashes
   - color changes
   - height changes
   - width factor changes
   - font-family changes
   - underline / overline
   - simplified stacked fractions
   - nonbreaking spaces
   - unsupported-control diagnostics
4. Updated DXF normalization to parse `MTEXT` records into:
   - `rawText`
   - `plainText`
   - `runs`
   - entity-level diagnostics
5. Updated WebGL/PDF/SVG display paths to consume CadFlux-owned `mtext.plainText`.
6. Added a real MTEXT regression fixture: `fixtures/minimization/mtext.dxf`.
7. Added MTEXT regression tests in:
   - `packages/drawing-model/src/index.test.ts`
   - `packages/cad-import/src/index.test.ts`
8. Fixed `@cadflux/drawing-model` build output so forked Node workers can load the new text submodule through ESM.

Dependency status after Step 5:

- `pnpm why @mlightcad/mtext-input-box` → no output
- `pnpm why @mlightcad/mtext-renderer` → no output
- `pnpm why @mlightcad/libredwg-converter` → no output

Meaning:

- no active workspace depends on `@mlightcad/mtext-input-box`
- no active workspace depends on `@mlightcad/mtext-renderer`
- no active workspace depends directly on `@mlightcad/libredwg-converter`

Measured state after Step 5:

- active workspaces: `21`
- production-reachable workspaces: `21`
- MLightCAD package references: `19`
- repository working tree: `722,962,071` bytes
- `node_modules`: `598,559,675` bytes
- web bundle:
  - CSS: `355.65 kB` raw / `48.01 kB` gzip
  - app JS: `20.57 kB` raw / `6.16 kB` gzip
  - vendor Vue: `63.96 kB` raw / `25.46 kB` gzip

Validation after fixes:

- `pnpm install --frozen-lockfile`: passed
- `pnpm lint`: passed
- `pnpm typecheck`: passed
- `pnpm test`: passed
- `pnpm build:cadflux`: passed
- `pnpm test:integration`: passed
- `pnpm test:minimization`: passed
- `pnpm minimize:analyze`: passed
- `pnpm minimize:measure`: passed
- `pnpm minimize:bundle`: passed

Outcome:

- MText editing remains absent.
- MText display remains supported through CadFlux-owned parsing and normalization.
- The active dependency graph no longer includes `mtext-input-box` or `mtext-renderer`.
- LibreDWG is no longer referenced directly by applications, renderers, server, worker, or CLI code.
