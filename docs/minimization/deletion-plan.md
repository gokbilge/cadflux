# Deletion plan

## Group 1 — low-risk removals

- Files/packages affected: legacy viewer command families already isolated from production runtime
- Expected size reduction: significant source-tree reduction; bundle impact already captured in Step 6 slices
- Required replacement: none for removed command families; keep read-only viewer command subset
- Tests protecting behavior: `pnpm test:minimization` + `pnpm --filter @mlightcad/cad-simple-viewer build`
- Risk: low
- Rollback strategy: restore files from git and rerun minimization validation

## Group 2 — i18n removal

- Files/packages affected: `vue-i18n`, `@intlify/eslint-plugin-vue-i18n`
- Expected size reduction: baseline measurement required
- Required replacement: static English strings / simple locale shim
- Tests protecting behavior: `test:minimization` + existing server/build tests
- Risk: medium
- Rollback strategy: restore package from git and rerun baseline tests

## Group 3 — MLightCAD UI/editor removal

- Status: partially completed on August 1, 2026
- Files/packages affected: `@mlightcad/cad-simple-viewer`, `packages/renderer-webgl/src/cadflux-editor/**`, `packages/renderer-webgl/src/mlightcad-bridge/editor.ts`, `packages/renderer-webgl/src/mlightcad-bridge/service.ts`
- Expected size reduction: baseline measurement required
- Required replacement: CadFlux-owned viewer wrappers/adapters; preserve the current read-only viewer path and remove command/input/editor flows from production
- Tests protecting behavior: `test:minimization` + existing server/build tests
- Risk: high
- Completed low-risk subset:
  - removed legacy viewer editor bridge files under `packages/renderer-webgl/src/cadflux-editor/**`
  - removed `packages/renderer-webgl/src/mlightcad-bridge/editor.ts`
  - removed `packages/renderer-webgl/src/mlightcad-bridge/service.ts`
  - removed production-unreachable legacy command families from `packages/cad-simple-viewer/src/command/{convert,draw,layer,modify,review}`
  - removed unused top-level commands `AcApCacheFontCmd`, `AcApLogCmd`, `AcApQNewCmd`, `AcApSysVarCmd`
  - kept only the read-only command subset plus `measure/AcApClearMeasurementsCmd`
- Rollback strategy: restore package from git and rerun baseline tests

## Group 4 — Playwright removal

- Status: completed on August 1, 2026
- Files/packages affected: `@cadflux/cli`, `@cadflux/renderer-pdf`, `@cadflux/renderer-svg`, local bridge/runtime runner assets
- Expected size reduction: requires regenerated minimization baseline
- Required replacement: direct Node-native PDF/SVG renderer path
- Tests protecting behavior: `test:minimization` + `test:integration` + `build:cadflux`
- Risk: closed for active runtime path; residual documentation cleanup remains
- Rollback strategy: restore package from git and rerun baseline tests

## Group 5 — workspace/tooling simplification

- Files/packages affected: none detected
- Expected size reduction: baseline measurement required
- Required replacement: replace or narrow root workflows
- Tests protecting behavior: `test:minimization` + existing server/build tests
- Risk: medium
- Rollback strategy: restore package from git and rerun baseline tests
