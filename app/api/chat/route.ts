import { NextResponse } from "next/server";
import { streamAgentResponse, getDefaultModel } from "@/lib/agent";
import { generateImage } from "@/lib/services/image-gen";
import { OllamaService } from "@/lib/services/ollama";
import { logger } from "@/lib/logger";

export async function POST(req: Request) {
  let activeThreadId = "default-session";
  let targetModel = "unknown";
  try {
    const { content, threadId, model, defaultImageModel, customInstructions, images, enabledTools, nickname, aboutMe } = await req.json();

    if (!content) {
      return NextResponse.json({ error: "Missing content" }, { status: 400 });
    }

    activeThreadId = threadId ?? "default-session";
    targetModel = model || (await getDefaultModel());

    logger.info(`Received chat request [SessionID: "${activeThreadId}", Model: "${targetModel}", UploadedImagesCount: ${images?.length ?? 0}]`);

    const capabilities = await OllamaService.getModelCapabilities(targetModel);
    logger.info(`Model capabilities checked for "${targetModel}": [${capabilities.join(", ")}]`);

    const isImageModel = capabilities.includes("image");
    const isChatSupported = capabilities.includes("completion");

    if (!isChatSupported && !isImageModel) {
      logger.warning(`Model "${targetModel}" is not supported (missing both chat and image capabilities)`);
      return NextResponse.json(
        { error: `Model "${targetModel}" is not supported (missing both chat and image generation capabilities).` },
        { status: 400 }
      );
    }

    // Handle Image Generation Model via dedicated image service
    if (isImageModel) {
      logger.info(`Routing request to Image Generator (Model: "${targetModel}", SessionID: "${activeThreadId}")`);
      const data = await generateImage([{ prompt: content }], activeThreadId, targetModel, false, customInstructions, images);
      return NextResponse.json(data);
    }

    // Handle standard Text Chat Model (stream response)
    logger.info(`Routing request to Text Agent Response Stream (Model: "${targetModel}", SessionID: "${activeThreadId}")`);
    const stream = streamAgentResponse(
      content,
      activeThreadId,
      targetModel,
      customInstructions,
      images,
      defaultImageModel,
      enabledTools,
      req.signal,
      nickname,
      aboutMe
    );

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    logger.error(`Chat API error [SessionID: "${activeThreadId}", Model: "${targetModel}"]:`, error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

