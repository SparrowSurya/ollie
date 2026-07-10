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
  parentMessageId?: string;
  timestamp: Date;
}

/**
 * Repository containing all message queries and operations.
 */
export async function getMessages(sessionId: string): Promise<DbMessage[]> {
  const prisma = getPrisma();
  
  // 1. Get the session to see if it has an activeMessageId
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { activeMessageId: true },
  });

  const rows = await prisma.message.findMany({
    where: { sessionId },
    orderBy: { timestamp: "asc" },
  });

  const dbMessages: DbMessage[] = rows.map((m: any) => ({
    id: m.id,
    sessionId: m.sessionId,
    role: m.role,
    content: m.content,
    modelName: m.modelName || undefined,
    images: m.images || undefined,
    generatedImages: m.generatedImages || undefined,
    parentMessageId: m.parentMessageId || undefined,
    timestamp: m.timestamp,
  }));

  const isTreeSession = dbMessages.some((m) => m.parentMessageId !== undefined && m.parentMessageId !== null);

  if (session?.activeMessageId) {
    const activePath: DbMessage[] = [];
    let currentId: string | undefined = session.activeMessageId;
    const messageMap = new Map<string, DbMessage>();
    
    dbMessages.forEach((m) => {
      messageMap.set(m.id, m);
    });

    while (currentId) {
      const msg = messageMap.get(currentId);
      if (!msg) break;
      activePath.push(msg);
      currentId = msg.parentMessageId;
    }

    return activePath.reverse();
  } else if (isTreeSession) {
    return [];
  }

  // Fallback to sequential listing for backward compatibility
  return dbMessages;
}

export async function saveMessage(
  id: string,
  sessionId: string,
  role: string,
  content: string,
  modelName?: string,
  images?: string,
  generatedImages?: string,
  parentMessageId?: string
): Promise<void> {
  const prisma = getPrisma();
  
  await prisma.message.upsert({
    where: { id },
    update: { 
      content,
      images: images || null,
      generatedImages: generatedImages || null,
      parentMessageId: parentMessageId || null,
    },
    create: {
      id,
      sessionId,
      role,
      content,
      modelName: modelName || null,
      images: images || null,
      generatedImages: generatedImages || null,
      parentMessageId: parentMessageId || null,
    },
  });

  // Touch the updatedAt field and update the activeMessageId of the session
  await prisma.session.update({
    where: { id: sessionId },
    data: { 
      updatedAt: new Date(),
      activeMessageId: id,
    },
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
  if (parentMessageId) {
    meta += ` ParentMessageID: "${parentMessageId}"`;
  }

  logger.info(`Message saved [ID: ${id}, SessionID: ${sessionId}, Role: "${role}"]${meta}`);
}

export async function updateActiveMessage(sessionId: string, messageId: string | null): Promise<void> {
  const prisma = getPrisma();
  await prisma.session.update({
    where: { id: sessionId },
    data: { activeMessageId: messageId },
  });
  logger.info(`Session active message updated [SessionID: ${sessionId}, ActiveMessageID: ${messageId}]`);
}

export async function getAllSessionMessages(sessionId: string): Promise<DbMessage[]> {
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
    parentMessageId: m.parentMessageId || undefined,
    timestamp: m.timestamp,
  }));
}


