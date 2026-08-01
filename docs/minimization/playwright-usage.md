# Playwright and Chromium usage audit

Current conversion flow:

```text
Server worker
→ child process
→ renderer package
→ temporary HTTP bridge
→ Chromium
→ browser runner
→ PDF/SVG bytes
```

| File | Purpose | Used by PDF or SVG | Browser-only API required | Input transport | Output transport | Runner assets | WASM dependencies | Replacement requirement |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| .dockerignore | Playwright-related support | other | unknown | n/a | n/a | no | unknown | direct-node renderer not implemented yet |
| .gitignore | Playwright-related support | other | unknown | n/a | n/a | no | unknown | direct-node renderer not implemented yet |
| apps/cli/package.json | CLI doctor/browser inspection | other | unknown | n/a | n/a | no | unknown | direct-node renderer not implemented yet |
| apps/cli/src/cli.ts | CLI doctor/browser inspection | other | unknown | n/a | n/a | no | unknown | direct-node renderer not implemented yet |
| docs/minimization/package-classification.md | Playwright-related support | other | unknown | n/a | n/a | no | unknown | direct-node renderer not implemented yet |
| docs/minimization/playwright-usage.md | Playwright-related support | other | unknown | n/a | n/a | no | unknown | direct-node renderer not implemented yet |
| docs/minimization/workspace-inventory.json | Playwright-related support | other | unknown | n/a | n/a | no | unknown | direct-node renderer not implemented yet |
| package.json | Playwright-related support | other | unknown | n/a | n/a | no | unknown | direct-node renderer not implemented yet |
| packages/core/src/browserBridge.ts | Playwright-related support | other | unknown | local HTTP sourceUrl | n/a | no | unknown | direct-node renderer not implemented yet |
| packages/renderer-pdf/package.json | PDF browser bridge | PDF | unknown | local HTTP sourceUrl | n/a | no | unknown | direct-node renderer not implemented yet |
| packages/renderer-pdf/scripts/copy-runner-assets.mjs | PDF browser bridge | PDF | unknown | local HTTP sourceUrl | n/a | no | unknown | direct-node renderer not implemented yet |
| packages/renderer-pdf/src/node.ts | PDF browser bridge | PDF | yes | local HTTP sourceUrl | n/a | no | unknown | direct-node renderer not implemented yet |
| packages/renderer-pdf/vite.runner.config.ts | PDF browser bridge | PDF | unknown | local HTTP sourceUrl | n/a | no | unknown | direct-node renderer not implemented yet |
| packages/renderer-svg/package.json | SVG browser bridge | SVG | unknown | local HTTP sourceUrl | n/a | no | unknown | direct-node renderer not implemented yet |
| packages/renderer-svg/scripts/copy-runner-assets.mjs | SVG browser bridge | SVG | unknown | local HTTP sourceUrl | n/a | no | unknown | direct-node renderer not implemented yet |
| packages/renderer-svg/src/node.ts | SVG browser bridge | SVG | yes | local HTTP sourceUrl | n/a | no | unknown | direct-node renderer not implemented yet |
| packages/renderer-svg/vite.runner.config.ts | SVG browser bridge | SVG | unknown | local HTTP sourceUrl | n/a | no | unknown | direct-node renderer not implemented yet |
| pnpm-lock.yaml | Playwright-related support | other | unknown | n/a | n/a | no | unknown | direct-node renderer not implemented yet |
| tools/minimization/analyze-workspaces.mjs | Playwright-related support | other | yes | n/a | n/a | no | unknown | direct-node renderer not implemented yet |
| tools/minimization/check-no-i18n.mjs | Playwright-related support | other | unknown | n/a | n/a | no | unknown | direct-node renderer not implemented yet |
| tools/minimization/measure-size.mjs | Playwright-related support | other | unknown | n/a | n/a | no | unknown | direct-node renderer not implemented yet |

Why Playwright is currently required:

- Current renderer packages launch Chromium and execute browser-side export code.
- Browser runners still depend on MLightCAD viewer/export packages and browser APIs.
- The CadFlux bridge now streams source/result bytes over localhost instead of expanding binary arrays.