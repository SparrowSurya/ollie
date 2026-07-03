import { defineConfig } from "prisma/config";

const activeSchema = process.env.PRISMA_SCHEMA || "prisma/schema.dev.prisma";
const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";

export default defineConfig({
  schema: activeSchema,
  datasource: {
    url: databaseUrl,
  },
});
