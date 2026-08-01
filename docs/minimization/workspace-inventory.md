# Workspace inventory

Generated: 2026-08-01T20:36:14.479Z

| Package | Path | Type | Direct dependents | Runtime use | Build use | Test use | Current classification | Removal candidate | Replacement required | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| @cadflux/auth | packages/auth | package | @cadflux/server | yes | yes | yes | KEEP_RUNTIME | no | no | Reachable from @cadflux/web, @cadflux/server, or @cadflux/cli |
| @cadflux/batch-engine | packages/batch-engine | package | @cadflux/cli<br>@cadflux/server<br>@cadflux/web | yes | yes | no | KEEP_RUNTIME | no | no | Reachable from @cadflux/web, @cadflux/server, or @cadflux/cli |
| @cadflux/cad-import | packages/cad-import | package | @cadflux/cli<br>@cadflux/renderer-webgl<br>@cadflux/server | yes | yes | yes | KEEP_RUNTIME | no | no | Reachable from @cadflux/web, @cadflux/server, or @cadflux/cli |
| @cadflux/cli | apps/cli | app |  | yes | yes | no | KEEP_RUNTIME | no | no | Production root |
| @cadflux/config | packages/config | package | @cadflux/cli<br>@cadflux/web | yes | yes | no | KEEP_RUNTIME | no | no | Reachable from @cadflux/web, @cadflux/server, or @cadflux/cli |
| @cadflux/contracts | packages/contracts | package | @cadflux/database<br>@cadflux/server<br>@cadflux/web | yes | yes | no | KEEP_RUNTIME | no | no | Reachable from @cadflux/web, @cadflux/server, or @cadflux/cli |
| @cadflux/core | packages/core | package | @cadflux/batch-engine<br>@cadflux/cad-import<br>@cadflux/cli<br>@cadflux/diagnostics<br>@cadflux/drawing-model<br>@cadflux/dwg-adapter<br>@cadflux/dxf-adapter<br>@cadflux/file-ingest<br>@cadflux/plot-engine<br>@cadflux/presets<br>@cadflux/renderer-pdf<br>@cadflux/renderer-svg<br>@cadflux/server | yes | yes | no | KEEP_RUNTIME | no | no | Reachable from @cadflux/web, @cadflux/server, or @cadflux/cli |
| @cadflux/database | packages/database | package | @cadflux/server | yes | yes | yes | KEEP_RUNTIME | no | no | Reachable from @cadflux/web, @cadflux/server, or @cadflux/cli |
| @cadflux/diagnostics | packages/diagnostics | package | @cadflux/cli | yes | yes | no | KEEP_RUNTIME | no | no | Reachable from @cadflux/web, @cadflux/server, or @cadflux/cli |
| @cadflux/drawing-model | packages/drawing-model | package | @cadflux/cad-import<br>@cadflux/renderer-pdf<br>@cadflux/renderer-svg<br>@cadflux/renderer-webgl<br>@cadflux/web | yes | yes | yes | KEEP_RUNTIME | no | no | Reachable from @cadflux/web, @cadflux/server, or @cadflux/cli |
| @cadflux/dwg-adapter | packages/dwg-adapter | package | @cadflux/cad-import | yes | yes | no | KEEP_RUNTIME | no | no | Reachable from @cadflux/web, @cadflux/server, or @cadflux/cli |
| @cadflux/dxf-adapter | packages/dxf-adapter | package | @cadflux/cad-import | yes | yes | no | KEEP_RUNTIME | no | no | Reachable from @cadflux/web, @cadflux/server, or @cadflux/cli |
| @cadflux/file-ingest | packages/file-ingest | package | @cadflux/cli<br>@cadflux/web | yes | yes | no | KEEP_RUNTIME | no | no | Reachable from @cadflux/web, @cadflux/server, or @cadflux/cli |
| @cadflux/plot-engine | packages/plot-engine | package | @cadflux/cli<br>@cadflux/server | yes | yes | no | KEEP_RUNTIME | no | no | Reachable from @cadflux/web, @cadflux/server, or @cadflux/cli |
| @cadflux/presets | packages/presets | package | @cadflux/cli<br>@cadflux/server<br>@cadflux/web | yes | yes | yes | KEEP_RUNTIME | no | no | Reachable from @cadflux/web, @cadflux/server, or @cadflux/cli |
| @cadflux/renderer-pdf | packages/renderer-pdf | package | @cadflux/cli<br>@cadflux/server | yes | yes | no | KEEP_RUNTIME | no | no | Current production conversion uses direct Node-native rendering; Reachable from @cadflux/web, @cadflux/server, or @cadflux/cli |
| @cadflux/renderer-svg | packages/renderer-svg | package | @cadflux/cli<br>@cadflux/server | yes | yes | no | KEEP_RUNTIME | no | no | Current production conversion uses direct Node-native rendering; Reachable from @cadflux/web, @cadflux/server, or @cadflux/cli |
| @cadflux/renderer-webgl | packages/renderer-webgl | package | @cadflux/web | yes | yes | yes | KEEP_RUNTIME | no | no | Reachable from @cadflux/web, @cadflux/server, or @cadflux/cli; current viewer package is CadFlux-owned and document-driven |
| @cadflux/server | apps/server | app |  | yes | yes | no | KEEP_RUNTIME | no | no | Production root |
| @cadflux/storage | packages/storage | package | @cadflux/server | yes | yes | no | KEEP_RUNTIME | no | no | Reachable from @cadflux/web, @cadflux/server, or @cadflux/cli |
| @cadflux/web | apps/web | app |  | yes | yes | no | KEEP_RUNTIME | no | no | Production root |
