# Server installation

Requirements:

- Node.js 24+
- pnpm 10+

Local setup:

```bash
pnpm install
pnpm build:cadflux
```

Environment:

```bash
CADFLUX_HOST=0.0.0.0
CADFLUX_PORT=8080
CADFLUX_DATA_DIR=./data
CADFLUX_DATABASE_PATH=./data/database/cadflux.sqlite
CADFLUX_SESSION_SECRET=replace-with-a-long-random-secret
CADFLUX_ADMIN_USERNAME=admin
CADFLUX_ADMIN_PASSWORD=ChangeThisPassword123!
CADFLUX_WORKER_CONCURRENCY=1
CADFLUX_CONVERSION_TIMEOUT_MS=300000
```

First start:

```bash
node apps/server/dist/apps/server/src/index.js serve
```

Health checks:

```bash
curl http://localhost:8080/health/live
curl http://localhost:8080/health/ready
```

User bootstrap commands:

```bash
node apps/server/dist/apps/server/src/index.js user:create --username alice --password StrongPassword123!
node apps/server/dist/apps/server/src/index.js user:reset-password --username alice --password NewStrongPassword123!
```
