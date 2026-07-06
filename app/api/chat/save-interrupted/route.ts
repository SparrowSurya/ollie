import { NextResponse } from "next/server";
import { saveMessage } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function POST(req: Request) {
  try {
    const { threadId, content, model } = await req.json();

    if (!threadId) {
      return NextResponse.json({ error: "Missing threadId" }, { status: 400 });
    }

    const assistantMsgId = crypto.randomUUID();
    logger.info(`Saving interrupted assistant message [SessionID: "${threadId}", Length: ${content?.length ?? 0}]`);

    await saveMessage(
      assistantMsgId,
      threadId,
      "assistant",
      content || "",
      model,
      undefined,
      undefined
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    const err = error as { message?: string };
    logger.error("Failed to save interrupted message:", error);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
