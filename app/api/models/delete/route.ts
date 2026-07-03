import { NextResponse } from "next/server";
import readEnv from "@/lib/config";

const env = readEnv();

export async function POST(req: Request) {
  try {
    const { model } = await req.json();
    if (!model) {
      return NextResponse.json({ error: "Missing model name" }, { status: 400 });
    }

    const ollamaRes = await fetch(`${env.ollamaHost}/api/delete`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: model }),
    });

    if (!ollamaRes.ok) {
      const errText = await ollamaRes.text().catch(() => "");
      throw new Error(errText || `Ollama delete failed: ${ollamaRes.statusText}`);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error in /api/models/delete:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete model" },
      { status: 500 }
    );
  }
}
