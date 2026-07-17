import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const host = "127.0.0.1";
const port = "4103";
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

function printCapturedOutput() {
  const output = capturedOutput.trim();
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
      MATRIVA_OBJECT_STORAGE_DIR: storageDir,
      MATRIVA_STORAGE_ADAPTER: "local",
      MATRIVA_DOCUMENT_MAX_BYTES: `${1024 * 1024}`
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
  const session = await login(`storage-${Date.now()}@example.test`);
  const otherSession = await login(`storage-other-${Date.now()}@example.test`);
  const savedHouse = await createHouse(session, "Ringstedgade 130, 4700 Næstved");
  const otherHouse = await createHouse(otherSession, "Rådhuspladsen 1, 1550 København V");
  const houseId = savedHouse.house.id;

  const pngBytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    "base64"
  );
  const pdfBytes = Buffer.from("%PDF-1.4\n% smoke\n");

  const document = await fetchJson(`/v1/houses/${houseId}/documents`, {
    method: "POST",
    headers: authHeaders(session, { "content-type": "application/json" }),
    body: JSON.stringify({
      fileName: "smoke-report.pdf",
      mimeType: "application/pdf",
      sizeBytes: pdfBytes.byteLength,
      contentBase64: pdfBytes.toString("base64")
    })
  });
  assert(document.document.id.startsWith("doc_"), "Document ID must be opaque.");
  assert(document.document.contentPath, "Document must expose an authenticated content path.");

  const documents = await fetchJson(`/v1/houses/${houseId}/documents`, {
    headers: authHeaders(session)
  });
  assert(documents.documents.length >= 1, "Document list must include uploaded document.");

  const rawDocument = await fetchRawWithStatus(document.document.contentPath, {
    headers: authHeaders(session)
  });
  assert(rawDocument.status === 200, "Document content must be readable by owner.");
  assert(rawDocument.body.equals(pdfBytes), "Document content must match uploaded bytes.");

  const unauthDocument = await fetchRawWithStatus(document.document.contentPath);
  assert(unauthDocument.status === 401, "Document content must require auth.");

  const crossOwnerDocument = await fetchRawWithStatus(document.document.contentPath, {
    headers: authHeaders(otherSession)
  });
  assert(crossOwnerDocument.status === 404, "Cross-owner document download must be rejected.");

  const invalidMime = await fetchJsonWithStatus(`/v1/houses/${houseId}/documents`, {
    method: "POST",
    headers: authHeaders(session, { "content-type": "application/json" }),
    body: JSON.stringify({
      fileName: "bad.txt",
      mimeType: "text/plain",
      sizeBytes: 4,
      contentBase64: Buffer.from("test").toString("base64")
    })
  });
  assert(invalidMime.status === 400, "Invalid document MIME type must be rejected.");

  const tooLarge = await fetchJsonWithStatus(`/v1/houses/${houseId}/documents`, {
    method: "POST",
    headers: authHeaders(session, { "content-type": "application/json" }),
    body: JSON.stringify({
      fileName: "large.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024 * 1024 + 1,
      contentBase64: Buffer.concat([Buffer.from("%PDF"), Buffer.alloc(1024 * 1024)]).toString("base64")
    })
  });
  assert(tooLarge.status === 400, "Too large document must be rejected.");

  const crossOwnerUpload = await fetchJsonWithStatus(
    `/v1/houses/${otherHouse.house.id}/documents`,
    {
      method: "POST",
      headers: authHeaders(session, { "content-type": "application/json" }),
      body: JSON.stringify({
        fileName: "cross.pdf",
        mimeType: "application/pdf",
        sizeBytes: pdfBytes.byteLength,
        contentBase64: pdfBytes.toString("base64")
      })
    }
  );
  assert(crossOwnerUpload.status === 404, "Cross-owner document upload must be rejected.");

  const deleted = await fetchJson(`/v1/houses/${houseId}/documents/${document.document.id}`, {
    method: "DELETE",
    headers: authHeaders(session)
  });
  assert(deleted.document.uploadStatus === "archived", "Document delete must archive metadata.");

  const photo = await fetchJson(`/v1/houses/${houseId}/photo`, {
    method: "PUT",
    headers: authHeaders(session, { "content-type": "application/json" }),
    body: JSON.stringify({
      fileName: "house.png",
      mimeType: "image/png",
      sizeBytes: pngBytes.byteLength,
      width: 1,
      height: 1,
      contentBase64: pngBytes.toString("base64")
    })
  });
  assert(photo.photo.id.startsWith("media_"), "House photo upload must return media metadata.");

  const loadedPhoto = await fetchJson(`/v1/houses/${houseId}/photo`, {
    headers: authHeaders(session)
  });
  assert(loadedPhoto.photo.id === photo.photo.id, "House photo metadata must be readable.");

  const photoContent = await fetchRawWithStatus(`/v1/houses/${houseId}/photo/content`, {
    headers: authHeaders(session)
  });
  assert(photoContent.status === 200, "House photo content must be readable by owner.");
  assert(photoContent.body.equals(pngBytes), "House photo content must match upload.");

  const replacementPhoto = await fetchJson(`/v1/houses/${houseId}/photo`, {
    method: "PUT",
    headers: authHeaders(session, { "content-type": "application/json" }),
    body: JSON.stringify({
      fileName: "house-replacement.png",
      mimeType: "image/png",
      sizeBytes: pngBytes.byteLength,
      width: 1,
      height: 1,
      contentBase64: pngBytes.toString("base64")
    })
  });
  assert(replacementPhoto.photo.id !== photo.photo.id, "House photo replacement must create new media.");

  const crossOwnerPhoto = await fetchJsonWithStatus(`/v1/houses/${houseId}/photo`, {
    headers: authHeaders(otherSession)
  });
  assert(crossOwnerPhoto.status === 404, "Cross-owner house photo metadata must be rejected.");

  const removedPhoto = await fetchJson(`/v1/houses/${houseId}/photo`, {
    method: "DELETE",
    headers: authHeaders(session)
  });
  assert(removedPhoto.photo === null, "House photo removal must return null photo.");
}

const storageDir = await mkdtemp(join(tmpdir(), "matriva-storage-"));
const child = startApi(storageDir);

try {
  await runSmoke();
  console.log(`Storage smoke passed: ${baseUrl}`);
} catch (error) {
  console.error(`Storage smoke failed: ${error.message}`);
  printCapturedOutput();
  process.exitCode = 1;
} finally {
  stopApi(child);
}
