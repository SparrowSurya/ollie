import { NextResponse } from "next/server";
import { OllamaService } from "@/lib/services/ollama";

export async function POST(req: Request) {
  try {
    const { model } = await req.json();
    if (!model) {
      return NextResponse.json({ error: "Missing model name" }, { status: 400 });
    }

    await OllamaService.delete(model);

    return NextResponse.json({ success: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("Error in /api/models/delete:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete model" },
      { status: 500 }
    );
  }
}
