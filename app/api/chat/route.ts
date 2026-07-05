import { NextResponse } from "next/server";
import { streamAgentResponse, getDefaultModel } from "@/lib/agent";
import { generateImage } from "@/lib/services/image-gen";
import { OllamaService } from "@/lib/services/ollama";

export async function POST(req: Request) {
  try {
    const { content, threadId, model, defaultImageModel, customInstructions, images } = await req.json();

    if (!content) {
      return NextResponse.json({ error: "Missing content" }, { status: 400 });
    }

    const activeThreadId = threadId ?? "default-session";
    const targetModel = model || (await getDefaultModel());

    const capabilities = await OllamaService.getModelCapabilities(targetModel);
    const isImageModel = capabilities.includes("image");
    const isChatSupported = capabilities.includes("completion");

    if (!isChatSupported && !isImageModel) {
      return NextResponse.json(
        { error: `Model "${targetModel}" is not supported (missing both chat and image generation capabilities).` },
        { status: 400 }
      );
    }

    // Handle Image Generation Model via dedicated image service
    if (isImageModel) {
      const data = await generateImage(content, activeThreadId, targetModel);
      return NextResponse.json(data);
    }

    // Handle standard Text Chat Model (stream response)
    const stream = streamAgentResponse(content, activeThreadId, targetModel, customInstructions, images, defaultImageModel);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
