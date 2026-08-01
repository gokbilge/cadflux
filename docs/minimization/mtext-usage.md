# MText usage audit

Date: 2026-08-01

Summary:

- `@mlightcad/mtext-input-box`: no active dependency or source usage
- `@mlightcad/mtext-renderer`: no active dependency or source usage
- `@mlightcad/libredwg-converter`: no active dependency or source usage outside historical minimization documentation
- CadFlux now owns:
  - text style types
  - MTEXT parsing
  - MTEXT plain-text normalization
  - MTEXT run extraction for supported control sequences

Active call sites:

| File | Imported package | Imported symbol | Purpose | Production/build/test | Replacement required | Safe to remove |
| --- | --- | --- | --- | --- | --- | --- |
| `packages/drawing-model/src/text.ts` | — | `parseMText` | parsing | production | no | no |
| `packages/drawing-model/src/index.ts` | — | text entity/types | normalization | production | no | no |
| `packages/cad-import/src/mlightcad/adapter.ts` | `@cadflux/drawing-model` | `parseMText` | normalization | production | no | no |
| `packages/renderer-webgl/src/render-plan.ts` | `@cadflux/drawing-model` | `MTextEntity` via union | display | production | no | no |
| `packages/renderer-svg/src/node.ts` | `@cadflux/drawing-model` | `MTextEntity` | display | production | no | no |
| `packages/renderer-pdf/src/node.ts` | `@cadflux/drawing-model` | `MTextEntity` | display | production | no | no |
| `packages/cad-import/src/index.test.ts` | `@cadflux/cad-import` | `parseCadInput` | test-only | test | no | no |
| `packages/drawing-model/src/index.test.ts` | `@cadflux/drawing-model` | `parseMText` | test-only | test | no | no |
| `fixtures/minimization/mtext.dxf` | — | — | test-only | test | no | no |

Historical-only references still present:

| File | Imported package | Purpose | Safe to remove later |
| --- | --- | --- | --- |
| `docs/minimization/step-4-mlightcad-pruning.md` | `@mlightcad/mtext-renderer` | dead historical note | yes |
| `docs/minimization/step-4-low-risk-removals.md` | `@mlightcad/mtext-input-box` | dead historical note | yes |
| `docs/minimization/step-6-viewer-scope.md` | `@mlightcad/libredwg-converter` | dead historical note | yes |

Conclusions:

- MText editing is absent from the active CadFlux application.
- MText display remains through CadFlux-owned parsing plus existing text rendering paths.
- No active package depends on `@mlightcad/mtext-input-box`.
- No active package depends on `@mlightcad/mtext-renderer`.
- LibreDWG remains conceptually part of the DWG boundary, but no application/renderer/server/CLI package imports it directly.
