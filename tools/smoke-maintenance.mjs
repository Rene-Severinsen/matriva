import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const host = "127.0.0.1";
const port = "4102";
const baseUrl = `http://${host}:${port}`;
const startupTimeoutMs = 20_000;
const requestTimeoutMs = 4_000;
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://matriva:matriva_dev_password@127.0.0.1:56432/matriva_dev";

let capturedOutput = "";

function appendOutput(chunk) {
  capturedOutput = `${capturedOutput}${chunk.toString("utf8")}`.slice(-8000);
}

function redact(text) {
  return text.replace(/(secret|password|token|key|credential)[^=\n]*=[^\s]+/gi, "$1=[redacted]");
}

function printCapturedOutput() {
  const output = redact(capturedOutput.trim());
  if (output) {
    console.error("Captured API output:");
    console.error(output);
  }
}

function startApi(storageDir) {
  const child = spawn("npm", ["run", "dev:api"], {
    cwd: process.cwd(),
    detached: process.platform !== "win32",
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      HOST: host,
      PORT: port,
      MATRIVA_ATTACHMENT_STORAGE_DIR: storageDir,
      MATRIVA_STORAGE_ADAPTER: "local",
      MATRIVA_MAINTENANCE_ATTACHMENT_MAX_BYTES: `${1024 * 1024}`
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  child.stdout.on("data", appendOutput);
  child.stderr.on("data", appendOutput);

  return child;
}

function stopApi(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  if (process.platform === "win32") {
    child.kill("SIGTERM");
    return;
  }

  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

async function fetchJson(path, options = {}) {
  const response = await fetchWithTimeout(path, options);
  const body = await response.json();

  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}: ${JSON.stringify(body)}`);
  }

  return body;
}

async function fetchJsonWithStatus(path, options = {}) {
  const response = await fetchWithTimeout(path, options);
  let body = null;

  try {
    body = await response.json();
  } catch {
    body = null;
  }

  return { status: response.status, body };
}

async function fetchRawWithStatus(path, options = {}) {
  const response = await fetchWithTimeout(path, options);

  return {
    status: response.status,
    contentType: response.headers.get("content-type"),
    body: Buffer.from(await response.arrayBuffer())
  };
}

async function fetchWithTimeout(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    return await fetch(`${baseUrl}${path}`, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function authHeaders(session, extra = {}) {
  return {
    ...extra,
    authorization: `Bearer ${session.tokens.accessToken}`
  };
}

async function waitForApi() {
  const started = Date.now();

  while (Date.now() - started < startupTimeoutMs) {
    try {
      const health = await fetchJson("/health");
      if (health.status === "ok") {
        return;
      }
    } catch {
      await delay(250);
    }
  }

  throw new Error("API did not become ready in time.");
}

async function login(email) {
  const request = await fetchJson("/v1/auth/magic-link/request", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email })
  });
  const token = new URL(request.devMagicLink).searchParams.get("token");

  return fetchJson("/v1/auth/magic-link/consume", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token })
  });
}

async function createHouse(session, label) {
  return fetchJson("/v1/houses", {
    method: "POST",
    headers: authHeaders(session, { "content-type": "application/json" }),
    body: JSON.stringify({
      selectedAddress: {
        source: "DAWA",
        sourceAddressId: `addr-${randomUUID()}`,
        sourceAccessAddressId: `access-${randomUUID()}`,
        label
      }
    })
  });
}

async function runSmoke() {
  await waitForApi();
  const shared = await import("../packages/shared/dist/index.js");
  const seasonCases = [
    ["2026-02-01", "winter"],
    ["2026-03-01", "spring"],
    ["2026-05-31", "spring"],
    ["2026-06-01", "summer"],
    ["2026-08-31", "summer"],
    ["2026-09-01", "autumn"],
    ["2026-11-30", "autumn"],
    ["2026-12-01", "winter"]
  ];

  for (const [dateOnly, expectedSeason] of seasonCases) {
    assert(
      shared.maintenanceSeasonForDateOnly(dateOnly) === expectedSeason,
      `${dateOnly} must classify as ${expectedSeason}.`
    );
  }
  const priceCases = [
    ["1250", 125000],
    ["1250,5", 125050],
    ["1250,50", 125050],
    ["1250.50", 125050],
    ["", null]
  ];

  for (const [input, expectedAmountMinor] of priceCases) {
    const parsed = shared.parseDanishPriceInput(input);
    assert(parsed.ok, `${input} must parse as a valid Danish price.`);
    assert(
      parsed.amountMinor === expectedAmountMinor,
      `${input} must parse to ${expectedAmountMinor}.`
    );
  }

  assert(
    shared.parseDanishPriceInput("1250,555").ok === false,
    "Prices with more than two decimals must be rejected."
  );

  const session = await login(`maintenance-${Date.now()}@example.test`);
  const otherSession = await login(`maintenance-other-${Date.now()}@example.test`);
  const savedHouse = await createHouse(session, "Ringstedgade 130, 4700 Næstved");
  const otherHouse = await createHouse(otherSession, "Rådhuspladsen 1, 1550 København V");
  const houseId = savedHouse.house.id;

  const recommendations = await fetchJson(
    `/v1/houses/${houseId}/maintenance-recommendations`,
    { headers: authHeaders(session) }
  );
  assert(recommendations.recommendations.length > 0, "Recommendations must be returned.");
  assert(
    recommendations.recommendations.some((item) => item.catalogKey === "smoke_alarm_check"),
    "Generic V1 catalog recommendations must be returned."
  );
  assert(
    recommendations.recommendations.every((item) => item.suggestedDueDate && item.periodKey),
    "Recommendations must include suggested dates and period keys."
  );
  assert(
    recommendations.recommendations.every((item) =>
      ["roof", "facade", "windows", "doors", "foundation", "drainage", "heating", "plumbing", "electricity", "interior", "garden", "other", "none"].includes(item.componentKey)
    ),
    "Recommendations must use approved maintenance component keys."
  );
  assert(
    recommendations.recommendations[0].provenance.originalTitle,
    "Recommendation provenance must be preserved."
  );

  const recommendation = recommendations.recommendations[0];
  const initialRecommendationCount = recommendations.recommendations.length;
  const accepted = await fetchJson(
    `/v1/houses/${houseId}/maintenance-recommendations/${recommendation.id}/accept`,
    {
      method: "POST",
      headers: authHeaders(session, { "content-type": "application/json" }),
      body: JSON.stringify({
        dueDate: "2026-09-15",
        recurrenceInterval: recommendation.defaultRecurrence?.interval ?? recommendation.recurrence?.interval ?? "yearly"
      })
    }
  );
  const acceptedAgain = await fetchJson(
    `/v1/houses/${houseId}/maintenance-recommendations/${recommendation.id}/accept`,
    {
      method: "POST",
      headers: authHeaders(session, { "content-type": "application/json" }),
      body: JSON.stringify({
        dueDate: "2026-09-15",
        recurrenceInterval: recommendation.defaultRecurrence?.interval ?? recommendation.recurrence?.interval ?? "yearly"
      })
    }
  );
  assert(
    accepted.task.id === acceptedAgain.task.id,
    "Repeated recommendation accept must not create duplicate tasks."
  );
  assert(
    accepted.task.timing.type === "specific_deadline" &&
    accepted.task.timing.dueDate === "2026-09-15",
    "Accepted recommendations must support concrete user-selected dates."
  );
  assert(
    accepted.task.originCatalogKey === recommendation.catalogKey,
    "Accepted recommendation tasks must preserve origin catalog key."
  );
  assert(
    accepted.task.originRecommendationInstanceId === recommendation.id,
    "Accepted recommendation tasks must preserve origin recommendation instance."
  );
  assert(
    accepted.task.originSnapshot?.catalogKey === recommendation.catalogKey,
    "Accepted recommendation tasks must snapshot catalog metadata."
  );
  const acceptedCompletion = await fetchJson(
    `/v1/houses/${houseId}/maintenance-tasks/${accepted.task.id}/complete`,
    {
      method: "POST",
      headers: authHeaders(session, { "content-type": "application/json" }),
      body: JSON.stringify({ completedDate: "2026-07-17" })
    }
  );
  assert(acceptedCompletion.task.status === "done", "Accepted recommendation task must complete.");
  const afterAcceptedCompletionTasks = await fetchJson(
    `/v1/houses/${houseId}/maintenance-tasks`,
    { headers: authHeaders(session) }
  );
  assert(
    !afterAcceptedCompletionTasks.tasks.some((item) => item.id === accepted.task.id),
    "Completed recommendation task must leave the active plan."
  );
  const acceptedSuccessor = afterAcceptedCompletionTasks.tasks.find(
    (item) => item.originCatalogKey === recommendation.catalogKey
  );
  assert(acceptedSuccessor, "Recurring accepted recommendation must create a successor.");
  assert(
    acceptedSuccessor.originSnapshot?.catalogKey === recommendation.catalogKey,
    "Recurring successor must inherit origin snapshot."
  );
  const afterSuccessorRecommendations = await fetchJson(
    `/v1/houses/${houseId}/maintenance-recommendations`,
    { headers: authHeaders(session) }
  );
  assert(
    !afterSuccessorRecommendations.recommendations.some(
      (item) => item.catalogKey === recommendation.catalogKey
    ),
    "Active accepted successor must block parallel catalog recommendations."
  );

  const remainingRecommendations = await fetchJson(
    `/v1/houses/${houseId}/maintenance-recommendations`,
    { headers: authHeaders(session) }
  );
  const dismissTarget = remainingRecommendations.recommendations[0];
  if (dismissTarget) {
    await fetchJson(
      `/v1/houses/${houseId}/maintenance-recommendations/${dismissTarget.id}/dismiss`,
      {
        method: "POST",
        headers: authHeaders(session, { "content-type": "application/json" }),
        body: JSON.stringify({ mode: "not_now" })
      }
    );
    const afterDismiss = await fetchJson(
      `/v1/houses/${houseId}/maintenance-recommendations`,
      { headers: authHeaders(session) }
    );
    assert(
      !afterDismiss.recommendations.some((item) => item.id === dismissTarget.id),
      "Dismissed recommendation must be hidden."
    );
  }

  const hideCandidates = await fetchJson(
    `/v1/houses/${houseId}/maintenance-recommendations`,
    { headers: authHeaders(session) }
  );
  const hideTarget = hideCandidates.recommendations.find(
    (item) => item.catalogKey !== recommendation.catalogKey
  );
  if (hideTarget) {
    await fetchJson(
      `/v1/houses/${houseId}/maintenance-recommendations/${hideTarget.id}/dismiss`,
      {
        method: "POST",
        headers: authHeaders(session, { "content-type": "application/json" }),
        body: JSON.stringify({ mode: "hide_forever" })
      }
    );
    const afterHide = await fetchJson(
      `/v1/houses/${houseId}/maintenance-recommendations`,
      { headers: authHeaders(session) }
    );
    assert(
      !afterHide.recommendations.some((item) => item.catalogKey === hideTarget.catalogKey),
      "Permanently hidden catalog recommendation must not be shown again for the house."
    );
  }
  assert(initialRecommendationCount >= 6, "Smoke should exercise multiple generic catalog items.");

  const task = await fetchJson(`/v1/houses/${houseId}/maintenance-tasks`, {
    method: "POST",
    headers: authHeaders(session, { "content-type": "application/json" }),
    body: JSON.stringify({
      title: "Smoke recurring maintenance",
      description: "Snapshot must remain stable.",
      timing: { type: "specific_deadline", dueDate: "2026-10-01" },
      priceAmountMinor: 125050,
      priceCurrency: "DKK",
      recurrence: { interval: "yearly", anchor: "completed_date" },
      componentKey: "roof"
    })
  });
  assert(task.task.priceAmountMinor === 125050, "Task price must persist on create.");
  assert(task.task.priceCurrency === "DKK", "Task price currency must be DKK.");
  const noPriceTask = await fetchJson(`/v1/houses/${houseId}/maintenance-tasks`, {
    method: "POST",
    headers: authHeaders(session, { "content-type": "application/json" }),
    body: JSON.stringify({
      title: "Smoke no price maintenance",
      timing: { type: "none" }
    })
  });
  assert(noPriceTask.task.priceAmountMinor === null, "Task can be created without price.");

  const negativePrice = await fetchJsonWithStatus(`/v1/houses/${houseId}/maintenance-tasks`, {
    method: "POST",
    headers: authHeaders(session, { "content-type": "application/json" }),
    body: JSON.stringify({
      title: "Negative price",
      timing: { type: "none" },
      priceAmountMinor: -1,
      priceCurrency: "DKK"
    })
  });
  assert(negativePrice.status === 400, "Negative task price must be rejected.");

  const floatingPrice = await fetchJsonWithStatus(`/v1/houses/${houseId}/maintenance-tasks`, {
    method: "POST",
    headers: authHeaders(session, { "content-type": "application/json" }),
    body: JSON.stringify({
      title: "Floating price",
      timing: { type: "none" },
      priceAmountMinor: 12.5,
      priceCurrency: "DKK"
    })
  });
  assert(floatingPrice.status === 400, "Floating point task price must be rejected.");

  const invalidCurrency = await fetchJsonWithStatus(`/v1/houses/${houseId}/maintenance-tasks`, {
    method: "POST",
    headers: authHeaders(session, { "content-type": "application/json" }),
    body: JSON.stringify({
      title: "Invalid currency",
      timing: { type: "none" },
      priceAmountMinor: 100,
      priceCurrency: "EUR"
    })
  });
  assert(invalidCurrency.status === 400, "Invalid maintenance price currency must be rejected.");
  const loadedTask = await fetchJson(
    `/v1/houses/${houseId}/maintenance-tasks/${task.task.id}`,
    { headers: authHeaders(session) }
  );
  assert(loadedTask.task.id === task.task.id, "Task detail route must load created task.");

  const editedTitle = await fetchJson(
    `/v1/houses/${houseId}/maintenance-tasks/${task.task.id}`,
    {
      method: "PATCH",
      headers: authHeaders(session, { "content-type": "application/json" }),
      body: JSON.stringify({ title: "Smoke recurring maintenance edited" })
    }
  );
  assert(editedTitle.task.title.endsWith("edited"), "Task title must be editable.");

  const editedNote = await fetchJson(
    `/v1/houses/${houseId}/maintenance-tasks/${task.task.id}`,
    {
      method: "PATCH",
      headers: authHeaders(session, { "content-type": "application/json" }),
      body: JSON.stringify({ description: "Edited note" })
    }
  );
  assert(editedNote.task.description === "Edited note", "Task note must be editable.");

  const editedDate = await fetchJson(
    `/v1/houses/${houseId}/maintenance-tasks/${task.task.id}`,
    {
      method: "PATCH",
      headers: authHeaders(session, { "content-type": "application/json" }),
      body: JSON.stringify({ timing: { type: "specific_deadline", dueDate: "2026-12-01" } })
    }
  );
  assert(editedDate.task.timing.dueDate === "2026-12-01", "Task date must be editable.");

  const editedPrice = await fetchJson(
    `/v1/houses/${houseId}/maintenance-tasks/${task.task.id}`,
    {
      method: "PATCH",
      headers: authHeaders(session, { "content-type": "application/json" }),
      body: JSON.stringify({ priceAmountMinor: 9995, priceCurrency: "DKK" })
    }
  );
  assert(editedPrice.task.priceAmountMinor === 9995, "Task price must be editable.");

  const clearedPrice = await fetchJson(
    `/v1/houses/${houseId}/maintenance-tasks/${task.task.id}`,
    {
      method: "PATCH",
      headers: authHeaders(session, { "content-type": "application/json" }),
      body: JSON.stringify({ priceAmountMinor: null, priceCurrency: "DKK" })
    }
  );
  assert(clearedPrice.task.priceAmountMinor === null, "Task price can be cleared.");

  const restoredPrice = await fetchJson(
    `/v1/houses/${houseId}/maintenance-tasks/${task.task.id}`,
    {
      method: "PATCH",
      headers: authHeaders(session, { "content-type": "application/json" }),
      body: JSON.stringify({ priceAmountMinor: 123400, priceCurrency: "DKK" })
    }
  );
  assert(restoredPrice.task.priceAmountMinor === 123400, "Task price can be restored.");

  const clearedDate = await fetchJson(
    `/v1/houses/${houseId}/maintenance-tasks/${task.task.id}`,
    {
      method: "PATCH",
      headers: authHeaders(session, { "content-type": "application/json" }),
      body: JSON.stringify({ timing: { type: "none" } })
    }
  );
  assert(clearedDate.task.timing.type === "none", "Task date can be cleared.");

  const movedDate = await fetchJson(
    `/v1/houses/${houseId}/maintenance-tasks/${task.task.id}`,
    {
      method: "PATCH",
      headers: authHeaders(session, { "content-type": "application/json" }),
      body: JSON.stringify({ timing: { type: "specific_deadline", dueDate: "2026-12-15" } })
    }
  );
  assert(movedDate.task.timing.dueDate === "2026-12-15", "Task can be moved to a date.");

  const editedRecurrence = await fetchJson(
    `/v1/houses/${houseId}/maintenance-tasks/${task.task.id}`,
    {
      method: "PATCH",
      headers: authHeaders(session, { "content-type": "application/json" }),
      body: JSON.stringify({ recurrence: { interval: "half_yearly", anchor: "completed_date" } })
    }
  );
  assert(
    editedRecurrence.task.recurrence.interval === "half_yearly",
    "Task recurrence must be editable."
  );

  const crossOwnerUpdate = await fetchJsonWithStatus(
    `/v1/houses/${houseId}/maintenance-tasks/${task.task.id}`,
    {
      method: "PATCH",
      headers: authHeaders(otherSession, { "content-type": "application/json" }),
      body: JSON.stringify({ priceAmountMinor: 5000, priceCurrency: "DKK" })
    }
  );
  assert(crossOwnerUpdate.status === 404, "Cross-owner task price update must be rejected.");

  const deleteCandidate = await fetchJson(`/v1/houses/${houseId}/maintenance-tasks`, {
    method: "POST",
    headers: authHeaders(session, { "content-type": "application/json" }),
    body: JSON.stringify({
      title: "Smoke delete candidate",
      timing: { type: "none" }
    })
  });
  const crossOwnerDelete = await fetchJsonWithStatus(
    `/v1/houses/${houseId}/maintenance-tasks/${deleteCandidate.task.id}`,
    {
      method: "DELETE",
      headers: authHeaders(otherSession)
    }
  );
  assert(crossOwnerDelete.status === 404, "Cross-owner task delete must be rejected.");
  const deletedTask = await fetchJson(
    `/v1/houses/${houseId}/maintenance-tasks/${deleteCandidate.task.id}`,
    {
      method: "DELETE",
      headers: authHeaders(session)
    }
  );
  assert(deletedTask.task.archivedAt, "Task delete must archive active task.");

  const completed = await fetchJson(
    `/v1/houses/${houseId}/maintenance-tasks/${task.task.id}/complete`,
    {
      method: "POST",
      headers: authHeaders(session, { "content-type": "application/json" }),
      body: JSON.stringify({
        completedDate: "2026-07-17",
        note: "Completed with metadata."
      })
    }
  );
  assert(completed.task.status === "done", "Completion must mark task done.");

  await fetchJson(
    `/v1/houses/${houseId}/maintenance-tasks/${task.task.id}/complete`,
    {
      method: "POST",
      headers: authHeaders(session, { "content-type": "application/json" }),
      body: JSON.stringify({ completedDate: "2026-07-17" })
    }
  );

  const tasks = await fetchJson(`/v1/houses/${houseId}/maintenance-tasks`, {
    headers: authHeaders(session)
  });
  assert(
    !tasks.tasks.some((item) => item.id === task.task.id),
    "Completed task must leave the active query."
  );
  const recurringTaskCount = tasks.tasks.filter(
    (item) => item.title === "Smoke recurring maintenance edited" && item.status !== "done"
  ).length;
  assert(
    recurringTaskCount === 1,
    `Recurring completion retry must not create duplicate next tasks. Count: ${recurringTaskCount}`
  );
  const successorTask = tasks.tasks.find(
    (item) => item.title === "Smoke recurring maintenance edited" && item.status !== "done"
  );
  assert(
    successorTask?.timing.type === "specific_deadline" &&
      successorTask.timing.dueDate === "2027-01-17",
    "Recurring successor must keep a concrete date."
  );
  assert(
    successorTask.priceAmountMinor === 123400,
    "Recurring successor must inherit the completed task price."
  );

  const history = await fetchJson(`/v1/houses/${houseId}/maintenance-history`, {
    headers: authHeaders(session)
  });
  assert(history.history.length >= 1, "Completed task must appear in history.");
  const historyEntry = history.history.find((entry) => entry.taskId === task.task.id);
  assert(historyEntry, "History must include the completed task.");
  assert(
    historyEntry.title === "Smoke recurring maintenance edited",
    "History title snapshot must be preserved."
  );
  assert(historyEntry.priceAmountMinor === 123400, "History must snapshot task price.");
  assert(historyEntry.priceCurrency === "DKK", "History price currency must be DKK.");

  const successorPriceUpdate = await fetchJson(
    `/v1/houses/${houseId}/maintenance-tasks/${successorTask.id}`,
    {
      method: "PATCH",
      headers: authHeaders(session, { "content-type": "application/json" }),
      body: JSON.stringify({ priceAmountMinor: 9995, priceCurrency: "DKK" })
    }
  );
  assert(
    successorPriceUpdate.task.priceAmountMinor === 9995,
    "Recurring successor price can be edited later."
  );

  const historyAfterSuccessorEdit = await fetchJson(
    `/v1/houses/${houseId}/maintenance-history/${historyEntry.id}`,
    { headers: authHeaders(session) }
  );
  assert(
    historyAfterSuccessorEdit.historyEntry.priceAmountMinor === 123400,
    "Later successor price edits must not change completed history."
  );

  const yearHistory = await fetchJson(`/v1/houses/${houseId}/maintenance-history?year=2026`, {
    headers: authHeaders(session)
  });
  assert(yearHistory.history.length >= 1, "Year filter must return matching history.");

  const detail = await fetchJson(
    `/v1/houses/${houseId}/maintenance-history/${historyEntry.id}`,
    { headers: authHeaders(session) }
  );
  assert(detail.historyEntry.priceAmountMinor === 123400, "History detail must show snapshot price.");
  assert(!("attachments" in detail.historyEntry), "Maintenance history detail must not include attachments.");
}

const storageDir = await mkdtemp(join(tmpdir(), "matriva-maintenance-storage-"));
const child = startApi(storageDir);

try {
  await runSmoke();
  console.log(`Maintenance smoke passed: ${baseUrl}`);
} catch (error) {
  console.error(`Maintenance smoke failed: ${error.message}`);
  printCapturedOutput();
  process.exitCode = 1;
} finally {
  stopApi(child);
}
