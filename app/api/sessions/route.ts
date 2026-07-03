import { NextResponse } from "next/server";
import { listSessions, deleteSession, updateSessionModel, updateSessionTitle, createSession, getSession } from "@/lib/db";

export async function GET() {
  try {
    const sessions = await listSessions();
    return NextResponse.json({ sessions });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("API GET /api/sessions error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to retrieve sessions" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing session id parameter" }, { status: 400 });
    }

    await deleteSession(id);
    return NextResponse.json({ success: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("API DELETE /api/sessions error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete session" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, model, title } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Missing session id parameter" }, { status: 400 });
    }

    const session = await getSession(id);
    if (!session) {
      // If it doesn't exist, create it first
      await createSession(id, title || "New Chat", model || "llama3");
    } else {
      if (model !== undefined) {
        await updateSessionModel(id, model);
      }
      if (title !== undefined) {
        await updateSessionTitle(id, title);
      }
    }

    return NextResponse.json({ success: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("API PATCH /api/sessions error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update session" },
      { status: 500 }
    );
  }
}
