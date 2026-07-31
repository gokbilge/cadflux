# CLI

CadFlux CLI currently supports two roles:

1. server-backed job control commands
2. existing local conversion commands retained for compatibility

Recommended server-backed commands:

```bash
cadflux login --server http://localhost:8080 --username admin --password '...'
cadflux jobs list
cadflux jobs create --name "Example job"
cadflux upload ./drawings --job <job-id> --recursive
cadflux jobs start <job-id>
cadflux jobs pause <job-id>
cadflux jobs resume <job-id>
cadflux jobs retry <job-id>
cadflux jobs status <job-id>
cadflux jobs download <job-id> --output ./cadflux-job.zip
cadflux jobs cancel <job-id>
cadflux profiles list
cadflux logout
```

Session behavior:

- CLI login stores server session cookies and CSRF state locally.
- The CLI does not persist plaintext passwords.
- The local session file is written with restrictive permissions where the host OS honors them.
- Logout clears the local saved session.

Upload behavior:

- CLI uploads use multipart streaming through the Node runtime instead of loading full CAD files into memory first.
- Relative paths collected from recursive directory uploads are preserved and sent to the server.

Current limitation:

- The legacy direct local conversion commands still exist.
- The CLI has not yet been fully reduced to API-client-only behavior.
