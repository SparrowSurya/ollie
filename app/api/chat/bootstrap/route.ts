import { NextResponse } from "next/server";
import { bootstrapModel } from "@/lib/agent";

export async function POST(req: Request) {
  try {
    const { threadId } = await req.json();

    if (!threadId) {
      return NextResponse.json({ error: "Missing threadId" }, { status: 400 });
    }

    // Call bootstrapModel from lib/agent.ts which blocks until loaded
    await bootstrapModel(threadId);

    return NextResponse.json({ success: true, status: "ready" });
  } catch (error) {
    console.error("Bootstrap error:", error);
    return NextResponse.json(
      { error: "Failed to bootstrap model" },
      { status: 500 }
    );
  }
}
