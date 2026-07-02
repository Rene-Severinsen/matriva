# ADR-0005: Dynamic Content Cards

## Status

Accepted

## Context

Matriva should help homeowners understand what to do now, what to remember later, where documentation belongs, and what is relevant for their home.

V1 scope says the app should be a stable native shell while the backend acts as the brain. Maintenance catalogues, legal/regulatory updates, local warnings, seasonal advice, and house-type recommendations must evolve without requiring app releases for each content change.

## Decision

The mobile app is a thin native shell for dynamic content.

The backend delivers dynamic cards/content to the app.

Maintenance tasks, local warnings, legal/regulatory updates, seasonal recommendations, and house-type-relevant recommendations must not be hardcoded in the app.

The app must support known card types and provide safe fallback behavior for unknown card types.

Dynamic content must include:

* type
* title
* short explanation
* severity
* action
* validity period
* minAppVersion
* fallbackText

Advisories about legislation, safety, pests, weather, municipality matters, or home risk must include a source and validity period.

Advisory text must be framed as guidance, not legal, structural, or building-inspection advice, unless an authoritative source clearly supports the statement.

## Consequences

The app can render useful, current guidance without embedding volatile catalogues or regulatory content.

The backend must own targeting, validity, severity, source metadata, and app-version compatibility.

The app must be resilient to unknown or expired content and must not crash because a card type is missing or newer than the app supports.

## Alternatives Considered

Hardcoding task catalogues and advisories in the app was rejected because it would require app releases for content changes and increase review risk around stale or undocumented guidance.

Using the app as a news or crawler-driven surface was rejected because V1 is not a news app and automatic news ingestion/crawling is explicitly out of scope.

Showing unsupported dynamic content without fallback was rejected because it risks confusing users and breaking older app versions.

## App Store / Google Play Impact

Backend-driven content must avoid hidden dataflows and must be documented in review notes where relevant.

Advisory content must not frame Matriva as a regulated legal, construction, or inspection advisor unless the product and compliance posture explicitly support that role.

## Security / Privacy Impact

Dynamic content targeting must use minimized data and should avoid unnecessary profiling.

Sources, validity periods, and severity must be transparent enough to support user trust and compliance documentation.

## Operational Impact

The backend needs content governance, validation, expiry handling, source tracking, and rollback or disable capability for problematic cards.

Content publishing must account for app versions, fallbacks, and stale clients.
