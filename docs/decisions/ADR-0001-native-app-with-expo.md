# ADR-0001: Native App With Expo

## Status

Accepted

## Context

Matriva V1 is a native-first homeowner app for iOS and Android. The product must feel stable, practical, and mobile-native while keeping development focused on one shared codebase.

The project rules require one React Native / Expo codebase for both platforms. Separate Swift/iOS and Kotlin/Android app codebases would add review, testing, privacy, permission, and maintenance overhead before V1 has proven its core value.

## Decision

Matriva will be built as a native-first React Native / Expo application with one shared codebase for iOS and Android.

Expo development builds will be used when native capabilities require them. Expo Go is acceptable only for development paths that do not depend on native capabilities.

Separate Swift/iOS and Kotlin/Android app codebases must not be created without a separate architecture decision.

Platform-specific code is allowed only when required for permissions, native platform behavior, app review metadata, build/signing configuration, or platform-specific UI conventions. Any platform-specific code must be isolated, documented, and tested with equivalent behavior or fallback on the other platform.

The app should be designed as a stable native shell. Product content, maintenance catalogues, local advisories, legal/regulatory updates, and entitlement rules should come from the backend rather than being hardcoded in the app.

## Consequences

The mobile app can share UI components, domain logic, validation schemas, and API client behavior across iOS and Android.

Platform-specific implementation remains possible, but each use must be justified and kept narrow.

The project must maintain Expo/EAS compatibility from the start and avoid native dependencies unless their purpose and platform review impact are documented.

## Alternatives Considered

Separate native iOS and Android apps were rejected because they would increase build, review, testing, compliance, and maintenance work before V1 validates the product.

A webapp-first or wrapper-first approach was rejected because Matriva needs a native-first experience for permissions, offline/network handling, notifications, documents, and platform review readiness.

## App Store / Google Play Impact

One Expo-based native app must still satisfy each platform's permission, privacy, metadata, and review requirements.

Development builds make it possible to test native capabilities before submission. Platform-specific permission copy or metadata must be documented when introduced.

## Security / Privacy Impact

The app must not add native SDKs, analytics, billing, upload, push, or tracking capabilities without following `MATRIVA_RULESET.md`.

Keeping the app as a shell reduces the risk of hidden dataflows and hardcoded data behavior.

## Operational Impact

CI, EAS Build, local builds, typechecking, and release validation should treat iOS and Android as outputs of the same source.

Native dependencies require explicit documentation of iOS impact, Android impact, permission impact, and Apple/Google review impact.
