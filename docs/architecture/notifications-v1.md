# Notifications V1

Matriva Notifications V1 is a backend-owned notification domain. A row in `notifications` is the authoritative event for one user; native push is an optional delivery channel backed by `notification_push_outbox`.

## Flow

Domain hooks and the deadline scheduler resolve active house memberships, apply each user's category preferences, insert one deduplicated notification, and enqueue one outbox row per active device when push is enabled. Expo delivery never runs inside the business transaction. Failed deliveries retry with exponential backoff; Expo `DeviceNotRegistered` responses disable the token.

The current V1 hooks cover maintenance deadlines, newly inserted maintenance recommendations, invitations, invitation acceptance, and house-claim request/approval/rejection. Recommendation recalculation uses the existing unique recommendation row and only emits when the insert returns a new id.

## Configuration

- `MATRIVA_PUSH_ENABLED=false` disables external Expo delivery while retaining in-app notifications and queued state.
- `MATRIVA_NOTIFICATION_INTERVAL_MS` controls the combined deadline/outbox worker interval and is clamped to at least 60 seconds. The default is 300000.
- `MATRIVA_NOTIFICATION_TIME_ZONE` controls the calendar date used by deadline reminders. The default is `Europe/Copenhagen`.
- No Expo access token or push secret is stored by Matriva. The app's existing EAS `projectId` is passed when obtaining an Expo push token.

The mobile app uses `expo-notifications` and the native Expo config plugin. Permission is requested only after the user chooses to enable push in notification settings. Android uses a normal notification channel; iOS and Android users can jump to the OS app settings when permission is denied.

## Operational behavior

Deadline generation is restart- and retry-safe because the database uniqueness key contains notification type, task, recipient and due-date window. Overdue uses the task's due date as its stable window, so it is not recreated every day. Device registration is idempotent by `(user_id, device_id)` and push tokens are globally unique.

Logs are aggregate or failure-oriented: scheduler completion, push batch completion, push failure, invalid token and job failure. Push payloads contain only notification id, type, short title/body and deep link.

## Admin notification test center

The admin test center is an authenticated, server-side test harness. It creates a normal user notification and uses the same push outbox and worker as production notifications, so it does not send directly from the browser or store provider credentials in the admin app. Each manual send gets a unique deduplication key and an audit row containing the admin actor, target user/device and current delivery result.

Tests intentionally bypass the target user's category preference for the `system` category so an administrator can verify delivery. They still require an active target user and enabled device, validate any selected destination against the target user's data, and expose only masked push tokens. A successful API response means the notification was queued; provider receipt status and invalid-token failures are reported asynchronously by the existing worker.

Operational QA is: sign in as an admin, open **Notifications**, search for a test user, inspect a physical iOS or Android device, select one device (or all active devices), keep the default title/body, send, and follow the outbox from queued through Expo ticket and receipt. Verify the push, tap it to confirm the selected internal destination, and confirm the same test row appears in the user's in-app notification center. Repeat with the user's system push preference off to verify the explicit admin bypass, then repeat on the other platform.

## Device QA boundary

Static typecheck and automated domain tests can verify routing, preference contracts and idempotency constraints locally. Real APNs/FCM delivery, OS settings presence, foreground/background presentation and terminated-state taps require an EAS development/preview build on physical iOS and Android devices; Expo Go and simulators are not sufficient evidence of end-to-end remote push delivery.
