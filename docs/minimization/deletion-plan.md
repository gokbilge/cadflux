# Deletion plan

## Group 1 — low-risk removals

- Files/packages affected: none detected
- Expected size reduction: baseline measurement required
- Required replacement: none or package-level removal only
- Tests protecting behavior: test:minimization + existing server/build tests
- Risk: low
- Rollback strategy: restore package from git and rerun baseline tests

## Group 2 — i18n removal

- Files/packages affected: vue-i18n, @intlify/eslint-plugin-vue-i18n
- Expected size reduction: baseline measurement required
- Required replacement: static English strings / simple locale shim
- Tests protecting behavior: test:minimization + existing server/build tests
- Risk: medium
- Rollback strategy: restore package from git and rerun baseline tests

## Group 3 — MLightCAD UI/editor removal

- Files/packages affected: @mlightcad/cad-simple-viewer, packages/renderer-webgl/src/cadflux-editor/**, packages/renderer-webgl/src/mlightcad-bridge/editor.ts, packages/renderer-webgl/src/mlightcad-bridge/service.ts
- Expected size reduction: baseline measurement required
- Required replacement: CadFlux-owned viewer wrappers/adapters; preserve the current read-only viewer path and remove command/input/editor flows from production
- Tests protecting behavior: test:minimization + existing server/build tests
- Risk: high
- Rollback strategy: restore package from git and rerun baseline tests

## Group 4 � Playwright removal

- Status: completed on August 1, 2026
- Files/packages affected: @cadflux/cli, @cadflux/renderer-pdf, @cadflux/renderer-svg, local bridge/runtime runner assets
- Expected size reduction: requires regenerated minimization baseline
- Required replacement: direct Node-native PDF/SVG renderer path
- Tests protecting behavior: test:minimization + test:integration + build:cadflux
- Risk: closed for active runtime path; residual documentation cleanup remains
- Rollback strategy: restore package from git and rerun baseline tests

## Group 5 — workspace/tooling simplification

- Files/packages affected: none detected
- Expected size reduction: baseline measurement required
- Required replacement: replace or narrow root workflows
- Tests protecting behavior: test:minimization + existing server/build tests
- Risk: medium
- Rollback strategy: restore package from git and rerun baseline tests
