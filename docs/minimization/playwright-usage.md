# Playwright and Chromium usage audit

Current conversion flow:

```text
Server worker
? child process
? renderer package
? direct Node renderer
? PDF/SVG bytes
```

| File | Purpose | Used by PDF or SVG | Browser-only API required | Input transport | Output transport | Runner assets | WASM dependencies | Replacement requirement |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

Current status:

- Playwright and Chromium are no longer required by the active CadFlux server or CLI conversion path.
- Remaining matches in this report are historical baseline references, generated artifacts, or stale documentation until regenerated.
- The active renderer path is direct Node-native PDF/SVG generation.