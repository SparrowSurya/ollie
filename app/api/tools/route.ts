import { agentTools } from "@/lib/tools";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const tools = agentTools.map((t) => ({
      name: t.name,
      description: t.description,
    }));
    return NextResponse.json({ tools });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("GET /api/tools error:", error);
    return NextResponse.json({ error: msg || "Failed to list tools" }, { status: 500 });
  }
}
