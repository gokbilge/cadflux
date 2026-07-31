# CadFlux architecture

CadFlux is now a server-backed web application.

Current runtime shape:

- Vue frontend in `apps/web`
- Fastify server in `apps/server`
- SQLite persistence in `packages/database`
- Local filesystem storage under `CADFLUX_DATA_DIR`
- Internal persistent queue claimed from SQLite
- Child-process conversion workers launched by the server
- Shared conversion packages reused by server and frontend

Main flow:

1. User authenticates with cookie-backed session auth.
2. User creates a draft job.
3. Browser uploads DWG/DXF files to the server with streaming multipart writes.
4. Files are stored under `data/jobs/<job-id>/input`.
5. Job files are queued in SQLite.
6. The server worker manager claims eligible files transactionally.
7. Each file is converted in an isolated child process.
8. Generated artifacts are written under `data/jobs/<job-id>/output`.
9. Artifact metadata and job progress are persisted in SQLite.
10. SSE pushes progress updates to the web client.
11. Reports and ZIP bundles are generated from persisted job state and artifacts.

Important current constraints:

- Queue persistence is SQLite-backed.
- No external MQ is required.
- Browser UI is authoritative for human operators.
- The CLI now supports the core server-backed job lifecycle: login, create, upload, start, pause, resume, retry, cancel, inspect, and download reports.
- Legacy direct local conversion commands still remain for compatibility and are not the preferred production path.
- PDF/SVG rendering still depends on the existing renderer packages.
