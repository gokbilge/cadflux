# vue-i18n usage audit

Generated: 2026-08-01T10:34:35.175Z

Locale files detected: 6

| File | Context | Static translation keys | Dynamic keys |
| --- | --- | --- | --- |
| docs/minimization/deletion-plan.md | runtime |  |  |
| docs/minimization/i18n-usage.md | runtime |  |  |
| docs/minimization/package-classification.md | runtime |  |  |
| packages/cad-agent-plugin/lib/register.d.ts | runtime |  |  |
| packages/cad-simple-viewer/lib/i18n/AcApI18n.d.ts | runtime | core.start | key, options<br>key: string, options?: AcApTranslateOptions<br>locale, key, options |
| packages/cad-simple-viewer/lib/i18n/AcApI18n.js | runtime | core.start | key, options<br>locale, key, options<br>this.cmdKey(groupName, cmdName, key |
| packages/cad-simple-viewer/src/i18n/AcApI18n.ts | runtime | core.start | key, options<br>key: string, options?: AcApTranslateOptions<br>locale, key, options<br>this.cmdKey(groupName, cmdName, key |
| tools/minimization/analyze-workspaces.mjs | build |  |  |
| tools/minimization/check-no-i18n.mjs | build |  | ', regex: /\$t\(/g },
  { label: 'i18n.global', regex: /\bi18n\.global\b/g },
  { label: '@intlify', regex: /@intlify\//g }
]

for (const root of roots |

## Validation summary

- Missing English values: 1
- Unused English keys: 834
- Dynamically constructed keys: 11