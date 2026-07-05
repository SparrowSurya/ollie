/* eslint-disable @typescript-eslint/no-explicit-any */
import { getPrisma } from "../client";
import { logger } from "../../logger";

export interface DbMessage {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  modelName?: string;
  images?: string;
  generatedImages?: string;
  timestamp: Date;
}

/**
 * Repository containing all message queries and operations.
 */
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
    images: m.images || undefined,
    generatedImages: m.generatedImages || undefined,
    timestamp: m.timestamp,
  }));
}

export async function saveMessage(
  id: string,
  sessionId: string,
  role: string,
  content: string,
  modelName?: string,
  images?: string,
  generatedImages?: string
): Promise<void> {
  const prisma = getPrisma();
  
  await prisma.message.upsert({
    where: { id },
    update: { 
      content,
      images: images || null,
      generatedImages: generatedImages || null,
    },
    create: {
      id,
      sessionId,
      role,
      content,
      modelName: modelName || null,
      images: images || null,
      generatedImages: generatedImages || null,
    },
  });

  // Touch the updatedAt field of the session
  await prisma.session.update({
    where: { id: sessionId },
    data: { updatedAt: new Date() },
  });

  const uploadedFilenames = images ? images.split(",").filter(Boolean).map(url => url.split("/").pop()) : [];
  const generatedFilenames = generatedImages ? generatedImages.split(",").filter(Boolean).map(url => url.split("/").pop()) : [];
  let meta = "";
  if (uploadedFilenames.length > 0) {
    meta += ` UploadedImagesCount: ${uploadedFilenames.length} [${uploadedFilenames.join(", ")}]`;
  }
  if (generatedFilenames.length > 0) {
    meta += ` GeneratedImagesCount: ${generatedFilenames.length} [${generatedFilenames.join(", ")}]`;
  }
  if (modelName) {
    meta += ` Model: "${modelName}"`;
  }

  logger.info(`Message saved [ID: ${id}, SessionID: ${sessionId}, Role: "${role}"]${meta}`);
}

