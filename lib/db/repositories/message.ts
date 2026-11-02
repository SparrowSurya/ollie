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
  replyToText?: string;
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
    replyToText: m.replyToText || undefined,
  }));

  const isTreeSession = dbMessages.some((m) => m.parentMessageId !== undefined && m.parentMessageId !== null);

  if (session?.activeMessageId) {
    const activePath: DbMessage[] = [];
    let currentId: string | undefined = session.activeMessageId;
    const messageMap = new Map<string, DbMessage>();
    const parentToChildren = new Map<string, DbMessage[]>();
    
    dbMessages.forEach((m) => {
      messageMap.set(m.id, m);
      if (m.parentMessageId) {
        const list = parentToChildren.get(m.parentMessageId) || [];
        list.push(m);
        parentToChildren.set(m.parentMessageId, list);
      }
    });

    // If activeMessageId is not a leaf node (e.g. user prompt before assistant reply completed),
    // walk down to the latest leaf along the chain so the assistant response is included.
    while (currentId) {
      const children = parentToChildren.get(currentId);
      if (!children || children.length === 0) break;
      children.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      currentId = children[0].id;
    }

    while (currentId) {
      const msg = messageMap.get(currentId);
      if (!msg) break;
      activePath.push(msg);
      currentId = msg.parentMessageId;
    }

    return activePath.reverse();
  } else if (isTreeSession) {
    // BUG-5 FIX: When a tree session has no activeMessageId (e.g. after a crash during
    // the first assistant reply save), walk to the deepest leaf of the most recent root chain
    // instead of returning an empty array.
    const messageMap = new Map<string, DbMessage>();
    dbMessages.forEach((m) => messageMap.set(m.id, m));

    const parentToChildren = new Map<string, DbMessage[]>();
    dbMessages.forEach((m) => {
      const parentKey = m.parentMessageId || "__root__";
      const children = parentToChildren.get(parentKey) || [];
      children.push(m);
      parentToChildren.set(parentKey, children);
    });

    // Find root messages (no parentMessageId)
    const roots = (parentToChildren.get("__root__") || []).sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    if (roots.length === 0) return dbMessages; // fallback: return all

    // Walk down the most recent root chain to the deepest leaf
    let currentId = roots[0].id;
    const activePath: DbMessage[] = [roots[0]];
    while (true) {
      const children = (parentToChildren.get(currentId) || []).sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime() // latest child first
      );
      if (children.length === 0) break;
      currentId = children[0].id;
      activePath.push(children[0]);
    }
    return activePath;
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
  parentMessageId?: string,
  replyToText?: string
): Promise<void> {
  const prisma = getPrisma();
  
  await prisma.message.upsert({
    where: { id },
    update: { 
      content,
      images: images || null,
      generatedImages: generatedImages || null,
      parentMessageId: parentMessageId || null,
      replyToText: replyToText || null,
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
      replyToText: replyToText || null,
    },
  });

  const currentSession = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { activeMessageId: true },
  });

  const shouldAdvanceActive =
    role === "user" ||
    !currentSession?.activeMessageId ||
    currentSession.activeMessageId === parentMessageId;

  const sessionUpdate: { updatedAt: Date; activeMessageId?: string } = { updatedAt: new Date() };
  if (shouldAdvanceActive) {
    sessionUpdate.activeMessageId = id;
  }
  await prisma.session.update({
    where: { id: sessionId },
    data: sessionUpdate,
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
    replyToText: m.replyToText || undefined,
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
      replyToText: m.replyToText || undefined,
    });
  });

  return {
    messages: messagesSlice,
    allMessages: Array.from(messageMap.values()),
    hasMore,
  };
}


