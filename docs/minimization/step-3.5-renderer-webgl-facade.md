<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Copyright (C) 2026 CadFlux contributors -->

# Step 3.5 — renderer-webgl legacy viewer facade

Date: August 1, 2026

Scope:

- isolate active `renderer-webgl` usage of `@mlightcad/cad-simple-viewer`;
- stop scattering deep upstream imports across viewer runtime code;
- prepare Step 4 package deletion by reducing the live import surface to one CadFlux-owned bridge.

What changed:

- added `packages/renderer-webgl/src/mlightcad-bridge/`;
- moved all direct `cad-simple-viewer/src/...` imports in active `renderer-webgl` source files behind:
  - `mlightcad-bridge/app.ts`
  - `mlightcad-bridge/editor.ts`
  - `mlightcad-bridge/i18n.ts`
  - `mlightcad-bridge/service.ts`
- updated:
  - `src/index.ts`
  - `src/CadFluxWebViewer.ts`
  - `src/cadflux-app/*`
  - `src/cadflux-editor/*`
  - `src/cadflux-i18n/index.ts`

Current bridge shape:

```text
renderer-webgl runtime
        ↓
packages/renderer-webgl/src/mlightcad-bridge/*
        ↓
@mlightcad/cad-simple-viewer deep modules
```

Modules still required from the legacy viewer:

- app/document context
  - `AcApContext`
  - `AcApDocument`
  - `AcApFontLoader`
  - `AcApSettingManager`
  - worker asset constants
- view/runtime
  - `AcEdOpenMode`
  - `AcTrView2d`
  - `AcApLayerStoreChangedEventArgs`
- editor/input
  - cursor manager
  - prompt/session types
  - base view types
- English locale payloads
  - `i18n/en/command`
  - `i18n/en/jig`
  - `i18n/en/main`

Result:

- active `renderer-webgl` source no longer imports `cad-simple-viewer/src/...` directly outside `mlightcad-bridge`;
- the remaining upstream surface is explicit and reviewable;
- Step 4 can now target unused legacy viewer submodules with less risk.

Validation:

- `pnpm --filter @cadflux/renderer-webgl build`
- `pnpm check:mlightcad-boundary`

Immediate follow-up for Step 4:

1. inspect `mlightcad-bridge/*` exports and remove unused re-exports;
2. check whether locale payloads can be copied into CadFlux-owned static English modules;
3. determine whether `AcEdCommandLine`, prompt/session helpers, and editor stubs can move fully into CadFlux;
4. keep `three-renderer`, PDF, and SVG runner work separate from this bridge shrink.
