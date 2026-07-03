import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const host = "127.0.0.1";
const port = "4100";
const baseUrl = `http://${host}:${port}`;
const healthUrl = `${baseUrl}/health`;
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://matriva:matriva_dev_password@127.0.0.1:56432/matriva_dev";
const startupTimeoutMs = 20_000;
const pollIntervalMs = 250;
const requestTimeoutMs = 1_000;
const outputLimit = 8_000;

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

async function readHealth() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(healthUrl, { signal: controller.signal });

    if (response.status !== 200) {
      throw new Error(`Expected HTTP 200 from /health, got ${response.status}.`);
    }

    const body = await response.json();

    if (
      body?.status !== "ok" ||
      body?.service !== "matriva-api" ||
      typeof body?.timestamp !== "string" ||
      Number.isNaN(Date.parse(body.timestamp))
    ) {
      throw new Error("Health response did not match the expected JSON shape.");
    }

    return body;
  } finally {
    clearTimeout(timeout);
  }
}

async function readCurrentDevUser() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(`${baseUrl}/v1/dev-user`, {
      signal: controller.signal
    });

    if (response.status !== 200) {
      throw new Error(
        `Expected HTTP 200 from /v1/dev-user, got ${response.status}.`
      );
    }

    const body = await response.json();

    if (
      !body?.user?.id?.startsWith("usr_") ||
      body.user.email !== "rene@joinit.dk" ||
      Number.isNaN(Date.parse(body.user.createdAt)) ||
      Number.isNaN(Date.parse(body.user.updatedAt))
    ) {
      throw new Error("DevUser response did not match the expected JSON shape.");
    }

    return body;
  } finally {
    clearTimeout(timeout);
  }
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
      return await readHealth();
    } catch (error) {
      lastError = error;
      await delay(pollIntervalMs);
    }
  }

  throw new Error(
    `Timed out waiting for ${healthUrl}. Last error: ${lastError?.message ?? "unknown"}`
  );
}

const child = startApi();

try {
  await waitForHealth(child);
  await readCurrentDevUser();
  console.log(`API dev smoke passed: GET ${healthUrl}, GET ${baseUrl}/v1/dev-user`);
} catch (error) {
  console.error(`API dev smoke failed: ${error.message}`);
  printCapturedOutput();
  process.exitCode = 1;
} finally {
  stopApi(child);
}
