import { NextResponse } from "next/server";
import { getMessages, getSession, getAllSessionMessages, updateActiveMessage, getMessagesPaginated } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const limitParam = searchParams.get("limit");
    const cursor = searchParams.get("cursor") || undefined;

    if (!id) {
      return NextResponse.json({ error: "Missing session id parameter" }, { status: 400 });
    }

    const session = await getSession(id);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (limitParam) {
      const limit = parseInt(limitParam, 10) || 25;
      const { messages, allMessages, hasMore } = await getMessagesPaginated(id, limit, cursor);
      return NextResponse.json({ messages, allMessages, hasMore, model: session.model });
    } else {
      const messages = await getMessages(id);
      const allMessages = await getAllSessionMessages(id);
      return NextResponse.json({ messages, allMessages, hasMore: false, model: session.model });
    }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("API GET /api/sessions/messages error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to retrieve messages" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const { sessionId, activeMessageId, leafWalk } = await req.json();

    if (!sessionId || activeMessageId === undefined) {
      return NextResponse.json({ error: "Missing sessionId or activeMessageId parameters" }, { status: 400 });
    }

    await updateActiveMessage(sessionId, activeMessageId, !!leafWalk);
    return NextResponse.json({ success: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("API PATCH /api/sessions/messages error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update active message" },
      { status: 500 }
    );
  }
}

