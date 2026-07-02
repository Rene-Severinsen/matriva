# Dependency Audit Notes

## 2026-07-02

`npm audit --omit=dev` reports a moderate advisory for `uuid <11.1.1` through Expo's transitive build-tooling chain:

```text
expo -> @expo/config-plugins -> xcode -> uuid@7.0.3
```

The suggested automatic fix is `npm audit fix --force`, which would install `expo@46.0.21` and break the selected Expo 57 foundation.

Decision for the skeleton foundation:

* do not force-downgrade Expo
* keep the app on the current Expo foundation
* treat this as a pre-release dependency item to monitor before App Store / Google Play submission
* revisit when Expo or `xcode` publishes a compatible patched transitive dependency

No Firebase packages, billing SDKs, upload SDKs, push SDKs, or analytics SDKs are installed.
