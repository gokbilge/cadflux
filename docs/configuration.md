# Configuration

Main server environment variables:

```text
CADFLUX_HOST
CADFLUX_PORT
CADFLUX_BASE_URL
CADFLUX_DATA_DIR
CADFLUX_DATABASE_PATH
CADFLUX_SESSION_SECRET
CADFLUX_ADMIN_USERNAME
CADFLUX_ADMIN_PASSWORD
CADFLUX_WORKER_CONCURRENCY
CADFLUX_CONVERSION_TIMEOUT_MS
CADFLUX_MAX_FILE_SIZE
CADFLUX_MAX_FILES_PER_JOB
CADFLUX_RETRY_BACKOFF_MS
CADFLUX_STALE_CLAIM_MINUTES
CADFLUX_SECURE_COOKIES
CADFLUX_TRUST_PROXY
CADFLUX_LOG_LEVEL
```

Operational notes:

- `CADFLUX_SESSION_SECRET` must be long and random in production.
- `CADFLUX_ADMIN_USERNAME` and `CADFLUX_ADMIN_PASSWORD` are only used for first-user bootstrap when the database is empty.
- `CADFLUX_WORKER_CONCURRENCY` should stay low unless host capacity is proven.
- `CADFLUX_CONVERSION_TIMEOUT_MS` bounds child-process conversion runtime.
- `CADFLUX_RETRY_BACKOFF_MS` controls when retryable failures become eligible again.
- `CADFLUX_STALE_CLAIM_MINUTES` controls stale claimed-file recovery.
