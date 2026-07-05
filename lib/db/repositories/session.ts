import { getPrisma } from "../client";
import { logger } from "../../logger";

export interface DbSession {
  id: string;
  title: string;
  model: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Repository containing all session queries and updates.
 */
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
  const existing = await getSession(id);
  await prisma.session.upsert({
    where: { id },
    update: {},
    create: { id, title, model },
  });
  if (!existing) {
    logger.info(`Session created [ID: ${id}, Title: "${title}", Model: "${model}"]`);
  }
}

export async function deleteSession(id: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.session.delete({
    where: { id },
  });
  logger.info(`Session deleted [ID: ${id}]`);
}

export async function updateSessionTitle(id: string, title: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.session.update({
    where: { id },
    data: { title },
  });
  logger.info(`Session renamed [ID: ${id}, Title: "${title}"]`);
}

export async function updateSessionModel(id: string, model: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.session.update({
    where: { id },
    data: { model },
  });
  logger.info(`Session model updated [ID: ${id}, Model: "${model}"]`);
}
