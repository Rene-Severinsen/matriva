import { createHash, createHmac } from "node:crypto";
import { request } from "node:https";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key, value) {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function encodeKey(key) {
  return key.split("/").map(encodeURIComponent).join("/");
}

function configFrom(environment = process.env) {
  const endpoint = environment.MATRIVA_S3_ENDPOINT?.trim();
  const bucket = environment.MATRIVA_S3_BUCKET?.trim();
  const region = environment.MATRIVA_S3_REGION?.trim() || "eu-central";
  const accessKey = environment.MATRIVA_S3_ACCESS_KEY_ID?.trim();
  const secretKey = environment.MATRIVA_S3_SECRET_ACCESS_KEY?.trim();
  if (!endpoint || !bucket || !accessKey || !secretKey) {
    throw new Error("S3 configuration is incomplete.");
  }
  return { endpoint: new URL(endpoint), bucket, region, accessKey, secretKey };
}

function signedRequest(method, key, body, contentType, environment = process.env, options = {}) {
  const config = configFrom(environment);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256(body);
  const canonicalUri = `/${encodeURIComponent(config.bucket)}/${encodeKey(key)}`;
  const headers = {
    host: config.endpoint.host,
    "content-length": String(body.length),
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    ...(method === "PUT" ? {
      "content-type": contentType,
      ...(options.cacheControl ? { "cache-control": options.cacheControl } : {})
    } : {})
  };
  const names = Object.keys(headers).sort();
  const canonicalHeaders = names.map((name) => `${name}:${headers[name].trim()}\n`).join("");
  const signedHeaders = names.join(";");
  const canonicalRequest = [method, canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonicalRequest)].join("\n");
  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${config.secretKey}`, dateStamp), config.region), "s3"),
    "aws4_request"
  );
  const signature = createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");
  return {
    hostname: config.endpoint.hostname,
    port: config.endpoint.port || 443,
    path: canonicalUri,
    method,
    headers: {
      ...headers,
      authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
    }
  };
}

function requestObject(config, body = Buffer.alloc(0)) {
  return new Promise((resolve, reject) => {
    const req = request(config, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({ status: response.statusCode ?? 0, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    if (body.length > 0) req.write(body);
    req.end();
  });
}

export async function getObject(key, contentType = "application/octet-stream", environment = process.env) {
  const response = await requestObject(signedRequest("GET", key, Buffer.alloc(0), contentType, environment));
  if (response.status === 404) {
    const error = new Error(`S3 object ${key} was not found.`);
    error.code = "ENOENT";
    error.status = 404;
    throw error;
  }
  if (response.status !== 200) {
    throw new Error(`S3 download failed for ${key} with HTTP ${response.status}.`);
  }
  return response.body;
}

export async function putObjectIfAbsent(key, content, contentType, environment = process.env, options = {}) {
  const head = await requestObject(signedRequest("HEAD", key, Buffer.alloc(0), contentType, environment, options));
  const checksum = sha256(content);

  if (head.status >= 200 && head.status < 300) {
    const existing = await requestObject(signedRequest("GET", key, Buffer.alloc(0), contentType, environment, options));
    if (existing.status !== 200 || sha256(existing.body) !== checksum) {
      throw new Error(`S3 object ${key} already exists with different content.`);
    }
    return;
  }

  const uploaded = await requestObject(signedRequest("PUT", key, content, contentType, environment, options), content);
  if (uploaded.status < 200 || uploaded.status >= 300) {
    throw new Error(`S3 upload failed for ${key} with HTTP ${uploaded.status}.`);
  }

  const verified = await requestObject(signedRequest("GET", key, Buffer.alloc(0), contentType, environment, options));
  if (verified.status !== 200 || sha256(verified.body) !== checksum) {
    throw new Error(`S3 upload verification failed for ${key}.`);
  }
}
