import { NextResponse } from "next/server";
import { OllamaService } from "@/lib/services/ollama";
import { logger } from "@/lib/logger";

export async function POST(req: Request) {
  let model: string | null = null;
  try {
    const body = await req.json();
    model = body.model;
    if (!model) {
      return NextResponse.json({ error: "Missing model name" }, { status: 400 });
    }

    logger.info(`Deleting model: "${model}"`);
    await OllamaService.delete(model);
    logger.info(`Successfully deleted model: "${model}"`);

    return NextResponse.json({ success: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    logger.error(`Error in /api/models/delete for model: "${model || "unknown"}"`, error);
    return NextResponse.json(
      { error: error.message || "Failed to delete model" },
      { status: 500 }
    );
  }
}

