import { getPrisma } from "../client";

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
