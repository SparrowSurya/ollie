import readEnv from "@/lib/config";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { saveMessage, getSession, createSession } from "@/lib/db";
import { logger } from "@/lib/logger";

const env = readEnv();

export interface GeneratedImageResponse {
  content: string;
  generatedImages: string[];
}

/**
 * Service to orchestrate local image generation using Ollama's image API,
 * write the output image to local storage, and log user/assistant messages in DB.
 */
export async function generateImage(
  prompts: string | { prompt: string }[],
  activeThreadId: string,
  targetModel: string,
  skipDbSave = false
): Promise<GeneratedImageResponse> {
  let promptList: string[] = [];
  if (typeof prompts === "string") {
    promptList = [prompts];
  } else if (Array.isArray(prompts)) {
    promptList = prompts.map((p) => p.prompt);
  }

  const numImages = promptList.length;

  logger.info(`Starting image generation using model "${targetModel}" (Session: "${activeThreadId}", Count: ${numImages})`);

  // Parallel fetch request for each image since Ollama API doesn't support multiple image generation in one call
  const fetchPromises = promptList.map(async (prompt, i) => {
    logger.info(`Sending image generation request ${i + 1}/${numImages} for prompt "${prompt}" in session "${activeThreadId}"...`);
    const ollamaRes = await fetch(`${env.ollamaHost}/v1/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: targetModel,
        prompt: prompt,
        n: 1, // each request generates 1 image
      }),
    });

    if (!ollamaRes.ok) {
      const errText = await ollamaRes.text().catch(() => "");
      const errorMsg = `Image ${i + 1}/${numImages} generation failed: ${errText || ollamaRes.statusText}`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    const ollamaData = await ollamaRes.json();
    const base64Data = ollamaData.data?.[0]?.b64_json;
    if (!base64Data) {
      const errorMsg = `Ollama returned empty image payload for image ${i + 1}/${numImages}`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }
    return base64Data;
  });

  const base64DataList = await Promise.all(fetchPromises);
  logger.info(`Successfully received all ${numImages} image payloads, converting and saving to local storage in parallel...`);

  const baseStorageDir = env.storagePath 
    ? path.resolve(env.storagePath) 
    : path.join(process.cwd(), "storage");
  const generatedDir = path.join(baseStorageDir, "generated");
  await fs.mkdir(generatedDir, { recursive: true });

  const savePromises = base64DataList.map(async (base64Data, i) => {
    const buffer = Buffer.from(base64Data, "base64");
    const timestamp = Date.now();
    const randInt = Math.floor(Math.random() * 10001);
    const filename = `${timestamp}_${randInt}_${i}.png`;
    const filePath = path.join(generatedDir, filename);

    await fs.writeFile(filePath, buffer);
    const imageUrlPath = `/api/uploads/${filename}`;
    logger.info(`Generated image ${i + 1}/${numImages} saved to disk as: "${filename}" (Path: "${filePath}")`);
    return imageUrlPath;
  });

  const imageUrlPaths = await Promise.all(savePromises);

  if (imageUrlPaths.length === 0) {
    const errorMsg = "Failed to parse and save generated images";
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  const imageUrlsString = imageUrlPaths.join(",");

  if (!skipDbSave) {
    // Ensure the session row exists in the database to avoid foreign key violations (P2003)
    const session = await getSession(activeThreadId);
    if (!session) {
      const firstPrompt = promptList[0] || "";
      const title = firstPrompt.length > 30 ? `${firstPrompt.slice(0, 30)}...` : firstPrompt;
      await createSession(activeThreadId, title, targetModel);
    }

    const userMsgId = crypto.randomUUID();
    const assistantMsgId = crypto.randomUUID();

    const userPromptText = promptList.join(" | ");

    // Save user prompt message
    await saveMessage(userMsgId, activeThreadId, "user", userPromptText, undefined, undefined);
    // Save assistant message with generatedImages field
    await saveMessage(
      assistantMsgId,
      activeThreadId,
      "assistant",
      "",
      targetModel,
      undefined,
      imageUrlsString
    );
  }

  return {
    content: "",
    generatedImages: imageUrlPaths,
  };
}

