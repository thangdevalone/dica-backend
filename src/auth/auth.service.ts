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
              username: dto.username,
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
  me(u: AuthUser) {
    return {
      data: {
        id: u.id,
        username: u.username,
        display_name: u.displayName,
        kind: u.kind,
        organization_id: u.organizationId,
        supplier_id: u.supplierId,
      },
      message: "Lấy thông tin tài khoản thành công.",
    };
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
