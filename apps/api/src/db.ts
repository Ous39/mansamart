import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@mansamart/database/schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not set. Create a .env file in the project root, then restart the server. Example: DATABASE_URL=postgres://postgres:NoVirus123@localhost:5432/oceanbrown",
  );
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes("sslmode=require")
    ? { rejectUnauthorized: false }
    : false,
});

export const db = drizzle(pool, { schema });
export { pool };
