/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";
const databaseType = process.env.DATABASE_TYPE || (databaseUrl.startsWith("postgres://") || databaseUrl.startsWith("postgresql://") ? "postgres" : "sqlite3");

let prismaInstance: any = null;

/**
 * Initializes and returns the singleton Prisma Client instance
 * configured with the correct provider adapter (SQLite vs Postgres).
 */
export function getPrisma() {
  if (!prismaInstance) {
    if (databaseType === "postgres") {
      const pool = new Pool({ connectionString: databaseUrl });
      const adapter = new PrismaPg(pool);
      prismaInstance = new PrismaClient({ adapter });
    } else {
      const adapter = new PrismaLibSql({ url: databaseUrl });
      prismaInstance = new PrismaClient({ adapter });
    }
  }
  return prismaInstance;
}
