import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const host = "127.0.0.1";
const port = "4101";
const baseUrl = `http://${host}:${port}`;
const startupTimeoutMs = 20_000;
const pollIntervalMs = 250;
const requestTimeoutMs = 4_000;
const outputLimit = 8_000;
const addressQuery = "Rådhuspladsen 1";
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://matriva:matriva_dev_password@127.0.0.1:56432/matriva_dev";

let capturedOutput = "";

function appendOutput(chunk) {
  capturedOutput = `${capturedOutput}${chunk.toString("utf8")}`;
  if (capturedOutput.length > outputLimit) {
    capturedOutput = capturedOutput.slice(-outputLimit);
  }
}

function redactPotentialSecrets(text) {
  const secretNames = Object.keys(process.env).filter((name) =>
    /(secret|password|token|key|credential)/i.test(name)
  );
  let redacted = text;

  for (const name of secretNames) {
    const value = process.env[name];
    if (value && value.length >= 4) {
      redacted = redacted.split(value).join("[redacted]");
    }
  }

  return redacted;
}

function printCapturedOutput() {
  const output = redactPotentialSecrets(capturedOutput.trim());
  if (output.length > 0) {
    console.error("Captured API startup output:");
    console.error(output);
  }
}

function startApi() {
  const child = spawn("npm", ["run", "dev:api"], {
    cwd: process.cwd(),
    detached: process.platform !== "win32",
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      HOST: host,
      PORT: port
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      signal: controller.signal
    });
    let body;

    try {
      body = await response.json();
    } catch (error) {
      throw new Error(`${path} returned invalid JSON: ${error.message}`);
    }

    if (!response.ok) {
      throw new Error(
        `${path} returned HTTP ${response.status}: ${JSON.stringify(body)}`
      );
    }

    return body;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJsonWithStatus(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      signal: controller.signal
    });
    let body;

    try {
      body = await response.json();
    } catch (error) {
      throw new Error(`${path} returned invalid JSON: ${error.message}`);
    }

    return {
      status: response.status,
      ok: response.ok,
      body
    };
  } finally {
    clearTimeout(timeout);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIsoDate(value, label) {
  assert(typeof value === "string", `${label} must be a string.`);
  assert(!Number.isNaN(Date.parse(value)), `${label} must be a valid date.`);
}

function assertHealth(body) {
  assert(body?.status === "ok", "/health status must be ok.");
  assert(body?.service === "matriva-api", "/health service must be matriva-api.");
  assertIsoDate(body?.timestamp, "/health timestamp");
}

function assertBootstrap(body) {
  assert(body?.skeleton === true, "/v1/bootstrap must return skeleton true.");
  assert(body?.user && typeof body.user.id === "string", "/v1/bootstrap user is missing.");
  assert(Array.isArray(body?.cards), "/v1/bootstrap cards must be an array.");
  assertIsoDate(body?.generatedAt, "/v1/bootstrap generatedAt");
}

function assertCurrentDevUser(body) {
  assert(body?.user?.id?.startsWith("usr_"), "DevUser must include a usr_ ID.");
  assert(body.user.email === "rene@joinit.dk", "DevUser email must match the dev boundary.");
  assertIsoDate(body.user.createdAt, "DevUser createdAt");
  assertIsoDate(body.user.updatedAt, "DevUser updatedAt");
}

function toSelectedAddress(suggestion) {
  assert(suggestion?.source === "DAWA", "Address suggestion must use DAWA source.");
  assert(
    typeof suggestion?.sourceAddressId === "string" &&
      suggestion.sourceAddressId.length > 0,
    "Address suggestion must include sourceAddressId."
  );
  assert(
    typeof suggestion?.label === "string" && suggestion.label.length > 0,
    "Address suggestion must include label."
  );

  return {
    source: suggestion.source,
    sourceAddressId: suggestion.sourceAddressId,
    ...(typeof suggestion.sourceAccessAddressId === "string"
      ? { sourceAccessAddressId: suggestion.sourceAccessAddressId }
      : {}),
    label: suggestion.label
  };
}

function assertAddressSearch(body) {
  assert(body?.source === "DAWA", "Address search must return DAWA source.");
  assert(Array.isArray(body?.suggestions), "Address search suggestions must be an array.");
  assert(
    body.suggestions.length > 0,
    "DAWA/address-search returned no address suggestions for the smoke query."
  );
  assertIsoDate(body?.generatedAt, "Address search generatedAt");
}

function assertHouseDraft(body, selectedAddress) {
  assert(body?.skeleton === true, "House draft response must return skeleton true.");
  assert(
    typeof body?.houseDraft?.id === "string" &&
      body.houseDraft.id.startsWith("house_draft_"),
    "House draft response must include a house_draft_ ID."
  );
  assert(body.houseDraft.status === "draft", "House draft status must be draft.");
  assert(
    body.houseDraft.selectedAddress?.sourceAddressId === selectedAddress.sourceAddressId,
    "House draft selectedAddress must match the address-search sourceAddressId."
  );
}

function assertSavedHouse(body, selectedAddress, ownerUserId) {
  assert(body?.house?.id?.startsWith("house_"), "Saved house must include a house_ ID.");
  assert(
    body.house.ownerUserId === ownerUserId,
    "Saved house must belong to the current DevUser."
  );
  assert(
    body.house.addressLabel === selectedAddress.label,
    "Saved house address label must come from the selected address."
  );
  assert(
    body.house.dawaAddressId === selectedAddress.sourceAddressId,
    "Saved house must persist the DAWA address ID."
  );
  assert(body.house.status === "saved", "Saved house status must be saved.");
  assert(
    body.house.dataConfidence === "not_verified",
    "Saved house dataConfidence must start as not_verified."
  );
  assertIsoDate(body.house.createdAt, "Saved house createdAt");
  assertIsoDate(body.house.updatedAt, "Saved house updatedAt");
}

function assertMaintenanceTask(body, houseId, expectedStatus = "planned") {
  assert(body?.task?.id?.startsWith("task_"), "Maintenance task must include a task_ ID.");
  assert(body.task.houseId === houseId, "Maintenance task must belong to the saved house.");
  assert(body.task.title === "Skift filter i ventilation", "Maintenance task title must persist.");
  assert(body.task.source === "user_created", "Maintenance task source must persist.");
  assert(body.task.status === expectedStatus, "Maintenance task status must match.");
  assert(
    body.task.timing?.type === "specific_deadline",
    "Maintenance task timing type must persist."
  );
  assert(
    typeof body.task.timing.daysUntilDue === "number",
    "Maintenance task response must derive daysUntilDue."
  );
  assert(
    body.task.timing.daysOverdue === undefined,
    "Maintenance task response must not derive daysOverdue for non-overdue tasks."
  );
  assertIsoDate(body.task.createdAt, "Maintenance task createdAt");
  assertIsoDate(body.task.updatedAt, "Maintenance task updatedAt");

  if (expectedStatus === "done") {
    assertIsoDate(body.task.completedAt, "Maintenance task completedAt");
  }
}

function assertOverviewPreview(body, houseDraftId) {
  assert(
    body?.version === "house_draft_overview_preview.v1",
    "Overview preview must use the v1 response version."
  );
  assert(
    body?.houseDraftId === houseDraftId,
    "Overview preview must echo the requested houseDraftId."
  );
  assert(body?.draftStatus === "draft", "Overview preview draftStatus must be draft.");
  assert(
    body?.dataConfidence === "not_verified",
    "Overview preview dataConfidence must be not_verified."
  );
  assert(
    body?.warningTitle === "Ikke verificerede boligdata",
    "Overview preview must preserve non-verified data warning copy."
  );
  assert(Array.isArray(body?.sections), "Overview preview sections must be an array.");

  const sectionKinds = new Set(body.sections.map((section) => section?.kind));
  for (const kind of ["overview", "documents", "maintenance", "next_actions"]) {
    assert(sectionKinds.has(kind), `Overview preview must include ${kind} section.`);
  }

  for (const section of body.sections) {
    assert(Array.isArray(section?.cards), "Overview preview section cards must be arrays.");
    assert(section.cards.length > 0, "Overview preview sections must include cards.");

    for (const card of section.cards) {
      assert(
        typeof card?.title === "string" && card.title.length > 0,
        "Overview preview cards must include title."
      );
      assert(
        typeof card?.body === "string" && card.body.length > 0,
        "Overview preview cards must include body."
      );
      if (card?.cta) {
        assert(card.cta.enabled === false, "Overview preview CTAs must be disabled.");
      }
    }
  }

  const maintenanceSection = body.sections.find(
    (section) => section?.kind === "maintenance"
  );
  assert(maintenanceSection, "Overview preview must include maintenance section.");

  const maintenanceCards = maintenanceSection.cards.filter(
    (card) => card?.maintenance
  );
  assert(
    maintenanceCards.length >= 3,
    "Overview preview maintenance section must include rich maintenance preview cards."
  );
  assert(
    maintenanceCards.some(
      (card) => card.maintenance.source === "user_created"
    ),
    "Maintenance preview must model user-created tasks."
  );
  assert(
    maintenanceCards.some(
      (card) => card.maintenance.source === "matriva_recommended"
    ),
    "Maintenance preview must model Matriva-recommended tasks."
  );
  assert(
    maintenanceCards.some(
      (card) =>
        card.maintenance.timingType === "specific_deadline" &&
        typeof card.maintenance.dueDate === "string"
    ),
    "Maintenance preview must include a specific-deadline task."
  );
  assert(
    maintenanceCards.some(
      (card) =>
        card.maintenance.timingType === "seasonal_window" &&
        typeof card.maintenance.season === "string" &&
        card.maintenance.dueDate === undefined
    ),
    "Maintenance preview must include a season-only task without dueDate."
  );
  assert(
    maintenanceCards.some(
      (card) =>
        card.maintenance.status === "overdue" &&
        typeof card.maintenance.daysOverdue === "number"
    ),
    "Maintenance preview must include overdue-style messaging."
  );

  for (const card of maintenanceCards) {
    assert(card.cta?.enabled === false, "Maintenance preview actions must be disabled.");
    assert(
      !card.isPersistedTask,
      "Maintenance preview cards must not be marked as persisted tasks."
    );

    if (card.maintenance.timingType === "seasonal_window") {
      assert(
        typeof card.maintenance.season === "string",
        "Seasonal maintenance previews must include season."
      );
      assert(
        card.maintenance.dueDate === undefined,
        "Seasonal maintenance previews must not require dueDate."
      );
    }

    if (card.maintenance.daysOverdue !== undefined) {
      assert(
        card.maintenance.status === "overdue",
        "daysOverdue must only be used for overdue maintenance previews."
      );
    }
  }

  assertIsoDate(body?.generatedAt, "Overview preview generatedAt");
}

function assertEnrichment(body) {
  const enrichment = body?.enrichment;

  assert(enrichment?.status === "skeleton", "Enrichment status must be skeleton.");
  assert(
    enrichment?.source?.verificationStatus === "not_verified",
    "Enrichment source verificationStatus must be not_verified."
  );
  assert(
    Array.isArray(enrichment?.warningDetails),
    "Enrichment warningDetails must be present."
  );
  assert(
    enrichment.warningDetails.some((warning) => warning?.code === "skeleton_not_verified"),
    "Enrichment warningDetails must include skeleton_not_verified."
  );
}

function dateOnlyDaysFromNow(daysFromNow) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
}


async function createAuthSession() {
  const email = `routes-smoke-${Date.now()}@example.test`;
  const requested = await fetchJson("/v1/auth/magic-link/request", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email })
  });
  const token = new URL(requested.devMagicLink).searchParams.get("token");
  const consumed = await fetchJson("/v1/auth/magic-link/consume", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token })
  });
  await fetchJson("/v1/me/profile", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${consumed.tokens.accessToken}`
    },
    body: JSON.stringify({ displayName: "Route Smoke", preferredLocale: "da-DK" })
  });
  return consumed;
}

function authHeaders(session, extra = {}) {
  return {
    ...extra,
    authorization: `Bearer ${session.tokens.accessToken}`
  };
}

async function waitForHealth(child) {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < startupTimeoutMs) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(
        `API dev process exited before /health passed (code ${child.exitCode}, signal ${child.signalCode}).`
      );
    }

    try {
      const health = await fetchJson("/health");
      assertHealth(health);
      return health;
    } catch (error) {
      lastError = error;
      await delay(pollIntervalMs);
    }
  }

  throw new Error(
    `Timed out waiting for ${baseUrl}/health. Last error: ${lastError?.message ?? "unknown"}`
  );
}

async function runSmoke(child) {
  await waitForHealth(child);

  const bootstrap = await fetchJson("/v1/bootstrap");
  assertBootstrap(bootstrap);

  const authSession = await createAuthSession();

  const searchParams = new URLSearchParams({ q: addressQuery });
  let addressSearch;

  try {
    addressSearch = await fetchJson(`/v1/addresses/search?${searchParams.toString()}`);
  } catch (error) {
    throw new Error(`DAWA/address-search failed through Matriva API: ${error.message}`);
  }

  assertAddressSearch(addressSearch);

  const selectedAddress = toSelectedAddress(addressSearch.suggestions[0]);
  const houseDraft = await fetchJson("/v1/house-drafts", {
    method: "POST",
    headers: authHeaders(authSession, {
      "content-type": "application/json"
    }),
    body: JSON.stringify(selectedAddress)
  });

  assertHouseDraft(houseDraft, selectedAddress);

  const savedHouse = await fetchJson("/v1/houses", {
    method: "POST",
    headers: authHeaders(authSession, {
      "content-type": "application/json"
    }),
    body: JSON.stringify({
      houseDraftId: houseDraft.houseDraft.id,
      selectedAddress
    })
  });

  assertSavedHouse(savedHouse, selectedAddress, authSession.user.id);

  const savedHouses = await fetchJson("/v1/houses", { headers: authHeaders(authSession) });
  assert(
    savedHouses.houses.some((house) => house.id === savedHouse.house.id),
    "Saved houses list must include the newly created house."
  );

  const oneSavedHouse = await fetchJson(`/v1/houses/${savedHouse.house.id}`, { headers: authHeaders(authSession) });
  assertSavedHouse(oneSavedHouse, selectedAddress, authSession.user.id);

  const notOwnedHouse = await fetchJsonWithStatus("/v1/houses/house_aaaaaaaa", { headers: authHeaders(authSession) });
  assert(
    notOwnedHouse.status === 404 && notOwnedHouse.body?.code === "house_not_found",
    "Saved house ownership boundary must reject houses outside the current user."
  );

  const maintenanceTask = await fetchJson(
    `/v1/houses/${savedHouse.house.id}/maintenance-tasks`,
    {
      method: "POST",
      headers: authHeaders(authSession, {
        "content-type": "application/json"
      }),
      body: JSON.stringify({
        title: "Skift filter i ventilation",
        description: "Brugeroprettet opgave fra persisted smoke.",
        timing: {
          type: "specific_deadline",
          dueDate: dateOnlyDaysFromNow(9)
        }
      })
    }
  );

  assertMaintenanceTask(maintenanceTask, savedHouse.house.id);

  const maintenanceTasks = await fetchJson(
    `/v1/houses/${savedHouse.house.id}/maintenance-tasks`,
    { headers: authHeaders(authSession) }
  );
  assert(
    maintenanceTasks.tasks.some((task) => task.id === maintenanceTask.task.id),
    "Maintenance task list must include the newly created task."
  );

  const doneTask = await fetchJson(
    `/v1/houses/${savedHouse.house.id}/maintenance-tasks/${maintenanceTask.task.id}/status`,
    {
      method: "PATCH",
      headers: authHeaders(authSession, {
        "content-type": "application/json"
      }),
      body: JSON.stringify({
        status: "done"
      })
    }
  );

  assertMaintenanceTask(doneTask, savedHouse.house.id, "done");

  const invalidTiming = await fetchJsonWithStatus(
    `/v1/houses/${savedHouse.house.id}/maintenance-tasks`,
    {
      method: "POST",
      headers: authHeaders(authSession, {
        "content-type": "application/json"
      }),
      body: JSON.stringify({
        title: "Invalid timing",
        timing: {
          type: "none",
          dueDate: dateOnlyDaysFromNow(1)
        }
      })
    }
  );
  assert(
    invalidTiming.status === 400 &&
      invalidTiming.body?.code === "maintenance_task_request_invalid",
    "Invalid maintenance timing must be rejected."
  );

  const overviewPreview = await fetchJson(
    `/v1/house-drafts/${houseDraft.houseDraft.id}/overview-preview`,
    { headers: authHeaders(authSession) }
  );

  assertOverviewPreview(overviewPreview, houseDraft.houseDraft.id);

  const enrichment = await fetchJson("/v1/house-drafts/enrich", {
    method: "POST",
    headers: authHeaders(authSession, {
      "content-type": "application/json"
    }),
    body: JSON.stringify({
      houseDraftId: houseDraft.houseDraft.id,
      selectedAddress
    })
  });

  assertEnrichment(enrichment);
}

const child = startApi();

try {
  await runSmoke(child);
  console.log(`API route smoke passed: ${baseUrl}`);
} catch (error) {
  console.error(`API route smoke failed: ${error.message}`);
  printCapturedOutput();
  process.exitCode = 1;
} finally {
  stopApi(child);
}
