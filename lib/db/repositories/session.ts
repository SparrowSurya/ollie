import { getPrisma } from "../client";
import { logger } from "../../logger";
import fs from "fs/promises";
import path from "path";
import readEnv from "../../config";

export interface DbSession {
  id: string;
  title: string;
  model: string;
  customInstructions?: string | null;
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

export async function createSession(
  id: string,
  title: string,
  model: string,
  customInstructions?: string
): Promise<void> {
  const prisma = getPrisma();
  const existing = await getSession(id);
  await prisma.session.upsert({
    where: { id },
    update: {},
    create: { id, title, model, customInstructions },
  });
  if (!existing) {
    logger.info(`Session created [ID: ${id}, Title: "${title}", Model: "${model}", InstructionsLength: ${customInstructions?.length ?? 0}]`);
  }
}

export async function deleteSession(id: string): Promise<void> {
  const prisma = getPrisma();
  const env = readEnv();
  const baseStorageDir = env.storagePath
    ? path.resolve(env.storagePath)
    : path.join(process.cwd(), "storage");

  // Clean up associated image files on disk
  try {
    const messages = await prisma.message.findMany({
      where: { sessionId: id },
      select: { images: true, generatedImages: true },
    });

    const candidateFilenames = new Set<string>();
    for (const msg of messages) {
      if (msg.images) {
        msg.images
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((url) => candidateFilenames.add(path.basename(url)));
      }
      if (msg.generatedImages) {
        msg.generatedImages
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((url) => candidateFilenames.add(path.basename(url)));
      }
    }

    if (candidateFilenames.size > 0) {
      const otherMessages = await prisma.message.findMany({
        where: { sessionId: { not: id } },
        select: { images: true, generatedImages: true },
      });
      const retained = new Set<string>();
      for (const msg of otherMessages) {
        if (msg.images) {
          msg.images
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .forEach((url) => retained.add(path.basename(url)));
        }
        if (msg.generatedImages) {
          msg.generatedImages
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .forEach((url) => retained.add(path.basename(url)));
        }
      }

      for (const filename of candidateFilenames) {
        if (!retained.has(filename)) {
          const uploadFile = path.join(baseStorageDir, "upload", filename);
          const genFile = path.join(baseStorageDir, "generated", filename);
          await fs.unlink(uploadFile).catch(() => {});
          await fs.unlink(genFile).catch(() => {});
          logger.info(`Removed session file: "${filename}"`);
        }
      }
    }
  } catch (err) {
    logger.error(`Error cleaning up files for deleted session ${id}:`, err);
  }

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

export async function updateSessionInstructions(id: string, customInstructions: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.session.update({
    where: { id },
    data: { customInstructions },
  });
  logger.info(`Session custom instructions updated [ID: ${id}]`);
}
