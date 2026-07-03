import { NextResponse } from "next/server";
import { streamAgentResponse } from "@/lib/agent";

export async function POST(req: Request) {
  try {
    const { content, threadId, model } = await req.json();

    if (!content) {
      return NextResponse.json({ error: "Missing content" }, { status: 400 });
    }

    // Default to a fallback session thread ID if not provided by client
    const activeThreadId = threadId ?? "default-session";

    // Call the streamAgentResponse from lib/agent.ts
    const stream = streamAgentResponse(content, activeThreadId, model);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
