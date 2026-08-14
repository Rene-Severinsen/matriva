# Matriva mobile API compatibility contract

This document is the normative contract between the Matriva backend and published mobile app versions. It applies to bootstrap, entitlements, feature flags, shared API schemas, and other API responses consumed by the mobile client.

## Normative rules

- Backend API responses MUST be backward compatible with supported published app versions.
- New response fields MUST be additive by default.
- The mobile client MUST tolerate and ignore unknown additive response fields.
- Existing fields MUST NOT be removed, renamed, have their datatype changed, or have their meaning changed in the same release that introduces new client code.
- Breaking changes MUST be delivered as a staged migration where the old and new contracts exist in parallel until old clients are no longer supported.
- A backend deploy MUST NOT assume that a new App Store/TestFlight version is already installed.
- A minimum supported app version/build MUST be an explicit product/operations decision, never an accidental consequence of a schema change.
- `/v2` or parallel API versioning MAY be introduced only for a documented need; additive contracts and staged migration MUST be preferred first.
- Every change to shared API schemas/contracts MUST be assessed for backward compatibility before merge/deploy.
- New entitlement, bootstrap, and feature fields MUST be addable without causing existing clients to fail.
- Raw validation errors MUST NOT be the normal user experience for compatibility problems.

The current mobile response schemas use Zod's explicit strip behavior for the central bootstrap and entitlement contract. Known fields remain type-validated; unknown response keys are ignored. This rule applies recursively through the existing response schemas rather than introducing a second API-versioning architecture.

Entitlement feature maps are string-keyed on the wire. The known feature enum remains available for typed client access and stable error details, but it MUST NOT make the response map exhaustive: a newly added feature key is an additive field and older clients must be able to ignore it.

## Client identity and compatibility response

The mobile API client sends app identity on API calls when Expo exposes it:

- `x-matriva-app-version` comes from the Expo app config version.
- `x-matriva-app-build` comes from the platform build number/version code in the Expo app config.

The client does not hardcode release numbers. Expo Go/local development may not expose a native build number; missing headers MUST remain non-blocking under the default policy.

The API includes a small `compatibility` object in bootstrap responses. It reports the configured minimum version/build and whether the requesting client is supported. Minimums are unset by default. Operators can explicitly configure `MATRIVA_MIN_SUPPORTED_APP_VERSION` and/or `MATRIVA_MIN_SUPPORTED_APP_BUILD`; an unsupported client receives HTTP `426` with the stable code `app_update_required` and a machine-readable compatibility detail.

The mobile app maps that response to a controlled “Opdatér Matriva” state. It MUST NOT show raw JSON or schema-validation details to the user.

## Release sequence

```text
Backend A: gammel + ny kontrakt
→ App N frigives
→ adoption / minimum-supported-version vurderes
→ Backend B kan senere udfase gammel kontrakt
```

Backend A continues serving the old response shape while App N is adopted. Only after support and adoption have been explicitly assessed may Backend B remove or retire the old contract.

## Developer checklist

Before changing an API contract:

- [ ] Identify every supported published mobile version that consumes the response.
- [ ] Confirm the change is additive; do not remove, rename, retype, or reinterpret an existing field.
- [ ] Confirm the mobile schema ignores unknown additive response fields while still validating known field types.
- [ ] Add or update a regression test with an older-client payload containing new unknown fields.
- [ ] Decide whether the change needs a staged migration; if yes, document the old/new parallel contract and removal condition.
- [ ] Confirm a backend deploy works when the new mobile build is not installed.
- [ ] If an old client must be blocked, record the explicit minimum version/build decision and rollout/recovery plan.
- [ ] Confirm compatibility failures return a stable machine-readable code and a controlled mobile state, not raw validation output.
- [ ] Run the relevant typecheck/tests and `git diff --check` before merge/deploy.
