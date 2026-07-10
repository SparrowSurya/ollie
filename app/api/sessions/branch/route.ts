import { NextResponse } from "next/server";
import { getPrisma, getMessages, getSession } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function POST(req: Request) {
  try {
    const { sessionId, messageId } = await req.json();

    if (!sessionId || !messageId) {
      return NextResponse.json(
        { error: "Missing sessionId or messageId parameters" },
        { status: 400 }
      );
    }

    const prisma = getPrisma();

    // 1. Fetch old session
    const oldSession = await getSession(sessionId);
    if (!oldSession) {
      return NextResponse.json({ error: "Source session not found" }, { status: 404 });
    }

    // 2. Fetch full active path
    const fullPath = await getMessages(sessionId);
    const targetIndex = fullPath.findIndex((m) => m.id === messageId);
    if (targetIndex === -1) {
      return NextResponse.json(
        { error: "Target message not found in active path" },
        { status: 404 }
      );
    }

    // Slice history up to and including the target message
    const activePathPrefix = fullPath.slice(0, targetIndex + 1);

    // 3. Create new session
    const newSessionId = crypto.randomUUID();
    const newTitle = `Branch of ${oldSession.title}`;

    await prisma.session.create({
      data: {
        id: newSessionId,
        title: newTitle,
        model: oldSession.model,
        customInstructions: oldSession.customInstructions || null,
        activeMessageId: null, // will update after creating messages
      },
    });

    // 4. Duplicate messages and map IDs to preserve tree structure
    const idMap = new Map<string, string>();
    for (const oldMsg of activePathPrefix) {
      const newMsgId = crypto.randomUUID();
      idMap.set(oldMsg.id, newMsgId);

      const newParentId = oldMsg.parentMessageId ? idMap.get(oldMsg.parentMessageId) : null;

      await prisma.message.create({
        data: {
          id: newMsgId,
          sessionId: newSessionId,
          role: oldMsg.role,
          content: oldMsg.content,
          images: oldMsg.images || null,
          generatedImages: oldMsg.generatedImages || null,
          modelName: oldMsg.modelName || null,
          parentMessageId: newParentId || null,
          timestamp: oldMsg.timestamp,
        },
      });
    }

    // 5. Update activeMessageId of new session to the newly duplicated target message ID
    const newActiveMessageId = idMap.get(messageId);
    if (newActiveMessageId) {
      await prisma.session.update({
        where: { id: newSessionId },
        data: { activeMessageId: newActiveMessageId },
      });
    }

    logger.info(`Session branched [SourceSessionID: ${sessionId}, TargetMsgID: ${messageId}, NewSessionID: ${newSessionId}, NewActiveMsgID: ${newActiveMessageId}]`);

    return NextResponse.json({ success: true, newSessionId });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    logger.error("API POST /api/sessions/branch error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to branch session" },
      { status: 500 }
    );
  }
}
