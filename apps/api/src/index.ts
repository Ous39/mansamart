import "dotenv/config";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerRoutes } from "./routes";
import { runStartupMigrations } from "./startup-migrations";
import { pool } from "./db";

const app = express();
const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const appDirectory = path.resolve(sourceDirectory, "..");

declare module "http" {
  interface IncomingMessage { rawBody: unknown; }
}

function configuredOrigins(): string[] {
  return (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

function isAllowedOrigin(origin?: string): boolean {
  if (!origin) return true;
  const normalized = origin.replace(/\/$/, "");
  const local = process.env.NODE_ENV !== "production" && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(normalized);
  return local || configuredOrigins().includes(normalized);
}

function setupSecurity() {
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
    if (process.env.NODE_ENV === "production") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  });
}

function setupCors() {
  app.use((req, res, next) => {
    const origin = req.header("origin");
    if (origin && isAllowedOrigin(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Vary", "Origin");
      res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-MansaMart-App");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    if (origin && !isAllowedOrigin(origin)) return res.status(403).json({ message: "Origin not allowed" });
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
}

function setupBodyParsing() {
  app.use(express.json({
    limit: "25mb",
    verify: (req, _res, buffer) => { req.rawBody = buffer; },
  }));
  app.use(express.urlencoded({ extended: false, limit: "25mb" }));
}

function setupRequestLogging() {
  app.use((req, res, next) => {
    const startedAt = Date.now();
    res.on("finish", () => {
      if (req.path.startsWith("/api")) {
        console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - startedAt}ms`);
      }
    });
    next();
  });
}

function setupErrorHandler() {
  app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(error);
    const known = error as { status?: number; statusCode?: number; message?: string };
    const status = known.status || known.statusCode || 500;
    console.error("API error:", error);
    return res.status(status).json({ message: status === 500 ? "Internal Server Error" : known.message });
  });
}

async function start() {
  setupSecurity();
  setupCors();
  setupBodyParsing();
  setupRequestLogging();

  app.get("/api/health", (_req, res) => res.json({ ok: true, service: "mansamart-api", time: new Date().toISOString() }));
  app.use("/uploads", express.static(path.join(appDirectory, "uploads"), { fallthrough: false, maxAge: "1d" }));

  await runStartupMigrations();
  await pool.query("select 1");
  const server = await registerRoutes(app);
  setupErrorHandler();

  const port = Number.parseInt(process.env.PORT || "5000", 10);
  const host = process.env.HOST || "0.0.0.0";
  server.listen(port, host, () => console.log(`MansaMart API listening on http://${host}:${port}`));
}

start().catch((error) => {
  console.error("MansaMart API failed to start:", error);
  process.exit(1);
});
