import { adminBillingAuditSchema } from "@matriva/shared";
import { pool } from "./db.ts";

export async function getAdminBillingAudit(userId: string) {
  const [subscriptions, events] = await Promise.all([
    pool.query(`select id, provider, environment, product_id, status, original_transaction_id,
      provider_subscription_id, current_period_starts_at, current_period_ends_at,
      auto_renew, last_verified_at, created_at, updated_at
      from billing_subscriptions where user_id = $1
      order by current_period_ends_at desc nulls last, updated_at desc, id`, [userId]),
    pool.query(`select e.id::text, e.provider, e.environment, e.provider_event_id, e.event_type,
      e.provider_subscription_id, e.occurred_at, e.created_at, e.processed_at, e.processing_error
      from billing_events e
      where e.user_id = $1 or exists (
        select 1 from billing_subscriptions s where s.user_id = $1
        and s.provider = e.provider and s.environment = e.environment
        and (s.provider_subscription_id = e.provider_subscription_id
          or s.original_transaction_id = e.payload->>'originalTransactionId'))
      order by e.created_at desc, e.id desc limit 100`, [userId])
  ]);
  const date = (value: Date | null) => value ? value.toISOString() : null;
  return adminBillingAuditSchema.parse({
    subscriptions: subscriptions.rows.map(s => ({
      id: s.id, provider: s.provider, environment: s.environment, productId: s.product_id,
      status: s.status, originalTransactionId: s.original_transaction_id,
      transactionId: s.provider_subscription_id, periodStartsAt: date(s.current_period_starts_at),
      periodEndsAt: date(s.current_period_ends_at), autoRenew: s.auto_renew,
      lastVerifiedAt: date(s.last_verified_at), createdAt: date(s.created_at), updatedAt: date(s.updated_at)
    })),
    events: events.rows.map(e => ({
      id: e.id, provider: e.provider, environment: e.environment, eventId: e.provider_event_id,
      eventType: e.event_type, transactionId: e.provider_subscription_id,
      occurredAt: date(e.occurred_at), receivedAt: date(e.created_at),
      processedAt: date(e.processed_at), processingError: e.processing_error
    })), eventLimit: 100
  });
}
