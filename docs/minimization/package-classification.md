# Package classification

| Package | Classification | Evidence |
| --- | --- | --- |
| @cadflux/auth | KEEP_RUNTIME | Reachable from @cadflux/web, @cadflux/server, or @cadflux/cli |
| @cadflux/batch-engine | KEEP_RUNTIME | Reachable from @cadflux/web, @cadflux/server, or @cadflux/cli |
| @cadflux/cad-import | KEEP_RUNTIME | Reachable from @cadflux/web, @cadflux/server, or @cadflux/cli |
| @cadflux/cli | KEEP_RUNTIME | Production root |
| @cadflux/config | KEEP_RUNTIME | Reachable from @cadflux/web, @cadflux/server, or @cadflux/cli |
| @cadflux/contracts | KEEP_RUNTIME | Reachable from @cadflux/web, @cadflux/server, or @cadflux/cli |
| @cadflux/core | KEEP_RUNTIME | Reachable from @cadflux/web, @cadflux/server, or @cadflux/cli |
| @cadflux/database | KEEP_RUNTIME | Reachable from @cadflux/web, @cadflux/server, or @cadflux/cli |
| @cadflux/diagnostics | KEEP_RUNTIME | Reachable from @cadflux/web, @cadflux/server, or @cadflux/cli |
| @cadflux/drawing-model | KEEP_RUNTIME | Reachable from @cadflux/web, @cadflux/server, or @cadflux/cli |
| @cadflux/dwg-adapter | KEEP_RUNTIME | Reachable from @cadflux/web, @cadflux/server, or @cadflux/cli |
| @cadflux/dxf-adapter | KEEP_RUNTIME | Reachable from @cadflux/web, @cadflux/server, or @cadflux/cli |
| @cadflux/file-ingest | KEEP_RUNTIME | Reachable from @cadflux/web, @cadflux/server, or @cadflux/cli |
| @cadflux/plot-engine | KEEP_RUNTIME | Reachable from @cadflux/web, @cadflux/server, or @cadflux/cli |
| @cadflux/presets | KEEP_RUNTIME | Reachable from @cadflux/web, @cadflux/server, or @cadflux/cli |
| @cadflux/renderer-pdf | KEEP_RUNTIME | Current production conversion uses direct Node-native rendering; Reachable from @cadflux/web, @cadflux/server, or @cadflux/cli |
| @cadflux/renderer-svg | KEEP_RUNTIME | Current production conversion uses direct Node-native rendering; Reachable from @cadflux/web, @cadflux/server, or @cadflux/cli |
| @cadflux/renderer-webgl | WRAP_FIRST | Reachable from @cadflux/web, @cadflux/server, or @cadflux/cli; Web preview depends on wrapped MLightCAD viewer stack; production build now excludes cadflux-editor and bridge editor/service files |
| @cadflux/server | KEEP_RUNTIME | Production root |
| @cadflux/storage | KEEP_RUNTIME | Reachable from @cadflux/web, @cadflux/server, or @cadflux/cli |
| @cadflux/web | KEEP_RUNTIME | Production root |
| @mlightcad/cad-pdf-plugin | WRAP_FIRST | Direct MLightCAD runtime integration; Reachable from @cadflux/web, @cadflux/server, or @cadflux/cli |
| @mlightcad/cad-simple-viewer | WRAP_FIRST | Direct MLightCAD runtime integration; Reachable from @cadflux/web, @cadflux/server, or @cadflux/cli; active CadFlux usage is now narrowed toward a read-only viewer bridge |
| @mlightcad/cad-svg-plugin | WRAP_FIRST | Direct MLightCAD runtime integration; Reachable from @cadflux/web, @cadflux/server, or @cadflux/cli |
| @mlightcad/three-renderer | WRAP_FIRST | Direct MLightCAD runtime integration; Reachable from @cadflux/web, @cadflux/server, or @cadflux/cli |
| playwright | DELETE_AFTER_TESTS | Removed from current production conversion path; only historical baseline references remain |
| vue-i18n | DELETE_AFTER_TESTS | Active runtime/build references detected: 1; Removed from current English-only UI path; historical references may remain in baseline artifacts |
| fastify | KEEP_RUNTIME | Primary server framework |
| better-sqlite3 | KEEP_RUNTIME | Primary server database and queue storage |
| vite | KEEP_BUILD | Current web build tool |
| typescript | KEEP_BUILD | Current workspace build and analysis compiler |
