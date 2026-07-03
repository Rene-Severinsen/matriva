# Docker

Local development uses a Matriva-specific PostgreSQL service in the repo root:

```sh
docker compose -f docker-compose.dev.yml up -d matriva-postgres-dev
```

The local development connection string is:

```sh
postgresql://matriva:matriva_dev_password@127.0.0.1:56432/matriva_dev
```

The service mirrors the Docker/PostgreSQL development pattern used by nearby
projects while keeping Matriva data isolated in its own container, database, and
volume.
