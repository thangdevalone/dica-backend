import { createHash, randomUUID } from "node:crypto";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { ApiException } from "../common/errors/api.exception.js";
import { ErrorCode } from "../common/errors/error-codes.js";
import { PrismaService } from "../database/prisma.service.js";
import type { AuthUser, TokenPayload } from "./auth.types.js";
import type { LoginDto } from "./dto/login.dto.js";
import type {
  ChangePasswordDto,
  ChangeUsernameDto,
  UpdateProfileDto,
} from "./dto/profile.dto.js";

const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,p=4,t=3$0yTgMIF1XmKZRG1439tCHA$uAZ6AyYWEVdUFYyE/Z02+3W+j7P1EZLVryfhkZhTwLU";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}
  private hash(t: string) {
    return createHash("sha256").update(t).digest("hex");
  }
  private ttlMilliseconds(value: string): number {
    const match = /^(\d+)(s|m|h|d)$/.exec(value);
    if (!match) return 7 * 86_400_000;
    const amount = Number(match[1]);
    const multiplier = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[
      match[2] as "s" | "m" | "h" | "d"
    ];
    return amount * multiplier;
  }
  private async tokens(
    user: { id: string; organizationId: string; tokenVersion: number },
    sid: string,
  ) {
    const base = {
      sub: user.id,
      sid,
      org: user.organizationId,
      ver: user.tokenVersion,
    };
    const accessTtl = this.config.get<string>("JWT_ACCESS_TTL", "15m"),
      refreshTtl = this.config.get<string>("JWT_REFRESH_TTL", "7d");
    const [access_token, refresh_token] = await Promise.all([
      this.jwt.signAsync(
        { ...base, typ: "access" },
        {
          secret: this.config.getOrThrow("JWT_ACCESS_SECRET"),
          algorithm: "HS256",
          expiresIn: accessTtl as never,
        },
      ),
      this.jwt.signAsync(
        { ...base, typ: "refresh" },
        {
          secret: this.config.getOrThrow("JWT_REFRESH_SECRET"),
          algorithm: "HS256",
          expiresIn: refreshTtl as never,
        },
      ),
    ]);
    return { access_token, refresh_token, expires_in: accessTtl };
  }
  async login(
    dto: LoginDto,
    client: { ipAddress?: string; userAgent?: string },
  ) {
    const org = await this.prisma.organization.findUnique({
      where: { code: dto.organization_code },
    });
    const user = org
      ? await this.prisma.user.findUnique({
          where: {
            organizationId_username: {
              organizationId: org.id,
              username: dto.username.trim().toLowerCase(),
            },
          },
        })
      : null;
    // Luôn chạy Argon2 kể cả khi org/user không tồn tại để giảm timing oracle.
    const valid = await argon2
      .verify(user?.passwordHash ?? DUMMY_PASSWORD_HASH, dto.password)
      .catch(() => false);
    if (!user || !valid || !user.active || !org?.active)
      throw new ApiException(
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        "Tên đăng nhập, mật khẩu hoặc mã tổ chức không đúng.",
        HttpStatus.UNAUTHORIZED,
      );
    const refreshTtl = this.config.get<string>("JWT_REFRESH_TTL", "7d");
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: this.hash(randomUUID()),
        expiresAt: new Date(Date.now() + this.ttlMilliseconds(refreshTtl)),
        ...(client.ipAddress ? { ipAddress: client.ipAddress } : {}),
        ...(client.userAgent
          ? { userAgent: client.userAgent.slice(0, 500) }
          : {}),
      },
    });
    const tokens = await this.tokens(user, session.id);
    await this.prisma.$transaction([
      this.prisma.session.update({
        where: { id: session.id },
        data: { refreshTokenHash: this.hash(tokens.refresh_token) },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
    ]);
    return {
      data: {
        ...tokens,
        user: {
          id: user.id,
          username: user.username,
          display_name: user.displayName,
          kind: user.kind,
        },
      },
      message: "Đăng nhập thành công.",
    };
  }
  async refresh(token: string) {
    let p: TokenPayload;
    try {
      p = await this.jwt.verifyAsync<TokenPayload>(token, {
        secret: this.config.getOrThrow("JWT_REFRESH_SECRET"),
        algorithms: ["HS256"],
      });
    } catch {
      throw new ApiException(
        ErrorCode.AUTH_SESSION_INVALID,
        "Refresh token không hợp lệ hoặc đã hết hạn.",
        HttpStatus.UNAUTHORIZED,
      );
    }
    const s =
      p.typ === "refresh"
        ? await this.prisma.session.findFirst({
            where: {
              id: p.sid,
              userId: p.sub,
              refreshTokenHash: this.hash(token),
              revokedAt: null,
              expiresAt: { gt: new Date() },
              user: {
                active: true,
                tokenVersion: p.ver,
                organization: { active: true },
              },
            },
            include: { user: true },
          })
        : null;
    if (!s)
      throw new ApiException(
        ErrorCode.AUTH_SESSION_INVALID,
        "Phiên đăng nhập đã hết hạn hoặc bị thu hồi.",
        HttpStatus.UNAUTHORIZED,
      );
    const tokens = await this.tokens(s.user, s.id);
    const rotated = await this.prisma.session.updateMany({
      where: {
        id: s.id,
        refreshTokenHash: this.hash(token),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { refreshTokenHash: this.hash(tokens.refresh_token) },
    });
    if (rotated.count !== 1)
      throw new ApiException(
        ErrorCode.AUTH_SESSION_INVALID,
        "Refresh token đã được sử dụng hoặc phiên đã hết hạn.",
        HttpStatus.UNAUTHORIZED,
      );
    return { data: tokens, message: "Làm mới phiên đăng nhập thành công." };
  }
  async logout(u: AuthUser) {
    await this.prisma.session.updateMany({
      where: { id: u.sessionId, userId: u.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { data: null, message: "Đăng xuất thành công." };
  }
  async me(u: AuthUser) {
    const user = await this.prisma.user.findFirst({
      where: { id: u.id, organizationId: u.organizationId, active: true },
      select: {
        id: true,
        username: true,
        displayName: true,
        kind: true,
        organizationId: true,
        supplierId: true,
        identityNumber: true,
        dateOfBirth: true,
        phone: true,
        email: true,
        address: true,
      },
    });
    if (!user) this.invalidSession();
    return {
      data: {
        id: user.id,
        username: user.username,
        display_name: user.displayName,
        kind: user.kind,
        organization_id: user.organizationId,
        supplier_id: user.supplierId,
        identity_number: user.identityNumber,
        date_of_birth: user.dateOfBirth?.toISOString().slice(0, 10) ?? null,
        phone: user.phone,
        email: user.email,
        address: user.address,
      },
      message: "Lấy thông tin tài khoản thành công.",
    };
  }
  async updateProfile(u: AuthUser, d: UpdateProfileDto) {
    const current = await this.prisma.user.findFirst({
      where: { id: u.id, organizationId: u.organizationId, active: true },
      select: {
        id: true,
        username: true,
        displayName: true,
        identityNumber: true,
        dateOfBirth: true,
        phone: true,
        email: true,
        address: true,
      },
    });
    if (!current) this.invalidSession();
    const identityNumber = this.optionalText(d.identity_number);
    const dateOfBirth = this.optionalDate(d.date_of_birth);
    if (
      identityNumber &&
      (await this.prisma.user.count({
        where: {
          organizationId: u.organizationId,
          identityNumber,
          id: { not: u.id },
        },
      }))
    )
      this.invalid("CCCD/CMND đã được sử dụng bởi tài khoản khác.");
    const updatedFields = Object.entries({
      display_name: d.display_name,
      identity_number: d.identity_number,
      date_of_birth: d.date_of_birth,
      phone: d.phone,
      email: d.email,
      address: d.address,
    })
      .filter(([, value]) => value !== undefined)
      .map(([field]) => field);
    const data = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: u.id },
        data: {
          ...(d.display_name !== undefined
            ? { displayName: d.display_name.trim() || current.username }
            : {}),
          ...(d.identity_number !== undefined ? { identityNumber } : {}),
          ...(d.date_of_birth !== undefined ? { dateOfBirth } : {}),
          ...(d.phone !== undefined
            ? { phone: this.optionalText(d.phone) }
            : {}),
          ...(d.email !== undefined
            ? { email: this.optionalText(d.email)?.toLowerCase() ?? null }
            : {}),
          ...(d.address !== undefined
            ? { address: this.optionalText(d.address) }
            : {}),
        },
        select: {
          id: true,
          username: true,
          displayName: true,
          kind: true,
          organizationId: true,
          supplierId: true,
          identityNumber: true,
          dateOfBirth: true,
          phone: true,
          email: true,
          address: true,
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: u.organizationId,
          actorId: u.id,
          action: "user.profile.update",
          resourceType: "User",
          resourceId: u.id,
          requestId: u.requestId,
          afterData: { updated_fields: updatedFields },
        },
      });
      return updated;
    });
    return {
      data: this.profile(data),
      message: "Cập nhật thông tin cá nhân thành công.",
    };
  }
  async changeUsername(u: AuthUser, d: ChangeUsernameDto) {
    const current = await this.verifiedUser(u, d.current_password);
    const username = d.username.trim().toLowerCase();
    if (
      await this.prisma.user.count({
        where: {
          organizationId: u.organizationId,
          username,
          id: { not: u.id },
        },
      })
    )
      this.invalid("Tên đăng nhập đã được sử dụng.");
    const data = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: u.id },
        data: {
          username,
          ...(current.displayName === current.username
            ? { displayName: username }
            : {}),
          tokenVersion: { increment: 1 },
        },
      });
      const revoked = await tx.session.updateMany({
        where: { userId: u.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: u.organizationId,
          actorId: u.id,
          action: "user.username.change",
          resourceType: "User",
          resourceId: u.id,
          requestId: u.requestId,
          beforeData: { username: current.username },
          afterData: { username, sessions_revoked: revoked.count },
        },
      });
      return { username, sessions_revoked: revoked.count };
    });
    return {
      data,
      message: "Đổi tên đăng nhập thành công. Vui lòng đăng nhập lại.",
    };
  }
  async changePassword(u: AuthUser, d: ChangePasswordDto) {
    const current = await this.verifiedUser(u, d.current_password);
    if (await argon2.verify(current.passwordHash, d.new_password))
      this.invalid("Mật khẩu mới phải khác mật khẩu hiện tại.");
    const passwordHash = await argon2.hash(d.new_password);
    const data = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: u.id },
        data: { passwordHash, tokenVersion: { increment: 1 } },
      });
      const revoked = await tx.session.updateMany({
        where: { userId: u.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: u.organizationId,
          actorId: u.id,
          action: "user.password.change",
          resourceType: "User",
          resourceId: u.id,
          requestId: u.requestId,
          afterData: { sessions_revoked: revoked.count },
        },
      });
      return { sessions_revoked: revoked.count };
    });
    return {
      data,
      message: "Đổi mật khẩu thành công. Vui lòng đăng nhập lại.",
    };
  }
  private profile(user: {
    id: string;
    username: string;
    displayName: string;
    kind: string;
    organizationId: string;
    supplierId: string | null;
    identityNumber: string | null;
    dateOfBirth: Date | null;
    phone: string | null;
    email: string | null;
    address: string | null;
  }) {
    return {
      id: user.id,
      username: user.username,
      display_name: user.displayName,
      kind: user.kind,
      organization_id: user.organizationId,
      supplier_id: user.supplierId,
      identity_number: user.identityNumber,
      date_of_birth: user.dateOfBirth?.toISOString().slice(0, 10) ?? null,
      phone: user.phone,
      email: user.email,
      address: user.address,
    };
  }
  private optionalText(value: string | undefined): string | null {
    return value?.trim() || null;
  }
  private optionalDate(value: string | undefined): Date | null {
    if (!value?.trim()) return null;
    const date = new Date(`${value}T00:00:00.000Z`);
    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value ||
      date > new Date()
    )
      this.invalid("Ngày sinh không hợp lệ hoặc nằm trong tương lai.");
    return date;
  }
  private async verifiedUser(u: AuthUser, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: u.id, organizationId: u.organizationId, active: true },
      select: {
        id: true,
        username: true,
        displayName: true,
        passwordHash: true,
      },
    });
    const valid = user
      ? await argon2.verify(user.passwordHash, password).catch(() => false)
      : false;
    if (!user || !valid)
      throw new ApiException(
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        "Mật khẩu hiện tại không đúng.",
        HttpStatus.UNAUTHORIZED,
      );
    return user;
  }
  private invalid(message: string): never {
    throw new ApiException(
      ErrorCode.VALIDATION_ERROR,
      message,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
  private invalidSession(): never {
    throw new ApiException(
      ErrorCode.AUTH_SESSION_INVALID,
      "Phiên đăng nhập không còn hợp lệ.",
      HttpStatus.UNAUTHORIZED,
    );
  }
  permissions(u: AuthUser) {
    return {
      data: {
        permissions: [
          ...new Set(u.grants.flatMap((g) => g.permissions)),
        ].sort(),
        grants: u.grants,
      },
      message: "Lấy quyền và phạm vi dữ liệu thành công.",
    };
  }
}
