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
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(selectedAddress)
  });

  assertHouseDraft(houseDraft, selectedAddress);

  const enrichment = await fetchJson("/v1/house-drafts/enrich", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
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
