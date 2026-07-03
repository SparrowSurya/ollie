import { NextResponse } from "next/server";
import { streamAgentResponse, getDefaultModel } from "@/lib/agent";
import readEnv from "@/lib/config";

const env = readEnv();

// Helper to determine if a local model supports chat completions
async function supportsChat(modelName: string): Promise<boolean> {
  try {
    const res = await fetch(`${env.ollamaHost}/api/show`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: modelName }),
    });

    if (!res.ok) return false;
    const data = await res.json();

    // Verify chat capability using Ollama's capabilities array
    const capabilities = data.capabilities || [];
    if (!capabilities.includes("completion")) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const { content, threadId, model } = await req.json();

    if (!content) {
      return NextResponse.json({ error: "Missing content" }, { status: 400 });
    }

    const activeThreadId = threadId ?? "default-session";
    const targetModel = model || (await getDefaultModel());

    // Pre-validate that the chosen model actually supports chat
    const isChatSupported = await supportsChat(targetModel);
    if (!isChatSupported) {
      return NextResponse.json(
        { error: `Model "${targetModel}" does not support chat completions.` },
        { status: 400 }
      );
    }

    // Call the streamAgentResponse from lib/agent.ts
    const stream = streamAgentResponse(content, activeThreadId, targetModel);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
