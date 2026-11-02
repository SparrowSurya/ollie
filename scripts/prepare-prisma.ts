import fs from "fs";
import path from "path";
import { execSync } from "child_process";

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

    if (provider === "sqlite") {
      const dbFile = dbUrl.startsWith("file:") ? dbUrl.replace(/^file:/, "") : dbUrl;
      const absDbPath = path.isAbsolute(dbFile) ? dbFile : path.join(process.cwd(), dbFile);
      if (!fs.existsSync(absDbPath)) {
        console.log(`[prepare-prisma] SQLite database not found at "${absDbPath}". Initializing tables...`);
        try {
          execSync("prisma db push --skip-generate", { stdio: "inherit" });
        } catch {
          console.warn("[prepare-prisma] Auto-initialization failed. Run 'bun run db:push' manually.");
        }
      }
    }
  } else {
    console.error("[prepare-prisma] Could not find datasource db block in schema.prisma");
  }
} else {
  console.error("[prepare-prisma] schema.prisma not found");
}
