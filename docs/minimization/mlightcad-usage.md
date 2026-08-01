# MLightCAD usage audit

Generated: 2026-08-01T21:53:31.849Z

| Package | Imported by | Imported symbols | Runtime/build/test | Used by web/server/CLI | Can be wrapped | Can be rewritten | Can be deleted now | Replacement required |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| @mlightcad/cad-agent-plugin | tools/minimization/analyze-workspaces.mjs<br>tools/minimization/check-mlightcad-production.mjs |  | build | web=false; server=false; cli=false | no | no | yes | no |
| @mlightcad/cad-html-exporter-cli | tools/minimization/analyze-workspaces.mjs<br>tools/minimization/check-mlightcad-production.mjs |  | build | web=false; server=false; cli=false | no | no | no | no |
| @mlightcad/cad-html-plugin | tools/minimization/analyze-workspaces.mjs<br>tools/minimization/check-mlightcad-production.mjs |  | build | web=false; server=false; cli=false | no | no | yes | no |
| @mlightcad/cad-pdf-plugin | docs/architecture.md<br>tools/minimization/analyze-workspaces.mjs<br>tools/minimization/check-mlightcad-production.mjs |  | build, runtime | web=false; server=false; cli=false | yes | yes | no | yes |
| @mlightcad/cad-pdf-plugin/command | docs/architecture.md |  | runtime | web=false; server=false; cli=false | yes | yes | no | yes |
| @mlightcad/cad-pdf-plugin/convertor | docs/architecture.md |  | runtime | web=false; server=false; cli=false | yes | yes | no | yes |
| @mlightcad/cad-pdf-plugin/import-command | docs/architecture.md |  | runtime | web=false; server=false; cli=false | yes | yes | no | yes |
| @mlightcad/cad-pdf-plugin/import-convertor | docs/architecture.md |  | runtime | web=false; server=false; cli=false | yes | yes | no | yes |
| @mlightcad/cad-pdf-plugin/register | docs/architecture.md |  | runtime | web=false; server=false; cli=false | yes | yes | no | yes |
| @mlightcad/cad-simple-ui-plugin | tools/minimization/analyze-workspaces.mjs<br>tools/minimization/check-mlightcad-production.mjs |  | build | web=false; server=false; cli=false | no | no | no | no |
| @mlightcad/cad-simple-viewer-example | tools/minimization/analyze-workspaces.mjs<br>tools/minimization/check-mlightcad-production.mjs |  | build | web=false; server=false; cli=false | no | no | no | no |
| @mlightcad/cad-svg-plugin | docs/architecture.md<br>tools/minimization/analyze-workspaces.mjs<br>tools/minimization/check-mlightcad-production.mjs |  | build, runtime | web=false; server=false; cli=false | yes | yes | no | yes |
| @mlightcad/cad-svg-plugin/command | docs/architecture.md |  | runtime | web=false; server=false; cli=false | yes | yes | no | yes |
| @mlightcad/cad-svg-plugin/convertor | docs/architecture.md |  | runtime | web=false; server=false; cli=false | yes | yes | no | yes |
| @mlightcad/cad-svg-plugin/register | docs/architecture.md |  | runtime | web=false; server=false; cli=false | yes | yes | no | yes |
| @mlightcad/cad-svg-plugin/renderer | docs/architecture.md |  | runtime | web=false; server=false; cli=false | yes | yes | no | yes |
| @mlightcad/cad-viewer | tools/minimization/analyze-workspaces.mjs<br>tools/minimization/check-mlightcad-production.mjs |  | build | web=false; server=false; cli=false | no | no | no | no |
| @mlightcad/cad-viewer-example | tools/minimization/analyze-workspaces.mjs<br>tools/minimization/check-mlightcad-production.mjs |  | build | web=false; server=false; cli=false | no | no | no | no |
| @mlightcad/examples | tools/minimization/analyze-workspaces.mjs<br>tools/minimization/check-mlightcad-production.mjs |  | build | web=false; server=false; cli=false | no | no | no | no |

## A. Likely essential


## B. Potentially replaceable

- @mlightcad/cad-pdf-plugin
- @mlightcad/cad-pdf-plugin/command
- @mlightcad/cad-pdf-plugin/convertor
- @mlightcad/cad-pdf-plugin/import-command
- @mlightcad/cad-pdf-plugin/import-convertor
- @mlightcad/cad-pdf-plugin/register
- @mlightcad/cad-svg-plugin
- @mlightcad/cad-svg-plugin/command
- @mlightcad/cad-svg-plugin/convertor
- @mlightcad/cad-svg-plugin/register
- @mlightcad/cad-svg-plugin/renderer

## C. Likely removable

- @mlightcad/cad-agent-plugin
- @mlightcad/cad-html-plugin