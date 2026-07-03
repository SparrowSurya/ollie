import fs from "fs";
import path from "path";

// Auto-detect based on env vars
const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
const dbTypeEnv = process.env.DATABASE_TYPE; // "sqlite3" or "postgres"

let provider = "sqlite";
if (dbTypeEnv === "postgres" || dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://")) {
  provider = "postgresql";
}

const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");

if (fs.existsSync(schemaPath)) {
  const schema = fs.readFileSync(schemaPath, "utf8");

  // Regex to find:
  // datasource db {
  //   provider = "..."
  // }
  const regex = /(datasource\s+db\s*{[\s\S]*?provider\s*=\s*")[^"]*("[\s\S]*?})/;
  if (regex.test(schema)) {
    const updatedSchema = schema.replace(regex, `$1${provider}$2`);
    if (schema !== updatedSchema) {
      fs.writeFileSync(schemaPath, updatedSchema, "utf8");
      console.log(`[prepare-prisma] Updated database provider in schema.prisma to: "${provider}"`);
    } else {
      console.log(`[prepare-prisma] Database provider in schema.prisma is already: "${provider}"`);
    }
  } else {
    console.error("[prepare-prisma] Could not find datasource db block in schema.prisma");
  }
} else {
  console.error("[prepare-prisma] schema.prisma not found");
}
