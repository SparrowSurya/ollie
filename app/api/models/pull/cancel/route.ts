import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { activePullControllers } from "@/lib/services/ollama-pull-state";

export async function POST(req: Request) {
  try {
    const { model } = await req.json();
    if (!model) {
      return NextResponse.json({ error: "Missing model name" }, { status: 400 });
    }

    logger.info(`Received cancel request for model pull: "${model}"`);

    const abortController = activePullControllers.get(model);
    if (abortController) {
      abortController.abort();
      activePullControllers.delete(model);
      logger.info(`Successfully aborted pull stream and closed connection to Ollama for model: "${model}"`);
      return NextResponse.json({ success: true, message: "Pull cancelled successfully" });
    } else {
      logger.warning(`No active pull stream found to cancel for model: "${model}"`);
      return NextResponse.json({ success: false, message: "No active pull process found" });
    }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    logger.error("Error in /api/models/pull/cancel:", error);
    return NextResponse.json(
      { error: error.message || "Failed to cancel pull" },
      { status: 500 }
    );
  }
}
