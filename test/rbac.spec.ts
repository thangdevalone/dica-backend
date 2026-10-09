import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import type { ExecutionContext } from "@nestjs/common";
import {
  SYSTEM_PERMISSIONS,
  SYSTEM_ROLE_PERMISSIONS,
} from "../src/auth/access-control.catalog.js";
import type { AuthUser } from "../src/auth/auth.types.js";
import { Authenticated } from "../src/auth/decorators/authenticated.decorator.js";
import { RequirePermissions } from "../src/auth/decorators/permissions.decorator.js";
import { Public } from "../src/auth/decorators/public.decorator.js";
import { PermissionGuard } from "../src/auth/guards/permission.guard.js";
import { ScopeService } from "../src/auth/scope.service.js";
import { PrismaService } from "../src/database/prisma.service.js";
import { UserService } from "../src/users/user.service.js";

const forbidden = (error: unknown) =>
  Boolean(
    error &&
    typeof error === "object" &&
    "getStatus" in error &&
    (error as { getStatus(): number }).getStatus() === 403,
  );

test("guard denies missing policy and explicitly allows public/self endpoints", () => {
  class Routes {
    missing() {}
    public() {}
    self() {}
    permitted() {}
  }
  for (const [name, decorator] of [
    ["public", Public()],
    ["self", Authenticated()],
    ["permitted", RequirePermissions("user.read")],
  ] as const) {
    decorator(
      Routes.prototype,
      name,
      Object.getOwnPropertyDescriptor(Routes.prototype, name)!,
    );
  }
  const guard = new PermissionGuard(new Reflector());
  const context = (name: keyof Routes, user?: Partial<AuthUser>) =>
    ({
      getHandler: () => Routes.prototype[name],
      getClass: () => Routes,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;
  assert.throws(
    () => guard.canActivate(context("missing", { grants: [] })),
    forbidden,
  );
  assert.equal(guard.canActivate(context("public")), true);
  assert.throws(() => guard.canActivate(context("self")), forbidden);
  assert.equal(guard.canActivate(context("self", { grants: [] })), true);
  assert.throws(
    () => guard.canActivate(context("permitted", { grants: [] })),
    forbidden,
  );
});

test(
  "RBAC security boundaries and concurrent admin removals on PostgreSQL",
  { skip: !process.env.TEST_DATABASE_URL },
  async (t) => {
    const db = new PrismaService(
      new ConfigService({ DATABASE_URL: process.env.TEST_DATABASE_URL }),
    );
    await db.$connect();
    const org = await db.organization.create({
      data: { code: `RBAC-${randomUUID()}`, name: "RBAC regression" },
    });
    t.after(async () => {
      try {
        await db.auditEvent.deleteMany({ where: { organizationId: org.id } });
        await db.roleGrant.deleteMany({
          where: { user: { organizationId: org.id } },
        });
        await db.rolePermission.deleteMany({
          where: { role: { organizationId: org.id } },
        });
        await db.user.deleteMany({ where: { organizationId: org.id } });
        await db.role.deleteMany({ where: { organizationId: org.id } });
        await db.facility.deleteMany({ where: { organizationId: org.id } });
        await db.organization.delete({ where: { id: org.id } });
      } finally {
        await db.$disconnect();
      }
    });
    await db.permission.createMany({
      data: SYSTEM_PERMISSIONS.map((code) => ({ code, description: code })),
      skipDuplicates: true,
    });
    const role = async (code: string, permissions: readonly string[]) =>
      db.role.create({
        data: {
          organizationId: org.id,
          code,
          name: code,
          system: code === "ADMIN_OWNER",
          permissions: {
            create: permissions.map((permissionCode) => ({ permissionCode })),
          },
        },
      });
    const ownerRole = await role(
      "ADMIN_OWNER",
      SYSTEM_ROLE_PERMISSIONS.ADMIN_OWNER!,
    );
    const managerRole = await role(
      "GENERAL_MANAGER",
      SYSTEM_ROLE_PERMISSIONS.GENERAL_MANAGER!,
    );
    const delegateRole = await role("DELEGATE", [
      "grant.assign",
      "grant.revoke",
      "user.create",
      "user.reset_password",
      "user.deactivate",
      "role.manage",
      "request.read",
    ]);
    const staffRole = await role("STAFF", ["request.read"]);
    const elevatedRole = await role("ELEVATED", ["system.purge"]);
    const create = async (name: string, roleId: string) => {
      const user = await db.user.create({
        data: {
          organizationId: org.id,
          username: name,
          displayName: name,
          passwordHash: "not-a-login",
          grants: { create: { roleId, scopeType: "ORGANIZATION" } },
        },
      });
      const grants = await db.roleGrant.findMany({
        where: { userId: user.id, revokedAt: null },
        include: { role: { include: { permissions: true } } },
      });
      return {
        ...user,
        sessionId: randomUUID(),
        requestId: randomUUID(),
        grants: grants.map((g) => ({
          ...g,
          roleCode: g.role.code,
          permissions: g.role.permissions.map((p) => p.permissionCode),
        })),
      } satisfies AuthUser;
    };
    const owner = await create("owner", ownerRole.id);
    const manager = await create("manager", managerRole.id);
    const delegate = await create("delegate", delegateRole.id);
    const staff = await create("staff", staffRole.id);
    const service = new UserService(db, new ScopeService());

    await t.test(
      "manager cannot reset, deactivate, activate or modify an admin",
      async () => {
        await assert.rejects(
          service.resetPassword(manager, owner.id, {
            password: "DisposablePassword#2026",
          }),
          forbidden,
        );
        await assert.rejects(service.deactivate(manager, owner.id), forbidden);
        await assert.rejects(service.activate(manager, owner.id), forbidden);
        await assert.rejects(
          service.update(manager, owner.id, { display_name: "Changed" }),
          forbidden,
        );
        assert.equal(
          (await db.user.findUniqueOrThrow({ where: { id: owner.id } }))
            .passwordHash,
          "not-a-login",
        );
      },
    );
    await t.test(
      "delegated granter cannot self-assign ADMIN or create elevated users",
      async () => {
        for (const roleId of [ownerRole.id, elevatedRole.id]) {
          await assert.rejects(
            service.assign(delegate, {
              user_id: delegate.id,
              role_id: roleId,
              scope_type: "ORGANIZATION",
            }),
            forbidden,
          );
          await assert.rejects(
            service.create(delegate, {
              username: `blocked-${roleId}`,
              password: "DisposablePassword#2026",
              kind: "INTERNAL",
              role_id: roleId,
              scope_type: "ORGANIZATION",
            }),
            forbidden,
          );
        }
        await assert.rejects(
          service.assign(delegate, {
            user_id: owner.id,
            role_id: staffRole.id,
            scope_type: "ORGANIZATION",
          }),
          forbidden,
        );
        await assert.rejects(
          service.revoke(delegate, owner.grants[0]!.id),
          forbidden,
        );
      },
    );
    await t.test(
      "scoped permissions cannot be promoted to organization grants or roles",
      async () => {
        const facility = await db.facility.create({
          data: {
            organizationId: org.id,
            code: "A",
            name: "A",
            type: "BRANCH",
          },
        });
        const scoped = {
          ...delegate,
          grants: [
            ...delegate.grants.map((g) => ({
              ...g,
              permissions: g.permissions.filter((p) => p !== "request.read"),
            })),
            {
              ...delegate.grants[0]!,
              id: randomUUID(),
              scopeType: "FACILITY" as const,
              facilityId: facility.id,
              permissions: ["request.read"],
            },
          ],
        };
        await assert.rejects(
          service.assign(scoped, {
            user_id: staff.id,
            role_id: staffRole.id,
            scope_type: "ORGANIZATION",
          }),
          forbidden,
        );
        await assert.rejects(
          service.createRole(scoped, {
            code: "PROMOTED",
            name: "Promoted",
            permission_codes: ["request.read"],
          }),
        );
        await assert.rejects(
          service.updateRole(delegate, ownerRole.id, {
            permission_codes: ["request.read"],
          }),
          forbidden,
        );
        await assert.rejects(
          service.createRole(delegate, {
            code: "ADMIN_OWNER",
            name: "Fake admin",
            permission_codes: ["request.read"],
          }),
        );
      },
    );
    await t.test(
      "authorized delegation and ordinary password reset still work",
      async () => {
        const assigned = await service.assign(delegate, {
          user_id: staff.id,
          role_id: staffRole.id,
          scope_type: "FACILITY",
          facility_id: (
            await db.facility.findFirstOrThrow({
              where: { organizationId: org.id },
            })
          ).id,
        });
        assert.equal(assigned.data.roleId, staffRole.id);
        await service.resetPassword(manager, staff.id, {
          password: "DisposablePassword#2026",
        });
        assert.notEqual(
          (await db.user.findUniqueOrThrow({ where: { id: staff.id } }))
            .passwordHash,
          "not-a-login",
        );
        await assert.rejects(
          service.assign(owner, {
            user_id: staff.id,
            role_id: ownerRole.id,
            scope_type: "OWN",
          }),
        );
      },
    );
    await t.test("the final ADMIN grant cannot be revoked", async () => {
      await assert.rejects(service.revoke(owner, owner.grants[0]!.id));
      assert.equal(
        (
          await db.roleGrant.findUniqueOrThrow({
            where: { id: owner.grants[0]!.id },
          })
        ).revokedAt,
        null,
      );
    });
    await t.test("concurrent removals retain one active ADMIN", async () => {
      const second = await create("second-owner", ownerRole.id);
      const results = await Promise.allSettled([
        service.revoke(owner, owner.grants[0]!.id),
        service.deactivate(owner, second.id),
      ]);
      assert.equal(
        results.filter((result) => result.status === "fulfilled").length,
        1,
      );
      assert.equal(
        results.filter((result) => result.status === "rejected").length,
        1,
      );
      const remaining = await db.user.count({
        where: {
          organizationId: org.id,
          active: true,
          grants: {
            some: {
              revokedAt: null,
              scopeType: "ORGANIZATION",
              role: { code: "ADMIN_OWNER", active: true },
            },
          },
        },
      });
      assert.equal(remaining, 1);
    });
  },
);
