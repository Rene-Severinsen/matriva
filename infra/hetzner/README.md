# Hetzner

QA and production must use S3-compatible object storage for every API-managed
object: guide assets, house photos, and house documents. Local file storage is
reserved for local development and automated tests.

The Hetzner runtime must provide these values through the hosting environment
configuration, never through committed files:

```text
MATRIVA_ENVIRONMENT=qa            # production on the production runtime
MATRIVA_STORAGE_ADAPTER=s3
MATRIVA_S3_ENDPOINT=...
MATRIVA_S3_REGION=...
MATRIVA_S3_BUCKET=...
MATRIVA_S3_ACCESS_KEY_ID=...
MATRIVA_S3_SECRET_ACCESS_KEY=...
MATRIVA_S3_FORCE_PATH_STYLE=true
MATRIVA_S3_PRIVATE_OBJECTS=true
```

The API fails closed at startup when QA or production is configured for local
storage or when the S3 configuration is incomplete. Before switching an
existing runtime, copy and verify its local objects in the target bucket; only
then restart the API with `MATRIVA_STORAGE_ADAPTER=s3`. Do not delete local
objects until the S3 copy has been independently verified.

No secrets should be committed here.
