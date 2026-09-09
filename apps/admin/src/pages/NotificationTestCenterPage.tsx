import { useEffect, useState, type FormEvent } from "react";
import type { MatrivaAdminApiClient } from "@matriva/api-client";
import type {
  AdminNotificationDevicesResponse,
  AdminNotificationTest,
  AdminNotificationTestHistoryResponse,
  AdminUsersResponse,
  CreateAdminNotificationTestRequest
} from "@matriva/shared";

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Ikke registreret";
}

const statusLabels: Record<string, string> = {
  created: "Oprettet", queued: "I kø", sending: "Sender", sent: "Sendt", receipt_ok: "Receipt OK", failed: "Fejlet", invalid_token: "Ugyldigt token"
};

export function NotificationTestCenterPage({ client, onAuthorizationError }: { client: MatrivaAdminApiClient; onAuthorizationError: (error: unknown) => Promise<boolean> }) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<AdminUsersResponse["users"]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUsersResponse["users"][number] | null>(null);
  const [devices, setDevices] = useState<AdminNotificationDevicesResponse["devices"]>([]);
  const [selectedDevice, setSelectedDevice] = useState("all");
  const [title, setTitle] = useState("Matriva test");
  const [body, setBody] = useState("Dette er en testnotifikation fra Matriva.");
  const [destination, setDestination] = useState<"none" | "notification_center" | "sharing">("notification_center");
  const [activeTest, setActiveTest] = useState<AdminNotificationTest | null>(null);
  const [history, setHistory] = useState<AdminNotificationTestHistoryResponse["tests"]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) { setUsers([]); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void client.getAdminUsers({ query: query.trim(), page: 1, pageSize: 10, status: "all", signal: controller.signal }).then((response) => setUsers(response.users)).catch(async (error) => {
        if (!controller.signal.aborted && !(await onAuthorizationError(error))) setMessage(error instanceof Error ? error.message : "Brugersøgningen fejlede.");
      });
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [client, onAuthorizationError, query]);

  useEffect(() => {
    const controller = new AbortController();
    void client.getAdminNotificationTestHistory({ limit: 20, signal: controller.signal }).then((response) => setHistory(response.tests)).catch(async (error) => {
      if (!controller.signal.aborted) await onAuthorizationError(error);
    });
    return () => controller.abort();
  }, [client, onAuthorizationError, activeTest?.notificationId]);

  useEffect(() => {
    if (!activeTest || activeTest.status === "receipt_ok" || activeTest.status === "failed" || activeTest.status === "invalid_token") return;
    const timer = window.setInterval(() => void client.getAdminNotificationTest(activeTest.notificationId).then(setActiveTest).catch(() => undefined), 3000);
    return () => window.clearInterval(timer);
  }, [activeTest, client]);

  async function chooseUser(user: AdminUsersResponse["users"][number]) {
    setSelectedUser(user); setQuery(user.displayName ?? user.email); setUsers([]); setSelectedDevice("all"); setMessage(null);
    try {
      const response = await client.getAdminNotificationDevices(user.id);
      setDevices(response.devices);
      setSelectedDevice(response.devices.find((device) => device.enabled)?.id ?? "all");
    } catch (error) {
      if (!(await onAuthorizationError(error))) setMessage(error instanceof Error ? error.message : "Devices kunne ikke indlæses.");
    }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!selectedUser) { setMessage("Vælg en bruger først."); return; }
    if (!devices.some((device) => device.enabled)) { setMessage("Brugeren har ingen aktive push-enheder."); return; }
    setBusy(true); setMessage(null);
    const input: CreateAdminNotificationTestRequest = { targetUserId: selectedUser.id, targetDeviceId: selectedDevice === "all" ? null : selectedDevice, title, body, destination: { kind: destination } };
    try { setActiveTest(await client.createAdminNotificationTest(input)); }
    catch (error) { if (!(await onAuthorizationError(error))) setMessage(error instanceof Error ? error.message : "Testnotifikationen kunne ikke sendes."); }
    finally { setBusy(false); }
  }

  return <div className="notification-test-page">
    <section className="notification-test-heading"><div><p className="eyebrow">Drift og device-QA</p><h2>Notification Test Center</h2><p>Send én intern test gennem den normale notification-record, outbox og Expo-delivery.</p></div></section>
    {message ? <div className="dashboard-error" role="alert"><strong>{message}</strong></div> : null}
    <div className="notification-test-grid">
      <form className="notification-test-card" onSubmit={(event) => void send(event)}>
        <h3>Send test</h3>
        <label>Søg bruger<input value={query} onChange={(event) => { setQuery(event.target.value); if (selectedUser && event.target.value !== (selectedUser.displayName ?? selectedUser.email)) setSelectedUser(null); }} placeholder="Navn eller e-mail" /></label>
        {users.length ? <div className="notification-user-results">{users.map((user) => <button type="button" key={user.id} onClick={() => void chooseUser(user)}><strong>{user.displayName ?? "Navn mangler"}</strong><span>{user.email}</span></button>)}</div> : null}
        {selectedUser ? <div className="notification-selected-user"><strong>{selectedUser.displayName ?? "Navn mangler"}</strong><span>{selectedUser.email}</span></div> : null}
        <label>Device<select disabled={!devices.length} value={selectedDevice} onChange={(event) => setSelectedDevice(event.target.value)}><option value="all">Alle aktive devices</option>{devices.map((device) => <option disabled={!device.enabled} key={device.id} value={device.id}>{device.platform.toUpperCase()} · {device.enabled ? "Enabled" : "Disabled"} · {device.pushTokenMasked}</option>)}</select></label>
        <label>Titel<input maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label>Besked<textarea maxLength={500} rows={4} value={body} onChange={(event) => setBody(event.target.value)} /></label>
        <label>Destination<select value={destination} onChange={(event) => setDestination(event.target.value as typeof destination)}><option value="notification_center">Notification Center</option><option value="sharing">Bolig/adgang</option><option value="none">Ingen destination</option></select></label>
        <button className="primary-action" disabled={busy || !selectedUser || !devices.some((device) => device.enabled)} type="submit">{busy ? "Opretter test..." : "Send test"}</button>
        <p className="notification-test-note">Admin-test bypasser brugerens system-category preference, men ikke disabled devices, OS permission eller Expo-fejl.</p>
      </form>
      <section className="notification-test-card"><h3>Device overview</h3>{!selectedUser ? <p>Vælg en bruger for at se registrerede devices.</p> : devices.length === 0 ? <p>Brugeren har ingen registrerede devices.</p> : <div className="notification-device-list">{devices.map((device) => <article key={device.id}><div><strong>{device.platform.toUpperCase()}</strong><span>{device.enabled ? "Enabled" : "Disabled"} · {device.pushTokenMasked}</span></div><dl><div><dt>Device</dt><dd>{device.deviceId}</dd></div><div><dt>Permission</dt><dd>{device.permissionStatus}</dd></div><div><dt>App</dt><dd>{device.appVersion ?? "—"}</dd></div><div><dt>Last seen</dt><dd>{formatDate(device.lastSeenAt)}</dd></div><div><dt>Delivery</dt><dd>{device.latestDeliveryStatus ?? "—"}</dd></div></dl></article>)}</div>}</section>
    </div>
    {activeTest ? <section className="notification-test-card notification-test-result"><div className="section-heading-row"><div><p className="eyebrow">Seneste test</p><h3>{activeTest.title}</h3></div><button type="button" onClick={() => void client.getAdminNotificationTest(activeTest.notificationId).then(setActiveTest)}>Refresh</button></div><p>{activeTest.body}</p><div className="notification-result-meta"><span>Status <strong>{statusLabels[activeTest.status] ?? activeTest.status}</strong></span><span>Notification {activeTest.notificationId}</span><span>Oprettet {formatDate(activeTest.createdAt)}</span></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Device</th><th>Platform</th><th>Status</th><th>Forsøg</th><th>Ticket</th><th>Seneste fejl</th></tr></thead><tbody>{activeTest.deliveries.map((delivery) => <tr key={delivery.id}><td>{delivery.deviceId}</td><td>{delivery.platform}</td><td>{statusLabels[delivery.status] ?? delivery.status}</td><td>{delivery.attempts}</td><td>{delivery.providerTicketId ?? "—"}</td><td>{delivery.lastError ?? "—"}</td></tr>)}</tbody></table></div></section> : null}
    <section className="notification-test-card"><div className="section-heading-row"><div><p className="eyebrow">Auditspor</p><h3>Seneste admin-tests</h3></div><button type="button" onClick={() => void client.getAdminNotificationTestHistory({ limit: 20 }).then((response) => setHistory(response.tests))}>Refresh</button></div>{history.length === 0 ? <p>Ingen admin-tests endnu.</p> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Tidspunkt</th><th>Admin</th><th>Target user</th><th>Device</th><th>Titel</th><th>Status</th></tr></thead><tbody>{history.map((item) => <tr key={item.notificationId}><td>{formatDate(item.createdAt)}</td><td>{item.adminDisplayName ?? item.adminUserId}</td><td>{item.targetUserDisplayName ?? item.targetUserEmail}</td><td>{item.platform ?? (item.targetDeviceId ? "Device" : "Alle devices")}</td><td>{item.title}</td><td>{statusLabels[item.status] ?? item.status}</td></tr>)}</tbody></table></div>}</section>
  </div>;
}
