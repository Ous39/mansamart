import type { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { sessions, users } from "@mansamart/database/schema";
import { eq, and, gt, isNull } from "drizzle-orm";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
import { parseClientAudience, roleAllowedForAudience, type ClientAudience } from "./client-access";
import { hashSessionToken } from "./session-security";

export function generateToken(): string {
  return crypto.randomBytes(48).toString("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

export async function comparePin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

export interface SessionMetadata {
  deviceName?: string | null;
  devicePlatform?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export function sessionMetadataFromRequest(req: Request): SessionMetadata {
  return {
    deviceName: req.header("x-device-name")?.slice(0, 120) || null,
    devicePlatform: req.header("x-device-platform")?.slice(0, 40) || null,
    ipAddress: req.ip || req.socket.remoteAddress || null,
    userAgent: req.header("user-agent")?.slice(0, 500) || null,
  };
}

export async function createSession(
  userId: string,
  audience: ClientAudience,
  lifetimeMs = 30 * 24 * 60 * 60 * 1000,
  metadata: SessionMetadata = {},
): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + lifetimeMs);
  await db.insert(sessions).values({
    userId,
    token: hashSessionToken(token),
    audience,
    expiresAt,
    deviceName: metadata.deviceName || null,
    devicePlatform: metadata.devicePlatform || null,
    ipAddress: metadata.ipAddress || null,
    userAgent: metadata.userAgent || null,
    lastSeenAt: new Date(),
  });
  return token;
}

export async function getSession(token: string) {
  const [session] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, hashSessionToken(token)), gt(sessions.expiresAt, new Date()), isNull(sessions.revokedAt)))
    .limit(1);

  return session ?? null;
}

export async function getSessionUser(token: string) {
  return (await getSession(token))?.user ?? null;
}

export async function deleteSession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.token, hashSessionToken(token)));
}

export function getTokenFromRequest(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = getTokenFromRequest(req);
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  const session = await getSession(token);
  const audience = parseClientAudience(req.header("x-mansamart-app"));
  if (!session || !audience || session.session.audience !== audience || !roleAllowedForAudience(audience, session.user.role)) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  (req as any).user = session.user;
  (req as any).session = session.session;
  if (Date.now() - session.session.lastSeenAt.getTime() > 5 * 60_000) {
    void db.update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.id, session.session.id)).catch(() => {});
  }
  next();
}

export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const token = getTokenFromRequest(req);
  if (token) {
    const session = await getSession(token);
    const audience = parseClientAudience(req.header("x-mansamart-app"));
    if (session && audience && session.session.audience === audience && roleAllowedForAudience(audience, session.user.role)) {
      (req as any).user = session.user;
      (req as any).session = session.session;
    }
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}
