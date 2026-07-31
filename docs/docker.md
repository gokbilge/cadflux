# Docker

Build:

```bash
docker build -t cadflux .
```

Run:

```bash
docker run --rm \
  -p 8080:8080 \
  -e CADFLUX_SESSION_SECRET=replace-this \
  -e CADFLUX_ADMIN_USERNAME=admin \
  -e CADFLUX_ADMIN_PASSWORD=ChangeThisPassword123! \
  -v cadflux-data:/app/data \
  cadflux
```

Compose:

```bash
docker compose up --build
```

Notes:

- The server serves the built web frontend directly.
- SQLite and uploaded/generated files live in `/app/data`.
- Use a persistent volume in production.
- Replace the default compose credentials before deployment.
