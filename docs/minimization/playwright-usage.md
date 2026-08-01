# Playwright and Chromium usage audit

Current conversion flow:

```text
Server worker
→ child process
→ renderer package
→ direct Node renderer
→ PDF/SVG bytes
```

Current status:

- As of August 1, 2026, Playwright and Chromium are no longer required by the active CadFlux server or CLI conversion path.
- Remaining references under `docs/minimization/`, `artifacts/minimization/`, and `tools/minimization/` are historical baseline material or cleanup targets.
- `packages/renderer-pdf` and `packages/renderer-svg` now use direct Node-native rendering.

Residual reference categories:

| Category | Status | Notes |
| --- | --- | --- |
| Production server conversion | removed | Server worker uses parsed `DrawingDocument` + direct Node renderers |
| CLI conversion | removed | CLI no longer inspects browser executables or launches Playwright |
| Renderer runner assets | removed | `runner/`, `vite.runner.config.ts`, and copy scripts deleted |
| Local browser bridge | removed | `packages/core/src/browserBridge.ts` deleted |
| Minimization scripts | remaining cleanup | Historical scan/measurement logic still mentions Playwright |
| Generated baseline artifacts | historical | Step 1 outputs still reflect pre-removal baseline |

Follow-up cleanup scope:

- Regenerate minimization artifacts after script cleanup.
- Remove stale Playwright dependency edges from generated workspace graphs.
- Update package classification and deletion-plan docs to reflect completed removal.
