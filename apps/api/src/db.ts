import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@mansamart/database/schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not set. Configure the PostgreSQL connection and restart the API.",
  );
}

const databaseSslEnabled = process.env.DATABASE_SSL === "true" || databaseUrl.includes("sslmode=require");
const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false";

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseSslEnabled
    ? { rejectUnauthorized }
    : false,
});

export const db = drizzle(pool, { schema });
export { pool };
