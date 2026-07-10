import { Message } from "@prisma/client";
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

  const dbMessages: DbMessage[] = rows.map((m: Message) => ({
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

export async function updateActiveMessage(
  sessionId: string,
  messageId: string | null,
  leafWalk = false
): Promise<void> {
  const prisma = getPrisma();
  
  let targetMessageId = messageId;
  if (messageId && leafWalk) {
    // 1. Fetch all messages in the session to construct the full tree
    const allMsgs = await prisma.message.findMany({
      where: { sessionId },
      orderBy: { timestamp: "asc" },
    });
    
    // 2. Map parentMessageId to children
    const parentToChildren = new Map<string, DbMessage[]>();
    (allMsgs as unknown as DbMessage[]).forEach((m: DbMessage) => {
      if (m.parentMessageId) {
        const children = parentToChildren.get(m.parentMessageId) || [];
        children.push(m);
        parentToChildren.set(m.parentMessageId, children);
      }
    });
    
    // 3. Walk down to the leaf node
    let currentId = messageId;
    while (true) {
      const children = parentToChildren.get(currentId);
      if (!children || children.length === 0) {
        break; // Reached leaf
      }
      // Pick the latest child by timestamp
      children.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      currentId = children[0].id;
    }
    targetMessageId = currentId;
  }

  await prisma.session.update({
    where: { id: sessionId },
    data: { activeMessageId: targetMessageId },
  });
  logger.info(`Session active message updated [SessionID: ${sessionId}, RequestedID: ${messageId}, ActiveMessageID: ${targetMessageId}]`);
}

export async function getAllSessionMessages(sessionId: string): Promise<DbMessage[]> {
  const prisma = getPrisma();
  const rows = await prisma.message.findMany({
    where: { sessionId },
    orderBy: { timestamp: "asc" },
  });
  return rows.map((m: Message) => ({
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

export interface PaginatedMessagesResponse {
  messages: DbMessage[];
  allMessages: DbMessage[];
  hasMore: boolean;
}

export async function getMessagesPaginated(
  sessionId: string,
  limit = 25,
  cursorMessageId?: string
): Promise<PaginatedMessagesResponse> {
  // 1. Get the full active path
  const fullActivePath = await getMessages(sessionId);

  if (fullActivePath.length === 0) {
    return { messages: [], allMessages: [], hasMore: false };
  }

  // 2. Locate cursor index
  let cursorIndex = fullActivePath.length;
  if (cursorMessageId) {
    const idx = fullActivePath.findIndex((m) => m.id === cursorMessageId);
    if (idx !== -1) {
      cursorIndex = idx;
    }
  }

  // 3. Slice the active path
  const startIndex = Math.max(0, cursorIndex - limit);
  const messagesSlice = fullActivePath.slice(startIndex, cursorIndex);
  const hasMore = startIndex > 0;

  // 4. Fetch siblings for messages in this slice to calculate version controls
  const prisma = getPrisma();
  const parentIds = Array.from(new Set(messagesSlice.map((m) => m.parentMessageId || null)));

  let siblingRows: Message[] = [];
  const stringParentIds = parentIds.filter((id): id is string => id !== null);
  const hasNullParent = parentIds.includes(null);

  if (stringParentIds.length > 0 || hasNullParent) {
    siblingRows = await prisma.message.findMany({
      where: {
        sessionId,
        OR: [
          ...(stringParentIds.length > 0 ? [{ parentMessageId: { in: stringParentIds } }] : []),
          ...(hasNullParent ? [{ parentMessageId: null }] : []),
        ],
      },
    });
  }

  // Combine and deduplicate slice messages and siblings
  const messageMap = new Map<string, DbMessage>();
  
  messagesSlice.forEach((m) => {
    messageMap.set(m.id, m);
  });

  siblingRows.forEach((m: Message) => {
    messageMap.set(m.id, {
      id: m.id,
      sessionId: m.sessionId,
      role: m.role,
      content: m.content,
      modelName: m.modelName || undefined,
      images: m.images || undefined,
      generatedImages: m.generatedImages || undefined,
      parentMessageId: m.parentMessageId || undefined,
      timestamp: m.timestamp,
    });
  });

  return {
    messages: messagesSlice,
    allMessages: Array.from(messageMap.values()),
    hasMore,
  };
}


