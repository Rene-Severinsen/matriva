import { createVerify, X509Certificate } from "node:crypto";

import { ApiError } from "./db.ts";

export type AppleVerifiedTransaction = {
  transactionId: string;
  originalTransactionId: string | null;
  productId: string;
  bundleId: string;
  environment: "sandbox" | "production";
  purchaseDate: Date | null;
  expiresDate: Date | null;
  revocationDate: Date | null;
  rawPayload: Record<string, unknown>;
};

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url");
}

function decodeJsonSegment(value: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(decodeBase64Url(value).toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not-object");
    return parsed as Record<string, unknown>;
  } catch {
    throw new ApiError(400, "apple_signed_payload_invalid", "Apple-payloaden kunne ikke læses.");
  }
}

function rawEcdsaSignatureToDer(signature: Buffer) {
  if (signature.length !== 64) throw new ApiError(400, "apple_signed_payload_invalid", "Apple-signaturen har ugyldig længde.");
  const integer = (part: Buffer) => {
    const trimmed = part.subarray(part.findIndex((byte) => byte !== 0));
    const normalized = trimmed.length === 0 ? Buffer.from([0]) : trimmed[0]! & 0x80 ? Buffer.concat([Buffer.from([0]), trimmed]) : trimmed;
    return Buffer.concat([Buffer.from([0x02, normalized.length]), normalized]);
  };
  const body = Buffer.concat([integer(signature.subarray(0, 32)), integer(signature.subarray(32))]);
  return Buffer.concat([Buffer.from([0x30, body.length]), body]);
}

function verifyCertificateChain(certificates: X509Certificate[]) {
  if (certificates.length === 0) throw new ApiError(400, "apple_signed_payload_invalid", "Apple-payloaden mangler certifikatkæde.");
  for (let index = 0; index < certificates.length - 1; index += 1) {
    if (!certificates[index]!.verify(certificates[index + 1]!.publicKey)) {
      throw new ApiError(400, "apple_signed_payload_invalid", "Apple-certifikatkæden kunne ikke verificeres.");
    }
  }
  const expectedRoot = process.env.MATRIVA_APPLE_ROOT_CERT_SHA256?.replaceAll(":", "").toUpperCase();
  if (!expectedRoot) throw new ApiError(503, "apple_verification_not_configured", "Apple-verifikation er ikke konfigureret på backend.");
  if (certificates.at(-1)!.fingerprint256.replaceAll(":", "").toUpperCase() !== expectedRoot) {
    throw new ApiError(400, "apple_signed_payload_invalid", "Apple-certifikatet er ikke en godkendt Apple-root.");
  }
}

export function verifyAppleJws(compactJws: string): Record<string, unknown> {
  const parts = compactJws.split(".");
  if (parts.length !== 3) throw new ApiError(400, "apple_signed_payload_invalid", "Apple-payloaden er ikke en gyldig JWS.");
  const header = decodeJsonSegment(parts[0]!);
  const payload = decodeJsonSegment(parts[1]!);
  const x5c = header.x5c;
  if (!Array.isArray(x5c) || x5c.some((value) => typeof value !== "string")) {
    throw new ApiError(400, "apple_signed_payload_invalid", "Apple-payloaden mangler x5c-certifikater.");
  }
  const certificates = x5c.map((value) => new X509Certificate(Buffer.from(value, "base64")));
  verifyCertificateChain(certificates);
  const verifier = createVerify("SHA256");
  verifier.update(`${parts[0]}.${parts[1]}`);
  verifier.end();
  if (!verifier.verify(certificates[0]!.publicKey, rawEcdsaSignatureToDer(decodeBase64Url(parts[2]!)))) {
    throw new ApiError(400, "apple_signed_payload_invalid", "Apple-signaturen kunne ikke verificeres.");
  }
  return payload;
}

function dateFromMilliseconds(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value) : null;
}

export function verifiedAppleTransactionFromJws(signedTransactionInfo: string): AppleVerifiedTransaction {
  const payload = verifyAppleJws(signedTransactionInfo);
  const stringValue = (key: string) => typeof payload[key] === "string" ? payload[key] as string : null;
  const transactionId = stringValue("transactionId");
  const productId = stringValue("productId");
  const bundleId = stringValue("bundleId");
  const environment = stringValue("environment");
  if (!transactionId || !productId || !bundleId || (environment !== "Sandbox" && environment !== "Production")) {
    throw new ApiError(400, "apple_signed_payload_invalid", "Apple-transaktionen mangler påkrævede felter.");
  }
  const expectedBundleId = process.env.MATRIVA_APPLE_BUNDLE_ID ?? "dk.matriva.app";
  const expectedProductId = process.env.MATRIVA_APPLE_PRO_PRODUCT_ID ?? "matriva.pro.monthly";
  if (bundleId !== expectedBundleId || productId !== expectedProductId) {
    throw new ApiError(400, "apple_product_not_allowed", "Apple-produktet er ikke konfigureret til Matriva.");
  }
  return {
    transactionId,
    originalTransactionId: stringValue("originalTransactionId"),
    productId,
    bundleId,
    environment: environment === "Sandbox" ? "sandbox" : "production",
    purchaseDate: dateFromMilliseconds(payload.purchaseDate),
    expiresDate: dateFromMilliseconds(payload.expiresDate),
    revocationDate: dateFromMilliseconds(payload.revocationDate),
    rawPayload: payload
  };
}

export function appleSubscriptionStatus(transaction: AppleVerifiedTransaction) {
  if (transaction.revocationDate) return "refunded_revoked" as const;
  if (transaction.expiresDate && transaction.expiresDate <= new Date()) return "expired" as const;
  return "active" as const;
}
