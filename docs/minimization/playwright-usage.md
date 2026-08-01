# Playwright and Chromium usage audit

Current conversion flow:

```text
Server worker
→ child process
→ direct Node renderer package
→ PDF/SVG bytes
```

Active runtime/build call sites: 0

| File | Purpose | Used by PDF or SVG | Browser-only API required | Input transport | Output transport | Runner assets | WASM dependencies | Replacement requirement |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

Current status:

- Playwright and Chromium are no longer required by the active CadFlux server or CLI conversion path.
- The active renderer path is direct Node-native PDF/SVG generation.
- Runtime/build source references remaining: 0.