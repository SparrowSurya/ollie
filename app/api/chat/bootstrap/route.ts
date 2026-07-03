import { NextResponse } from "next/server";
import { bootstrapModel } from "@/lib/agent";

export async function POST(req: Request) {
  try {
    const { threadId, model } = await req.json();

    if (!threadId) {
      return NextResponse.json({ error: "Missing threadId" }, { status: 400 });
    }

    // Bypass actual Ollama pre-warming for mock test models
    if (model && typeof model === "string" && model.startsWith("mock-")) {
      // Simulate brief loading delay
      await new Promise((r) => setTimeout(r, 600));
    } else {
      // Call bootstrapModel from lib/agent.ts which blocks until loaded
      await bootstrapModel(threadId, model);
    }

    return NextResponse.json({ success: true, status: "ready" });
  } catch (error) {
    console.error("Bootstrap error:", error);
    return NextResponse.json(
      { error: "Failed to bootstrap model" },
      { status: 500 }
    );
  }
}
