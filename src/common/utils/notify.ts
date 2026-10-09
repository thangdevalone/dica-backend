import { ScopeService, type ResourceScope } from "../../auth/scope.service.js";
import type { Prisma } from "../../generated/prisma/client.js";

export async function notifyPermission(
  tx: Prisma.TransactionClient,
  organizationId: string,
  permission: string,
  scope: ResourceScope,
  title: string,
  message: string,
  resourceType: string,
  resourceId: string,
  excludedUserIds: string[] = [],
) {
  const users = await tx.user.findMany({
    where: {
      organizationId,
      active: true,
      kind: "INTERNAL",
      id: { notIn: excludedUserIds },
      grants: {
        some: {
          revokedAt: null,
          role: {
            active: true,
            permissions: { some: { permissionCode: permission } },
          },
        },
      },
    },
    include: {
      grants: {
        where: { revokedAt: null, role: { active: true } },
        include: { role: { include: { permissions: true } } },
      },
    },
  });
  const access = new ScopeService();
  const recipients = users.filter((user) =>
    access.canAccess(
      {
        ...user,
        sessionId: "system",
        requestId: "system",
        grants: user.grants.map((grant) => ({
          ...grant,
          roleCode: grant.role.code,
          permissions: grant.role.permissions.map((p) => p.permissionCode),
        })),
      },
      permission,
      scope,
    ),
  );
  for (const user of recipients)
    await tx.notification.create({
      data: {
        organizationId,
        userId: user.id,
        title,
        message,
        resourceType,
        resourceId,
        ...(permission === "price_alert.read"
          ? { requiredPermission: permission }
          : {}),
        // The worker sends the initial push on its next pass.
        lastRemindedAt: new Date(0),
      },
    });
}
