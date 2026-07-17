# ADR-0010: Maintenance v1 domain model

## Status

Accepted

## Context

Maintenance v1 turns the existing task list into a homeowner work plan and history. The API remains the source of truth. The mobile app must not invent a parallel status engine, storage boundary, recommendation catalogue, or provenance model.

## Decision

Maintenance tasks and maintenance recommendations are separate domain objects.

Recommendations are stored in `maintenance_recommendations` with source type, review status, timing, recurrence, component key, provenance, and an optional relation to the task created at acceptance time. Pending recommendations can be accepted or dismissed. Acceptance creates a normal editable task with `source = recommendation_accepted`; dismissed recommendations remain dismissed for the same version key and do not reappear on refetch.

Tasks remain the active work plan. User-created tasks support create, read, update, date-based move, archive, and complete routes. System suggestions are not edited through task CRUD. Completion creates a `maintenance_completions` history record that snapshots the completed title, date, note, price, component, source, and recurrence.

Maintenance v1 does not own files, images, attachments, vendor data, warranty data, or improvement relations. Documents are handled by the house-level Documents domain, and house photos are handled by House media.

The homeowner-facing mobile flow is date-driven. User-created tasks use a concrete deadline or no date; create, edit, and move do not expose manual season chips. Seasonal filtering is derived from the shared date classifier. Pending recommendations may still carry seasonal timing, but accepting one as a task requires a concrete user-selected date unless the recommendation already has a concrete deadline.

Recurring v1 tasks use a constrained interval enum: monthly, quarterly, half-yearly, yearly, every 2, 3, 5, or 10 years. The v1 calculation anchors the next occurrence to the completed date. The contract keeps an anchor field so fixed calendar recurrence can be added later without replacing the API shape.

Price is part of the maintenance domain. It is optional and stored as integer minor units on both active tasks and completion snapshots: `price_amount_minor bigint null` plus `price_currency = 'DKK'`. Completing a task copies the task's current price into history; recurring successors inherit the price but can later be edited without changing the completed snapshot.

House documents and house photos use backend-streamed upload. The mobile app sends selected JPEG, PNG, HEIC/HEIF, or PDF files to the Matriva API. The API validates ownership, MIME type, declared size, actual bytes, and a conservative file signature before writing the object. Metadata is created only after object write succeeds. If metadata creation fails, the API deletes the just-written object to avoid orphaned storage.

## Hetzner S3 configuration

The API environment owns object storage configuration:

- `MATRIVA_S3_ENDPOINT`
- `MATRIVA_S3_REGION`
- `MATRIVA_S3_BUCKET`
- `MATRIVA_S3_ACCESS_KEY_ID`
- `MATRIVA_S3_SECRET_ACCESS_KEY`
- `MATRIVA_S3_FORCE_PATH_STYLE`
- `MATRIVA_S3_PRIVATE_OBJECTS`
- `MATRIVA_DOCUMENT_MAX_BYTES`
- `MATRIVA_OBJECT_STORAGE_DIR`
- `MATRIVA_ATTACHMENT_STORAGE_DIR`
- `MATRIVA_STORAGE_ADAPTER`

The bucket used for QA is `Matriva-qa`, configured outside the codebase. Values must not be committed, logged, returned through shared contracts, or copied into mobile configuration.

When S3 environment variables are present, the API uses its S3-compatible adapter. Automated smoke tests use a local adapter rooted in `MATRIVA_OBJECT_STORAGE_DIR`, so tests do not require real S3 secrets. `MATRIVA_ATTACHMENT_STORAGE_DIR` remains accepted as a local-storage compatibility alias.

## Consequences

History is no longer just `status = done`; it is backed by completion records. Recommendation provenance can later point to uploaded documents, warranty records, pages, extraction methods, confidence, and source references without automatically creating active tasks. Future LLM or document-derived suggestions must remain pending until explicit user acceptance.

The backend-streamed approach is simple and keeps storage credentials private, at the cost of sending file bytes through the API. If larger uploads become important later, this ADR can be extended with a short-lived presigned upload flow while preserving the same owner-scoped metadata and finalize rules.
