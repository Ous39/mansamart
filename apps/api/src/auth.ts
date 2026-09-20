import type { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { sessions, users } from "@mansamart/database/schema";
import { eq, and, gt } from "drizzle-orm";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";

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

export async function createSession(userId: string, lifetimeMs = 30 * 24 * 60 * 60 * 1000): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + lifetimeMs);
  await db.insert(sessions).values({ userId, token, expiresAt });
  return token;
}

export async function getSessionUser(token: string) {
  const [session] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1);

  return session?.user ?? null;
}

export async function deleteSession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.token, token));
}

export function getTokenFromRequest(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = getTokenFromRequest(req);
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  const user = await getSessionUser(token);
  if (!user) return res.status(401).json({ message: "Unauthorized" });

  (req as any).user = user;
  next();
}

export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const token = getTokenFromRequest(req);
  if (token) {
    const user = await getSessionUser(token);
    if (user) (req as any).user = user;
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
