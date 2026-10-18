import { randomUUID } from "node:crypto";
import { Injectable, UnauthorizedException, UnprocessableEntityException } from "@nestjs/common";
import { PrismaService } from "../../core/prisma/prisma.service.js";
import type { AuthSession, AuthUser } from "./auth.types.js";
import { passwordProblem } from "./password-policy.js";
import { PasswordService } from "./password.service.js";
import { TokenService } from "./token.service.js";

type UserRow = {
  id: string;
  email: string;
  role: "ADMIN" | "PLAYER";
  mustChangePassword: boolean;
};

export function toAuthUser(user: UserRow): AuthUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  };
}

/** The same failure for an unknown email and a wrong password, so neither can be told apart. */
function invalidCredentials(): UnauthorizedException {
  return new UnauthorizedException({
    code: "INVALID_CREDENTIALS",
    message: "The email or password is incorrect.",
  });
}

function invalidRefreshToken(): UnauthorizedException {
  return new UnauthorizedException({
    code: "INVALID_REFRESH_TOKEN",
    message: "The session is no longer valid. Sign in again.",
  });
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  async login(email: string, password: string): Promise<AuthSession> {
    const user = await this.prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
    if (!user) {
      await this.passwords.verifyAgainstDummy(password);
      throw invalidCredentials();
    }
    if (!(await this.passwords.verify(user.passwordHash, password))) throw invalidCredentials();
    return this.startSession(user, randomUUID());
  }

  /** Rotation: the presented token is spent and replaced; presenting a spent token revokes the family. */
  async refresh(refreshToken: string): Promise<AuthSession> {
    const now = new Date();
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.tokens.hashRefreshToken(refreshToken) },
    });
    if (!row) throw invalidRefreshToken();
    if (row.revokedAt) {
      await this.revokeFamily(row.familyId);
      throw invalidRefreshToken();
    }
    if (row.expiresAt <= now) throw invalidRefreshToken();

    const user = await this.prisma.user.findUnique({ where: { id: row.userId } });
    if (!user) throw invalidRefreshToken();

    const newToken = this.tokens.newRefreshToken();
    const newId = randomUUID();
    // The claim (updateMany on revokedAt null) is atomic, so of two concurrent refreshes with the
    // same token exactly one wins; the other is treated as reuse.
    const claimed = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.refreshToken.updateMany({
        where: { id: row.id, revokedAt: null },
        data: { revokedAt: now, replacedById: newId },
      });
      if (count === 0) return false;
      await tx.refreshToken.create({
        data: this.newRow(newId, user.id, row.familyId, newToken, now),
      });
      return true;
    });
    if (!claimed) {
      await this.revokeFamily(row.familyId);
      throw invalidRefreshToken();
    }
    return this.session(user, newToken);
  }

  /** Idempotent: unknown, expired, and already revoked tokens all succeed silently. */
  async logout(refreshToken: string): Promise<void> {
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.tokens.hashRefreshToken(refreshToken) },
    });
    if (row) await this.revokeFamily(row.familyId);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<AuthSession> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException({ code: "UNAUTHORIZED", message: "Sign in again." });

    // 422, not 401: a wrong current password is a form error and must not trigger the client's
    // refresh-then-logout handling of 401.
    if (!(await this.passwords.verify(user.passwordHash, currentPassword))) {
      throw new UnprocessableEntityException({
        code: "CURRENT_PASSWORD_INCORRECT",
        message: "The current password is incorrect.",
        issues: [
          {
            path: "currentPassword",
            code: "INCORRECT",
            message: "The current password is incorrect.",
          },
        ],
      });
    }
    const problem =
      newPassword === currentPassword
        ? "must be different from the current password"
        : passwordProblem(newPassword);
    if (problem) {
      throw new UnprocessableEntityException({
        code: "WEAK_PASSWORD",
        message: `The new password ${problem}.`,
        issues: [{ path: "newPassword", code: "WEAK_PASSWORD", message: `Password ${problem}.` }],
      });
    }

    const passwordHash = await this.passwords.hash(newPassword);
    const now = new Date();
    const refreshToken = this.tokens.newRefreshToken();
    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.user.update({
        where: { id: user.id },
        data: { passwordHash, mustChangePassword: false },
      });
      await tx.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.refreshToken.create({
        data: this.newRow(randomUUID(), user.id, randomUUID(), refreshToken, now),
      });
      return saved;
    });
    return this.session(updated, refreshToken);
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException({ code: "UNAUTHORIZED", message: "Sign in again." });
    return toAuthUser(user);
  }

  private async startSession(user: UserRow, familyId: string): Promise<AuthSession> {
    const refreshToken = this.tokens.newRefreshToken();
    await this.prisma.refreshToken.create({
      data: this.newRow(randomUUID(), user.id, familyId, refreshToken, new Date()),
    });
    return this.session(user, refreshToken);
  }

  private newRow(id: string, userId: string, familyId: string, token: string, now: Date) {
    return {
      id,
      userId,
      familyId,
      tokenHash: this.tokens.hashRefreshToken(token),
      expiresAt: new Date(now.getTime() + this.tokens.refreshTtlMs),
    };
  }

  private async session(user: UserRow, refreshToken: string): Promise<AuthSession> {
    return {
      accessToken: await this.tokens.signAccessToken({ userId: user.id, role: user.role }),
      refreshToken,
      expiresIn: this.tokens.accessTtlSeconds,
      user: toAuthUser(user),
    };
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
