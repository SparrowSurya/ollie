import { NextResponse } from "next/server";
import { getMessages, getSession } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing session id parameter" }, { status: 400 });
    }

    const session = await getSession(id);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const messages = await getMessages(id);
    return NextResponse.json({ messages, model: session.model });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("API GET /api/sessions/messages error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to retrieve messages" },
      { status: 500 }
    );
  }
}
