import { NextResponse } from "next/server";
import { bootstrapModel, getDefaultModel } from "@/lib/agent";
import { createSession, createMcpServer } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { threadId, model, customInstructions, mcpServers } = await req.json();

    if (!threadId) {
      return NextResponse.json({ error: "Missing threadId" }, { status: 400 });
    }

    // 1. Create the session in the database immediately so foreign key constraints are satisfied
    const targetModel = model || (await getDefaultModel());
    await createSession(threadId, "New Chat", targetModel, customInstructions || "");

    // 2. If MCP servers array is specified, store them
    if (Array.isArray(mcpServers)) {
      for (const srv of mcpServers) {
        if (srv.name?.trim() && srv.url?.trim()) {
          try {
            new URL(srv.url.trim());
            await createMcpServer(threadId, srv.name.trim(), srv.url.trim());
          } catch {
            // Log URL validation issues but don't fail boot
            console.error("Invalid MCP URL passed in bootstrap setup:", srv.url);
          }
        }
      }
    }

    // 3. Call bootstrapModel from lib/agent.ts which blocks until loaded
    await bootstrapModel(threadId, targetModel);

    return NextResponse.json({ success: true, status: "ready" });
  } catch (error) {
    console.error("Bootstrap error:", error);
    return NextResponse.json(
      { error: "Failed to bootstrap model" },
      { status: 500 }
    );
  }
}
