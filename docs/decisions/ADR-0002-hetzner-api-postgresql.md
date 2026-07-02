# ADR-0002: Hetzner API And PostgreSQL

## Status

Accepted

## Context

Matriva handles sensitive home, person, document, maintenance, subscription, and sharing-related data. The architecture must support privacy, security, auditability, data export/deletion, and controlled file access from the start.

The project direction is a Hetzner-hosted API with PostgreSQL as source of truth. The prohibited prototype backend stack must not be reused for backend, database, storage, authentication, analytics, or serverless functions.

## Decision

Matriva's production backend will be hosted on Hetzner.

PostgreSQL is the source of truth for application data.

The Matriva API owns access to data and files. Object/file storage must be controlled through backend authorization and access policies.

The mobile app must not access the database or object storage directly.

The backend must support audit basics, backup, GDPR export/delete, account deletion, data deletion, and secure file access.

Local development may use local services where useful, but the production direction remains Hetzner/API/PostgreSQL.

## Consequences

The API becomes the boundary for privacy, security, authorization, entitlements, dynamic content, document metadata, file access, and deletion/export workflows.

The mobile app must be built around API contracts rather than direct storage/database SDKs.

Infrastructure work should document deployment, backups, restore procedures, secret handling, and operational ownership before production launch.

## Alternatives Considered

The old prototype backend direction was rejected because the rules explicitly prohibit reusing that backend, database, storage, authentication, analytics, and serverless architecture.

A direct-from-mobile database or storage model was rejected because it weakens centralized authorization, auditability, deletion/export guarantees, and platform compliance documentation.

Other third-party backend, BaaS, storage, or auth platforms require a separate architecture decision before implementation.

## App Store / Google Play Impact

Centralized backend access makes it easier to document dataflows for App Privacy, Privacy Nutrition Labels, Google Play Data Safety, account deletion, and review notes.

The app must not hide direct dataflows to database or storage services.

## Security / Privacy Impact

Backend-owned access reduces exposure of private infrastructure and enables consistent authorization, audit logging, URL protection, and deletion/export flows.

Sensitive file URLs must be protected and access-controlled per user, house, and sharing relationship.

## Operational Impact

Hetzner operations must eventually cover deployment, monitoring, backup, restore, secret management, database migrations, file storage lifecycle, and incident response.

Production infrastructure must not rely on local development shortcuts.
