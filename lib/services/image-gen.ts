import readEnv from "@/lib/config";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { saveMessage, getSession, createSession } from "@/lib/db";

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
  prompt: string,
  activeThreadId: string,
  targetModel: string
): Promise<GeneratedImageResponse> {
  const ollamaRes = await fetch(`${env.ollamaHost}/v1/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: targetModel,
      prompt: prompt,
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
  const session = await getSession(activeThreadId);
  if (!session) {
    const title = prompt.length > 30 ? `${prompt.slice(0, 30)}...` : prompt;
    await createSession(activeThreadId, title, targetModel);
  }

  const userMsgId = crypto.randomUUID();
  const assistantMsgId = crypto.randomUUID();
  const imageUrlPath = `/api/uploads/${filename}`;

  // Save user prompt message
  await saveMessage(userMsgId, activeThreadId, "user", prompt, undefined, undefined);
  // Save assistant message with generatedImages field
  await saveMessage(
    assistantMsgId,
    activeThreadId,
    "assistant",
    `Generated image for prompt: "${prompt}"`,
    targetModel,
    undefined,
    imageUrlPath
  );

  return {
    content: `Generated image for prompt: "${prompt}"`,
    generatedImages: [imageUrlPath],
  };
}
