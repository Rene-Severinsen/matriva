import { pool } from "./db.ts";
import { isMaintenanceDeadlinePushWindowOpen } from "./notification-domain.ts";

const expoPushEndpoint = "https://exp.host/--/api/v2/push/send";
const expoReceiptEndpoint = "https://exp.host/--/api/v2/push/getReceipts";
const maximumAttempts = 5;

async function updateAdminTestAuditStatus(notificationId: string, status: string) {
  await pool.query(
    `update notification_admin_test_audit set result_status = $2, updated_at = now()
     where notification_id = $1`,
    [notificationId, status]
  );
}

type OutboxRow = {
  id: string;
  notification_id: string;
  push_token: string;
  device_id: string;
  notification_type: string;
  title: string;
  body: string;
  deep_link: string | null;
  priority: "low" | "normal" | "high";
  attempts: number;
};

function retryDelaySeconds(attempts: number) {
  return Math.min(3600, 15 * 2 ** Math.max(0, attempts - 1));
}

export async function processNotificationPushOutbox(batchSize = 50) {
  if (process.env.MATRIVA_PUSH_ENABLED === "false") return { claimed: 0, sent: 0, failed: 0, invalid: 0 };
  await pool.query(
    `update notification_push_outbox set status = 'failed', next_attempt_at = now(),
     last_error = 'Recovered stale sending lease', updated_at = now()
     where status = 'sending' and updated_at < now() - interval '5 minutes'`
  );
  await processExpoReceipts();
  const maintenanceDeadlinePushWindowOpen = isMaintenanceDeadlinePushWindowOpen(
    new Date(),
    process.env.MATRIVA_NOTIFICATION_TIME_ZONE ?? "Europe/Copenhagen"
  );
  const client = await pool.connect();
  let rows: OutboxRow[] = [];
  try {
    await client.query("begin");
    const claimed = await client.query<OutboxRow>(
      `select o.id, o.notification_id, o.device_id, o.attempts,
              d.push_token, n.notification_type, n.title, n.body, n.deep_link, n.priority
       from notification_push_outbox o
       join notification_devices d on d.id = o.device_id and d.enabled
       join notifications n on n.id = o.notification_id
       where o.status in ('pending', 'failed') and o.next_attempt_at <= now() and o.attempts < $1
         and ($3::boolean or n.notification_type not in ('maintenance_task_due_soon', 'maintenance_task_due_today', 'maintenance_task_overdue'))
       order by o.created_at
       for update of o skip locked limit $2`,
      [maximumAttempts, Math.max(1, Math.min(batchSize, 100)), maintenanceDeadlinePushWindowOpen]
    );
    rows = claimed.rows;
    if (rows.length) {
      await client.query(
        `update notification_push_outbox set status = 'sending', updated_at = now()
         where id = any($1::text[])`,
        [rows.map((row) => row.id)]
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally { client.release(); }

  let sent = 0;
  let failed = 0;
  let invalid = 0;
  for (const row of rows) {
    const attempt = row.attempts + 1;
    try {
      const response = await fetch(expoPushEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          to: row.push_token,
          title: row.title,
          body: row.body,
          sound: "default",
          priority: row.priority === "high" ? "high" : "default",
          data: { notificationId: row.notification_id, type: row.notification_type, deepLink: row.deep_link }
        }),
        signal: AbortSignal.timeout(10_000)
      });
      const payload = await response.json() as { data?: { status?: string; id?: string; details?: { error?: string }; message?: string } };
      const ticket = payload.data;
      if (!response.ok || ticket?.status === "error") {
        const providerError = ticket?.details?.error ?? ticket?.message ?? `Expo HTTP ${response.status}`;
        if (providerError === "DeviceNotRegistered") {
          const invalidClient = await pool.connect();
          try {
            await invalidClient.query("begin");
            await invalidClient.query(`update notification_devices set enabled = false, updated_at = now() where id = $1`, [row.device_id]);
            await invalidClient.query(`update notification_push_outbox set status = 'invalid_token', attempts = $2, last_attempt_at = now(), last_error = $3, updated_at = now() where id = $1`, [row.id, attempt, providerError]);
            await invalidClient.query("commit");
          } catch (error) { await invalidClient.query("rollback"); throw error; }
          finally { invalidClient.release(); }
          await updateAdminTestAuditStatus(row.notification_id, "invalid_token");
          invalid += 1;
          console.warn(JSON.stringify({ event: "notification_push_invalid_token", outboxId: row.id, deviceId: row.device_id }));
          continue;
        }
        throw new Error(providerError);
      }
      await pool.query(
        `update notification_push_outbox set status = 'sent', attempts = $2,
         last_attempt_at = now(), sent_at = now(), provider_ticket_id = $3,
         last_error = null, updated_at = now() where id = $1`,
        [row.id, attempt, ticket?.id ?? null]
      );
      await updateAdminTestAuditStatus(row.notification_id, "sent");
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown Expo push error";
      await pool.query(
        `update notification_push_outbox set status = 'failed', attempts = $2,
         last_attempt_at = now(), next_attempt_at = now() + ($3 * interval '1 second'),
         last_error = $4, updated_at = now() where id = $1`,
        [row.id, attempt, retryDelaySeconds(attempt), message]
      );
      await updateAdminTestAuditStatus(row.notification_id, "failed");
      failed += 1;
      console.warn(JSON.stringify({ event: "notification_push_failed", outboxId: row.id, attempt, error: message }));
    }
  }
  if (rows.length) console.info(JSON.stringify({ event: "notification_push_batch", claimed: rows.length, sent, failed, invalid }));
  return { claimed: rows.length, sent, failed, invalid };
}

async function processExpoReceipts() {
  const result = await pool.query<{ id: string; notification_id: string; device_id: string; provider_ticket_id: string }>(
    `select id, notification_id, device_id, provider_ticket_id from notification_push_outbox
     where status = 'sent' and provider_ticket_id is not null and receipt_checked_at is null
       and sent_at < now() - interval '15 seconds'
     order by sent_at limit 100`
  );
  if (!result.rows.length) return;
  try {
    const response = await fetch(expoReceiptEndpoint, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ ids: result.rows.map((row) => row.provider_ticket_id) }),
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) throw new Error(`Expo receipt HTTP ${response.status}`);
    const payload = await response.json() as { data?: Record<string, { status?: string; message?: string; details?: { error?: string } }> };
    for (const row of result.rows) {
      const receipt = payload.data?.[row.provider_ticket_id];
      if (!receipt) continue;
      const providerError = receipt.details?.error ?? receipt.message ?? null;
      if (providerError === "DeviceNotRegistered") {
        const client = await pool.connect();
        try {
          await client.query("begin");
          await client.query(`update notification_devices set enabled = false, updated_at = now() where id = $1`, [row.device_id]);
          await client.query(`update notification_push_outbox set status = 'invalid_token', receipt_checked_at = now(), last_error = $2, updated_at = now() where id = $1`, [row.id, providerError]);
          await client.query("commit");
        } catch (error) { await client.query("rollback"); throw error; }
        finally { client.release(); }
        await updateAdminTestAuditStatus(row.notification_id, "invalid_token");
        console.warn(JSON.stringify({ event: "notification_push_invalid_token", outboxId: row.id, deviceId: row.device_id, source: "receipt" }));
      } else {
        await pool.query(
          `update notification_push_outbox set receipt_checked_at = now(),
           status = case when $2::text is null then status else 'failed' end,
           attempts = case when $2::text is null then attempts else $3 end,
           last_error = $2, updated_at = now() where id = $1`,
          [row.id, providerError, maximumAttempts]
        );
        await updateAdminTestAuditStatus(row.notification_id, providerError ? "failed" : "receipt_ok");
      }
    }
  } catch (error) {
    console.warn(JSON.stringify({ event: "notification_push_receipts_failed", error: error instanceof Error ? error.message : "unknown" }));
  }
}
