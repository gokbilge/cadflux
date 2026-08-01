# Step 4 — MLightCAD production pruning

Date: 2026-08-01

Summary:

- Removed the obsolete `@mlightcad/cad-pdf-plugin` workspace from the active CadFlux repository.
- Removed the obsolete `@mlightcad/cad-svg-plugin` workspace from the active CadFlux repository.
- Removed the inactive `@mlightcad/cad-viewer` workspace from the active CadFlux repository.
- Deleted the inactive legacy `@mlightcad/cad-simple-viewer` and `@mlightcad/three-renderer` directories from the repository tree.
- Removed production imports of the old browser export plugins from `@cadflux/renderer-webgl`.
- Added an explicit MLightCAD production allowlist and production guard.
- Narrowed the active workspace list in `pnpm-workspace.yaml` and `package.json` to the CadFlux server/web/CLI stack plus the minimum legacy viewer kernel packages still needed.
- Narrowed the root test command to the active CadFlux matrix instead of the entire legacy upstream repository surface.

Before:

- Workspace count: 25
- Active workspace count: 25
- Production-reachable workspace count: 25
- MLightCAD reference count: 68
- Playwright runtime/build call sites: 0
- Repository working tree size: 725,393,319 bytes
- `node_modules` size: 598,559,675 bytes

After:

- Workspace count: 23
- Active workspace count: 23
- Production-reachable workspace count: 23
- MLightCAD reference count: 52
- Playwright runtime/build call sites: 0
- Repository working tree size: 725,165,098 bytes
- `node_modules` size: 598,559,675 bytes

Production removals completed in this step:

- `packages/cad-pdf-plugin/**`
- `packages/cad-svg-plugin/**`
- `packages/cad-viewer/src/**`
- renderer-webgl imports of `@mlightcad/cad-pdf-plugin/*`
- renderer-webgl imports of `@mlightcad/cad-svg-plugin/*`

New guardrails:

- `pnpm check:mlightcad-production`
- `tools/minimization/mlightcad-production-allowlist.json`
- `tools/minimization/check-mlightcad-production.mjs`

Remaining allowed MLightCAD production packages:

- `@mlightcad/data-model`
- `@mlightcad/libredwg-converter`
- `@mlightcad/mtext-renderer`
- `@mlightcad/mtext-input-box`

Why they remain:

- `data-model` and `libredwg-converter` still back the local preview/import kernel.
- `mtext-renderer` still supports text rendering in the viewer stack.
- `mtext-input-box` remains only through historical references that should be pruned in later cleanup.

Remaining high-risk packages:

- `@mlightcad/mtext-renderer`
- `@mlightcad/mtext-input-box`

Next recommended step:

- Continue shrinking the remaining MText- and parser-related MLightCAD surface after the inactive viewer package trees have been removed.
