/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient as DevPrismaClient } from "@prisma/client/dev";
import { PrismaClient as ProdPrismaClient } from "@prisma/client/prod";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

export interface DbSession {
  id: string;
  title: string;
  model: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DbMessage {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  modelName?: string;
  timestamp: Date;
}

const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";
const isPostgres = databaseUrl.startsWith("postgres://") || databaseUrl.startsWith("postgresql://");

let prismaInstance: any = null;

function getPrisma() {
  if (!prismaInstance) {
    if (isPostgres) {
      const pool = new Pool({ connectionString: databaseUrl });
      const adapter = new PrismaPg(pool);
      prismaInstance = new ProdPrismaClient({ adapter });
    } else {
      const adapter = new PrismaLibSql({ url: databaseUrl });
      prismaInstance = new DevPrismaClient({ adapter });
    }
  }
  return prismaInstance;
}

export async function listSessions(): Promise<DbSession[]> {
  const prisma = getPrisma();
  return prisma.session.findMany({
    orderBy: { updatedAt: "desc" },
  });
}

export async function getSession(id: string): Promise<DbSession | null> {
  const prisma = getPrisma();
  return prisma.session.findUnique({
    where: { id },
  });
}

export async function createSession(id: string, title: string, model: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.session.upsert({
    where: { id },
    update: {},
    create: { id, title, model },
  });
}

export async function deleteSession(id: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.session.delete({
    where: { id },
  });
}

export async function getMessages(sessionId: string): Promise<DbMessage[]> {
  const prisma = getPrisma();
  const rows = await prisma.message.findMany({
    where: { sessionId },
    orderBy: { timestamp: "asc" },
  });
  return rows.map((m: any) => ({
    id: m.id,
    sessionId: m.sessionId,
    role: m.role,
    content: m.content,
    modelName: m.modelName || undefined,
    timestamp: m.timestamp,
  }));
}

export async function saveMessage(
  id: string,
  sessionId: string,
  role: string,
  content: string,
  modelName?: string
): Promise<void> {
  const prisma = getPrisma();
  
  await prisma.message.upsert({
    where: { id },
    update: { content },
    create: {
      id,
      sessionId,
      role,
      content,
      modelName: modelName || null,
    },
  });

  // Touch the updatedAt field of the session
  await prisma.session.update({
    where: { id: sessionId },
    data: { updatedAt: new Date() },
  });
}

export async function updateSessionTitle(id: string, title: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.session.update({
    where: { id },
    data: { title },
  });
}

export async function updateSessionModel(id: string, model: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.session.update({
    where: { id },
    data: { model },
  });
}
