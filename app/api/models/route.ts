import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { OllamaService } from "@/lib/services/ollama";
import readEnv, { RemoteModel } from "@/lib/config";

// Helper to fetch local model capabilities
async function getCapabilities(modelName: string): Promise<string[]> {
  try {
    const data = await OllamaService.showModel(modelName);
    return data.capabilities || [];
  } catch {
    return [];
  }
}

export async function GET() {
  const env = readEnv();
  const models: string[] = [];
  const imageModels: string[] = [];
  const disabledModels: string[] = [];
  let rawPulledModels: string[] = [];
  let ollamaError: string | undefined;

  // 1. Fetch Ollama models
  try {
    const data = await OllamaService.getTags(AbortSignal.timeout(3000));
    rawPulledModels = data.models?.map((m: { name: string }) => m.name) || [];

    // Verify capabilities in parallel for all locally pulled models
    await Promise.all(
      rawPulledModels.map(async (name: string) => {
        const capabilities = await getCapabilities(name);
        if (capabilities.includes("completion")) {
          models.push(name);
        }
        if (capabilities.includes("image")) {
          imageModels.push(name);
        }
      })
    );
  } catch (error) {
    console.error("Error fetching local Ollama models:", error);
    ollamaError = "Ollama host is unreachable. Local models are unavailable.";
  }

  // 2. Fetch remote models registry
  try {
    const registryPath = path.join(process.cwd(), "config", "models-registry.json");
    const fileContent = await fs.readFile(registryPath, "utf-8");
    const remoteModels: RemoteModel[] = JSON.parse(fileContent);

    for (const rm of remoteModels) {
      let isEnabled = false;
      if (rm.provider === "openai") isEnabled = !!env.openaiApiKey;
      else if (rm.provider === "anthropic") isEnabled = !!env.anthropicApiKey;
      else if (rm.provider === "gemini") isEnabled = !!env.geminiApiKey;

      models.push(rm.id);
      if (!isEnabled) {
        disabledModels.push(rm.id);
      }
    }
  } catch (error) {
    console.error("Failed to load remote models registry:", error);
  }

  return NextResponse.json({
    models,
    imageModels,
    allInstalledModels: rawPulledModels,
    disabledModels,
    error: ollamaError
  });
}
