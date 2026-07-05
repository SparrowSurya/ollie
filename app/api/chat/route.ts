import { NextResponse } from "next/server";
import { streamAgentResponse, getDefaultModel } from "@/lib/agent";
import readEnv from "@/lib/config";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { saveMessage, getSession, createSession } from "@/lib/db";

const env = readEnv();

// Helper to fetch local model capabilities
async function getModelCapabilities(modelName: string): Promise<string[]> {
  try {
    const res = await fetch(`${env.ollamaHost}/api/show`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: modelName }),
    });

    if (!res.ok) return [];
    const data = await res.json();
    return data.capabilities || [];
  } catch {
    return [];
  }
}

export async function POST(req: Request) {
  try {
    const { content, threadId, model, customInstructions, images } = await req.json();

    if (!content) {
      return NextResponse.json({ error: "Missing content" }, { status: 400 });
    }

    const activeThreadId = threadId ?? "default-session";
    const targetModel = model || (await getDefaultModel());

    const capabilities = await getModelCapabilities(targetModel);
    const isImageModel = capabilities.includes("image");
    const isChatSupported = capabilities.includes("completion");

    if (!isChatSupported && !isImageModel) {
      return NextResponse.json(
        { error: `Model "${targetModel}" is not supported (missing both chat and image generation capabilities).` },
        { status: 400 }
      );
    }

    // Handle Image Generation Model
    if (isImageModel) {
      const ollamaRes = await fetch(`${env.ollamaHost}/v1/images/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: targetModel,
          prompt: content,
          n: 1,
        }),
      });

      if (!ollamaRes.ok) {
        const errText = await ollamaRes.text().catch(() => "");
        throw new Error(`Ollama image generation failed: ${errText || ollamaRes.statusText}`);
      }

      const ollamaData = await ollamaRes.json();
      const base64Data = ollamaData.data?.[0]?.b64_json;
      if (!base64Data) {
        throw new Error("Ollama returned empty image payload");
      }

      const buffer = Buffer.from(base64Data, "base64");

      const baseStorageDir = env.storagePath 
        ? path.resolve(env.storagePath) 
        : path.join(process.cwd(), "storage");
      const generatedDir = path.join(baseStorageDir, "generated");
      await fs.mkdir(generatedDir, { recursive: true });

      const timestamp = Date.now();
      const randInt = Math.floor(Math.random() * 10001);
      const filename = `${timestamp}_${randInt}.png`;
      const filePath = path.join(generatedDir, filename);

      await fs.writeFile(filePath, buffer);

      // Ensure the session row exists in the database to avoid foreign key violations (P2003)
      let session = await getSession(activeThreadId);
      if (!session) {
        const title = content.length > 30 ? `${content.slice(0, 30)}...` : content;
        await createSession(activeThreadId, title, targetModel);
      }

      const userMsgId = crypto.randomUUID();
      const assistantMsgId = crypto.randomUUID();
      const imageUrlPath = `/api/uploads/${filename}`;

      // Save user prompt message
      await saveMessage(userMsgId, activeThreadId, "user", content, undefined, undefined);
      // Save assistant message with generatedImages field
      await saveMessage(
        assistantMsgId,
        activeThreadId,
        "assistant",
        `Generated image for prompt: "${content}"`,
        targetModel,
        undefined,
        imageUrlPath
      );

      return NextResponse.json({
        content: `Generated image for prompt: "${content}"`,
        generatedImages: [imageUrlPath],
      });
    }

    // Handle standard Text Chat Model (stream response)
    const stream = streamAgentResponse(content, activeThreadId, targetModel, customInstructions, images);

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
