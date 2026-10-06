import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createSign } from "node:crypto";
import type { AuthUser } from "../auth/auth.types.js";
import { PrismaService } from "../database/prisma.service.js";
import type { Notification } from "../generated/prisma/client.js";
import type {
  RegisterPushDeviceDto,
  UnregisterPushDeviceDto,
} from "./push.dto.js";

interface OAuthToken {
  value: string;
  expiresAt: number;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private oauth?: OAuthToken;

  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async devices(user: AuthUser) {
    const data = await this.db.pushDevice.findMany({
      where: {
        organizationId: user.organizationId,
        userId: user.id,
        active: true,
      },
      select: {
        id: true,
        platform: true,
        deviceId: true,
        appVersion: true,
        lastSeenAt: true,
        createdAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });
    return { data, message: "Lấy danh sách thiết bị nhận push thành công." };
  }

  async register(user: AuthUser, dto: RegisterPushDeviceDto) {
    const data = await this.db.pushDevice.upsert({
      where: { token: dto.token.trim() },
      create: {
        organizationId: user.organizationId,
        userId: user.id,
        token: dto.token.trim(),
        platform: dto.platform ?? "ANDROID",
        ...(dto.device_id ? { deviceId: dto.device_id } : {}),
        ...(dto.app_version ? { appVersion: dto.app_version } : {}),
      },
      update: {
        organizationId: user.organizationId,
        userId: user.id,
        platform: dto.platform ?? "ANDROID",
        deviceId: dto.device_id ?? null,
        appVersion: dto.app_version ?? null,
        active: true,
        lastSeenAt: new Date(),
      },
      select: {
        id: true,
        platform: true,
        deviceId: true,
        appVersion: true,
        lastSeenAt: true,
        createdAt: true,
      },
    });
    return { data, message: "Đăng ký thiết bị nhận push thành công." };
  }

  async unregister(user: AuthUser, dto: UnregisterPushDeviceDto) {
    const result = await this.db.pushDevice.updateMany({
      where: {
        organizationId: user.organizationId,
        userId: user.id,
        token: dto.token.trim(),
        active: true,
      },
      data: { active: false, lastSeenAt: new Date() },
    });
    return {
      data: { updated: result.count },
      message: "Đã ngừng gửi push tới thiết bị.",
    };
  }

  async sendNotifications(notifications: Notification[]): Promise<void> {
    if (
      !this.config.get<boolean>("FCM_ENABLED", false) ||
      !notifications.length
    )
      return;
    const devices = await this.db.pushDevice.findMany({
      where: {
        userId: { in: [...new Set(notifications.map((item) => item.userId))] },
        active: true,
        platform: { in: ["ANDROID", "IOS"] },
        user: { active: true },
      },
      select: { id: true, userId: true, token: true, platform: true },
    });
    if (!devices.length) return;
    const byUser = new Map<string, Notification[]>();
    for (const notification of notifications) {
      const items = byUser.get(notification.userId) ?? [];
      items.push(notification);
      byUser.set(notification.userId, items);
    }
    let sent = 0;
    let failed = 0;
    for (const device of devices) {
      for (const notification of byUser.get(device.userId) ?? []) {
        try {
          const invalid = await this.send(
            device.token,
            device.platform,
            notification,
          );
          if (invalid)
            await this.db.pushDevice.update({
              where: { id: device.id },
              data: { active: false },
            });
          else sent += 1;
        } catch (error) {
          failed += 1;
          this.logger.warn(
            `FCM push failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }
    this.logger.log(`FCM push completed: sent=${sent}, failed=${failed}.`);
  }

  private async send(
    token: string,
    platform: string,
    notification: Notification,
  ) {
    const projectId = this.config.getOrThrow<string>("FCM_PROJECT_ID");
    const accessToken = await this.accessToken();
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token,
            notification: {
              title: notification.title,
              body: notification.message,
            },
            data: {
              notification_id: notification.id,
              resource_type: notification.resourceType,
              resource_id: notification.resourceId,
              route: this.route(notification),
            },
            ...(platform === "IOS"
              ? {
                  apns: {
                    headers: {
                      "apns-priority": "10",
                      "apns-push-type": "alert",
                    },
                    payload: {
                      aps: {
                        sound: "default",
                        "content-available": 1,
                      },
                    },
                  },
                }
              : {
                  android: {
                    priority: "high",
                    notification: {
                      channel_id: this.config.get(
                        "FCM_ANDROID_CHANNEL_ID",
                        "dica_operations",
                      ),
                      sound: "default",
                    },
                  },
                }),
          },
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (response.ok) return false;
    const body = await response.text();
    if (
      body.includes("UNREGISTERED") ||
      body.includes("registration-token-not-registered")
    )
      return true;
    throw new Error(`HTTP ${response.status}: ${body.slice(0, 500)}`);
  }

  private route(notification: Notification) {
    const routes: Record<string, string> = {
      SupplyRequest: `/requests/${notification.resourceId}`,
      FulfillmentOrder: `/orders/${notification.resourceId}`,
      Transfer: `/transfers/${notification.resourceId}`,
      DamageReport: `/damage-reports/${notification.resourceId}`,
      DiscrepancyCase: `/discrepancies/${notification.resourceId}`,
      Stocktake: `/stocktakes/${notification.resourceId}`,
    };
    return routes[notification.resourceType] ?? "/notifications";
  }

  private async accessToken() {
    if (this.oauth && this.oauth.expiresAt > Date.now() + 60_000)
      return this.oauth.value;
    const email = this.config.getOrThrow<string>("FCM_CLIENT_EMAIL");
    const privateKey = this.config
      .getOrThrow<string>("FCM_PRIVATE_KEY")
      .replace(/\\n/g, "\n");
    const now = Math.floor(Date.now() / 1_000);
    const encodedHeader = this.base64Url({ alg: "RS256", typ: "JWT" });
    const encodedPayload = this.base64Url({
      iss: email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3_600,
    });
    const unsigned = `${encodedHeader}.${encodedPayload}`;
    const signer = createSign("RSA-SHA256");
    signer.update(unsigned);
    signer.end();
    const assertion = `${unsigned}.${signer.sign(privateKey).toString("base64url")}`;
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      error_description?: string;
    };
    if (!response.ok || !body.access_token)
      throw new Error(
        body.error_description ?? `OAuth HTTP ${response.status}`,
      );
    this.oauth = {
      value: body.access_token,
      expiresAt: Date.now() + (body.expires_in ?? 3_600) * 1_000,
    };
    return this.oauth.value;
  }

  private base64Url(value: unknown) {
    return Buffer.from(JSON.stringify(value)).toString("base64url");
  }
}
