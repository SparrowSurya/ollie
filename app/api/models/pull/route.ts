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

    logger.info(`Starting Ollama model pull stream for model: "${model}"`);

    // Set up abort synchronization between client request signal and Ollama fetch signal
    const abortController = new AbortController();
    req.signal.addEventListener("abort", () => {
      logger.warning(`Client disconnected. Aborting Ollama pull for model: "${model}"`);
      abortController.abort();
    });

    const ollamaRes = await OllamaService.pullStream(model, abortController.signal);

    if (!ollamaRes.body) {
      throw new Error("No response body from Ollama");
    }

    const reader = ollamaRes.body.getReader();
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              logger.info(`Ollama pull stream completed for model: "${model}"`);
              break;
            }
            controller.enqueue(value);
          }
          controller.close();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
          // If the pull was aborted by the client, ignore normal stream closure errors
          if (abortController.signal.aborted) {
            logger.info(`Ollama pull stream successfully aborted for: ${model}`);
            controller.close();
            return;
          }
          logger.error(`Error piping pull stream for model "${model}"`, err);
          controller.enqueue(encoder.encode(JSON.stringify({ error: err.message })));
          controller.close();
        }
      },
      cancel() {
        abortController.abort();
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error.name === "AbortError") {
      return NextResponse.json({ message: "Pull request aborted" });
    }
    logger.error(`Error in /api/models/pull for model: "${model || "unknown"}"`, error);
    return NextResponse.json(
      { error: error.message || "Failed to pull model" },
      { status: 500 }
    );
  }
}

