import { PrismaPg } from "@prisma/adapter-pg";
import * as argon2 from "argon2";
import { pathToFileURL } from "node:url";
import {
  ACCESS_CONTROL_VERSION,
  SYSTEM_PERMISSIONS,
  SYSTEM_ROLE_NAMES,
  SYSTEM_ROLE_PERMISSIONS,
} from "../auth/access-control.catalog.js";
import {
  PrismaClient,
  ScopeType,
  UserKind,
} from "../generated/prisma/client.js";

interface BootstrapEnvironment {
  databaseUrl: string;
  organizationCode: string;
  organizationName: string;
  adminUsername: string;
  adminDisplayName: string;
  adminPassword?: string;
}

export async function bootstrapProduction(
  db: PrismaClient,
  environment: BootstrapEnvironment,
) {
  const stateKey = `access-control:${environment.organizationCode}`;
  const state = await db.bootstrapState.findUnique({
    where: { key: stateKey },
  });
  if (state && state.version >= ACCESS_CONTROL_VERSION) {
    return { applied: false, version: state.version };
  }

  const existingOrganization = await db.organization.findUnique({
    where: { code: environment.organizationCode },
    select: { id: true },
  });
  let existingAdmin: { id: string } | null = null;
  if (existingOrganization) {
    existingAdmin = state?.adminUserId
      ? await db.user.findFirst({
          where: {
            id: state.adminUserId,
            organizationId: existingOrganization.id,
          },
          select: { id: true },
        })
      : await db.user.findFirst({
          where: {
            organizationId: existingOrganization.id,
            grants: {
              some: {
                role: { code: "ADMIN_OWNER" },
                scopeType: ScopeType.ORGANIZATION,
                revokedAt: null,
              },
            },
          },
          select: { id: true },
          orderBy: { createdAt: "asc" },
        });
    existingAdmin ??= await db.user.findUnique({
      where: {
        organizationId_username: {
          organizationId: existingOrganization.id,
          username: environment.adminUsername,
        },
      },
      select: { id: true },
    });
  }
  if (!existingAdmin && !environment.adminPassword)
    throw new Error(
      "Lần bootstrap đầu tiên bắt buộc có BOOTSTRAP_ADMIN_PASSWORD tối thiểu 12 ký tự.",
    );
  const passwordHash = environment.adminPassword
    ? await argon2.hash(environment.adminPassword)
    : null;

  await db.$transaction(
    async (tx) => {
      const organization = await tx.organization.upsert({
        where: { code: environment.organizationCode },
        update: {},
        create: {
          code: environment.organizationCode,
          name: environment.organizationName,
        },
      });
      for (const code of SYSTEM_PERMISSIONS) {
        await tx.permission.upsert({
          where: { code },
          update: {},
          create: { code, description: code },
        });
      }

      const roleIds: Record<string, string> = {};
      const existingSystemRoles = await tx.role.findMany({
        where: {
          organizationId: organization.id,
          code: { in: Object.keys(SYSTEM_ROLE_PERMISSIONS) },
        },
        select: { code: true },
      });
      const existingSystemRoleCodes = new Set(
        existingSystemRoles.map((role) => role.code),
      );
      for (const [code, permissionCodes] of Object.entries(
        SYSTEM_ROLE_PERMISSIONS,
      )) {
        const role = await tx.role.upsert({
          where: {
            organizationId_code: { organizationId: organization.id, code },
          },
          update: {
            name: SYSTEM_ROLE_NAMES[code] ?? code,
            system: true,
            active: true,
          },
          create: {
            organizationId: organization.id,
            code,
            name: SYSTEM_ROLE_NAMES[code] ?? code,
            system: true,
            active: true,
          },
        });
        roleIds[code] = role.id;
        if (!existingSystemRoleCodes.has(code)) {
          await tx.rolePermission.createMany({
            data: permissionCodes.map((permissionCode) => ({
              roleId: role.id,
              permissionCode,
            })),
            skipDuplicates: true,
          });
        }
      }

      const admin = existingAdmin
        ? existingAdmin
        : await tx.user.create({
            data: {
              organizationId: organization.id,
              kind: UserKind.INTERNAL,
              username: environment.adminUsername,
              displayName: environment.adminDisplayName,
              passwordHash: passwordHash!,
            },
            select: { id: true },
          });
      const adminRoleId = roleIds["ADMIN_OWNER"];
      if (!adminRoleId) throw new Error("Thiếu role hệ thống ADMIN_OWNER.");
      const currentGrant = await tx.roleGrant.findFirst({
        where: {
          userId: admin.id,
          roleId: adminRoleId,
          scopeType: ScopeType.ORGANIZATION,
          revokedAt: null,
        },
      });
      if (!currentGrant)
        await tx.roleGrant.create({
          data: {
            userId: admin.id,
            roleId: adminRoleId,
            scopeType: ScopeType.ORGANIZATION,
          },
        });
      await tx.bootstrapState.upsert({
        where: { key: stateKey },
        update: {
          version: ACCESS_CONTROL_VERSION,
          adminUserId: admin.id,
        },
        create: {
          key: stateKey,
          version: ACCESS_CONTROL_VERSION,
          adminUserId: admin.id,
        },
      });
    },
    { maxWait: 10_000, timeout: 60_000 },
  );
  return { applied: true, version: ACCESS_CONTROL_VERSION };
}

function loadEnvironment(): BootstrapEnvironment {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) throw new Error("Thiếu DATABASE_URL.");
  const organizationCode = (
    process.env["BOOTSTRAP_ORGANIZATION_CODE"] ?? "DICA"
  )
    .trim()
    .toUpperCase();
  const organizationName = (
    process.env["BOOTSTRAP_ORGANIZATION_NAME"] ?? "DICA"
  ).trim();
  const adminUsername = (process.env["BOOTSTRAP_ADMIN_USERNAME"] ?? "admin")
    .trim()
    .toLowerCase();
  const adminDisplayName = (
    process.env["BOOTSTRAP_ADMIN_DISPLAY_NAME"] ?? "Quản trị DICA"
  ).trim();
  const adminPassword = process.env["BOOTSTRAP_ADMIN_PASSWORD"]?.trim();
  if (!/^[A-Z0-9_-]{2,50}$/.test(organizationCode))
    throw new Error("BOOTSTRAP_ORGANIZATION_CODE không hợp lệ.");
  if (!organizationName || organizationName.length > 200)
    throw new Error("BOOTSTRAP_ORGANIZATION_NAME không hợp lệ.");
  if (!/^[a-zA-Z0-9._-]{3,100}$/.test(adminUsername))
    throw new Error("BOOTSTRAP_ADMIN_USERNAME không hợp lệ.");
  if (!adminDisplayName || adminDisplayName.length > 200)
    throw new Error("BOOTSTRAP_ADMIN_DISPLAY_NAME không hợp lệ.");
  if (
    adminPassword &&
    (adminPassword.length < 12 ||
      adminPassword.length > 200 ||
      adminPassword.includes("replace"))
  )
    throw new Error(
      "BOOTSTRAP_ADMIN_PASSWORD phải có 12-200 ký tự và không được là placeholder.",
    );
  return {
    databaseUrl,
    organizationCode,
    organizationName,
    adminUsername,
    adminDisplayName,
    ...(adminPassword ? { adminPassword } : {}),
  };
}

async function main() {
  const environment = loadEnvironment();
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: environment.databaseUrl }),
  });
  try {
    const result = await bootstrapProduction(db, environment);
    console.log(
      result.applied
        ? `Bootstrap production v${result.version} hoàn tất.`
        : `Bootstrap production v${result.version} đã được áp dụng, bỏ qua.`,
    );
  } finally {
    await db.$disconnect();
  }
}

const isMain = Boolean(
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href,
);
if (isMain)
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
