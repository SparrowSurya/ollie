import { NextResponse } from "next/server";
import readEnv from "@/lib/config";

const env = readEnv();

export async function POST(req: Request) {
  try {
    const { model } = await req.json();
    if (!model) {
      return NextResponse.json({ error: "Missing model name" }, { status: 400 });
    }

    // Set up abort synchronization between client request signal and Ollama fetch signal
    const abortController = new AbortController();
    req.signal.addEventListener("abort", () => {
      console.log(`Client disconnected. Aborting Ollama pull for model: ${model}`);
      abortController.abort();
    });

    const ollamaRes = await fetch(`${env.ollamaHost}/api/pull`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: model, stream: true }),
      signal: abortController.signal,
    });

    if (!ollamaRes.ok) {
      const errText = await ollamaRes.text().catch(() => "");
      throw new Error(errText || `Ollama failed to start pull: ${ollamaRes.statusText}`);
    }

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
            if (done) break;
            controller.enqueue(value);
          }
          controller.close();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
          // If the pull was aborted by the client, ignore normal stream closure errors
          if (abortController.signal.aborted) {
            console.log(`Ollama pull stream successfully aborted for: ${model}`);
            controller.close();
            return;
          }
          console.error("Error piping pull stream:", err);
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
    console.error("Error in /api/models/pull:", error);
    return NextResponse.json(
      { error: error.message || "Failed to pull model" },
      { status: 500 }
    );
  }
}
