import argon2 from "argon2";

import { getAdminRolesForUser, permanentSuperAdminEmail } from "../admin.ts";
import {
  ApiError,
  authLimitsDisabled,
  createSessionForUser,
  getProfileForUser,
  getUserByEmail,
  normalizeEmail,
  pool
} from "../db.ts";

const adminLoginWindowMs = 15 * 60 * 1000;
const adminLoginWindowLimit = 5;
const adminLoginErrorMessage = "E-mail eller password er forkert.";

type RateLimitEntry = {
  count: number;
  windowStartedAt: number;
};

const adminLoginRateLimits = new Map<string, RateLimitEntry>();

function adminPasswordHash() {
  return process.env.MATRIVA_ADMIN_PASSWORD_HASH?.trim();
}

function rateLimitKey(normalizedEmail: string, ipHash?: string) {
  return `${normalizedEmail}:${ipHash ?? "unknown_ip"}`;
}

function checkAdminLoginRateLimit(normalizedEmail: string, ipHash?: string) {
  if (authLimitsDisabled()) {
    return;
  }

  const key = rateLimitKey(normalizedEmail, ipHash);
  const now = Date.now();
  const existing = adminLoginRateLimits.get(key);

  if (!existing || now - existing.windowStartedAt > adminLoginWindowMs) {
    adminLoginRateLimits.set(key, { count: 1, windowStartedAt: now });
    return;
  }

  if (existing.count >= adminLoginWindowLimit) {
    throw new ApiError(
      429,
      "admin_login_rate_limited",
      "For mange loginforsøg. Prøv igen senere."
    );
  }

  existing.count += 1;
}

function assertAdminLoginConfigured() {
  const passwordHash = adminPasswordHash();

  if (!passwordHash) {
    console.error(
      JSON.stringify({
        event: "admin.auth.password_login_unavailable",
        reason: "missing_password_hash"
      })
    );
    throw new ApiError(
      503,
      "admin_login_unavailable",
      "Admin-login er midlertidigt utilgængeligt."
    );
  }

  return passwordHash;
}

async function verifyAdminPassword(passwordHash: string, password: string) {
  try {
    return await argon2.verify(passwordHash, password);
  } catch {
    console.error(
      JSON.stringify({
        event: "admin.auth.password_login_unavailable",
        reason: "invalid_password_hash"
      })
    );
    throw new ApiError(
      503,
      "admin_login_unavailable",
      "Admin-login er midlertidigt utilgængeligt."
    );
  }
}

export async function loginAdminWithPassword(input: {
  email: string;
  password: string;
  ipHash?: string;
}) {
  const normalizedEmail = normalizeEmail(input.email);
  const passwordHash = assertAdminLoginConfigured();
  checkAdminLoginRateLimit(normalizedEmail, input.ipHash);

  const [user, passwordMatches] = await Promise.all([
    getUserByEmail(normalizedEmail),
    verifyAdminPassword(passwordHash, input.password)
  ]);
  const hasConfiguredEmail = normalizedEmail === permanentSuperAdminEmail;

  if (!user || !hasConfiguredEmail || !passwordMatches) {
    throw new ApiError(401, "admin_login_invalid", adminLoginErrorMessage);
  }

  const roles = await getAdminRolesForUser(user.id);

  if (!roles.includes("SUPER_ADMIN")) {
    throw new ApiError(401, "admin_login_invalid", adminLoginErrorMessage);
  }

  await pool.query(
    `update users set email_verified_at = coalesce(email_verified_at, now()), last_login_at = now(), updated_at = now() where id = $1`,
    [user.id]
  );

  const [profile, tokens] = await Promise.all([
    getProfileForUser(user.id),
    createSessionForUser(user.id)
  ]);

  return { user, profile, tokens };
}
