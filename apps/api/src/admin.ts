import {
  adminBootstrapResponseSchema,
  type AdminBootstrapResponse,
  type AdminRole
} from "@matriva/shared";

import {
  ApiError,
  authenticateAccessToken,
  getProfileForUser,
  getUserById,
  normalizeEmail,
  pool
} from "./db.ts";

export const permanentSuperAdminEmail = normalizeEmail("rene@joinit.dk");
const superAdminProvisioner = "permanent_super_admin_email";

type AdminRoleRow = {
  role: AdminRole;
};

export type AdminPrincipal = {
  userId: string;
  email: string;
  displayName: string | null;
  roles: AdminRole[];
};

export async function ensurePermanentSuperAdminRoleForUser(
  userId: string,
  email: string
) {
  if (normalizeEmail(email) !== permanentSuperAdminEmail) {
    return;
  }

  await pool.query(
    `
      insert into user_roles (user_id, role, provisioned_by)
      values ($1, 'SUPER_ADMIN', $2)
      on conflict (user_id, role) do nothing
    `,
    [userId, superAdminProvisioner]
  );
}

async function getAdminRolesForUser(userId: string) {
  const result = await pool.query<AdminRoleRow>(
    `
      select role
      from user_roles
      where user_id = $1
      order by role
    `,
    [userId]
  );

  return result.rows.map((row) => row.role);
}

export async function requireAdminUser(accessToken: string | undefined) {
  const userId = await authenticateAccessToken(accessToken);
  const [user, profile] = await Promise.all([
    getUserById(userId),
    getProfileForUser(userId)
  ]);

  await ensurePermanentSuperAdminRoleForUser(user.id, user.email);
  const roles = await getAdminRolesForUser(user.id);

  if (!roles.includes("SUPER_ADMIN")) {
    throw new ApiError(
      403,
      "admin_forbidden",
      "Admin access requires SUPER_ADMIN."
    );
  }

  return {
    userId: user.id,
    email: user.email,
    displayName: profile.displayName,
    roles
  } satisfies AdminPrincipal;
}

export function toAdminBootstrapResponse(
  principal: AdminPrincipal
): AdminBootstrapResponse {
  return adminBootstrapResponseSchema.parse({
    admin: {
      userId: principal.userId,
      email: principal.email,
      displayName: principal.displayName,
      roles: principal.roles
    },
    generatedAt: new Date().toISOString()
  });
}
