import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { OllamaService } from "@/lib/services/ollama";
import { logger } from "@/lib/logger";
import { RemoteModel } from "@/lib/config";

// Helper to format bytes to human readable sizes
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export async function GET(req: Request) {
  let model: string | null = null;
  try {
    const { searchParams } = new URL(req.url);
    model = searchParams.get("model");

    if (!model) {
      return NextResponse.json({ error: "Missing model parameter" }, { status: 400 });
    }

    logger.info(`Fetching details for model: "${model}"`);

    // Handle remote cloud models
    if (model.includes("/")) {
      const [provider] = model.split("/");
      let matchedModel: RemoteModel | undefined;

      try {
        const registryPath = path.join(process.cwd(), "config", "models-registry.json");
        const fileContent = await fs.readFile(registryPath, "utf-8");
        const remoteModels: RemoteModel[] = JSON.parse(fileContent);
        matchedModel = remoteModels.find((m) => m.id === model);
      } catch (err) {
        logger.error(`Failed to read models registry for detail lookup of "${model}":`, err);
      }

      const displayProvider =
        provider === "openai" ? "OpenAI" :
        provider === "anthropic" ? "Anthropic" :
        provider === "gemini" ? "Google Gemini" : provider;

      return NextResponse.json({
        name: model,
        size: "Cloud (N/A)",
        sizeInRam: "Cloud (N/A)",
        isLoaded: true,
        format: "API",
        family: displayProvider,
        quantization: "FP16 / API",
        capabilities: matchedModel?.capabilities || ["completion"],
      });
    }

    // 1. Fetch metadata details from Ollama /api/show
    const showData = await OllamaService.showModel(model);

    // 2. Fetch loaded models from Ollama /api/ps to verify loaded status
    let isLoaded = false;
    let sizeInRam = "0 B";

    try {
      const psData = await OllamaService.ps();
      const loadedMatch = psData.models?.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (m: any) => m.name === model || m.model === model
      );
      if (loadedMatch) {
        isLoaded = true;
        sizeInRam = formatBytes(loadedMatch.size_vram || loadedMatch.size || 0);
      }
    } catch (e) {
      logger.warning(`Failed to check loaded status from /api/ps for model "${model}": ${e instanceof Error ? e.message : String(e)}`);
    }

    // 3. Resolve exact file size on disk from Ollama tags registry
    let size = 0;
    try {
      const tagsData = await OllamaService.getTags();
      const matched = tagsData.models?.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (m: any) => m.name === model || m.model === model
      );
      if (matched) {
        size = matched.size || 0;
      }
    } catch (e) {
      logger.warning(`Failed to fetch model size from /api/tags for model "${model}": ${e instanceof Error ? e.message : String(e)}`);
    }
    const formattedSize = size ? formatBytes(size) : "Unknown";

    const capabilities = showData.capabilities || [];
    const details = showData.details || {};
    const families = details.families || (details.family ? [details.family] : []);
    const hasVision =
      capabilities.includes("vision") ||
      families.some((f: string) => f.toLowerCase().includes("clip") || f.toLowerCase().includes("mllama") || f.toLowerCase().includes("vision")) ||
      !!showData.projector_info;

    const finalCapabilities = [...capabilities];
    if (hasVision && !finalCapabilities.includes("vision")) {
      finalCapabilities.push("vision");
    }

    logger.info(`Successfully fetched details for model: "${model}" (Size: ${formattedSize}, Loaded: ${isLoaded})`);

    return NextResponse.json({
      name: model,
      size: formattedSize,
      sizeInRam,
      isLoaded,
      format: details.format || "Unknown",
      family: details.family || "Unknown",
      quantization: details.quantization_level || "Unknown",
      capabilities: finalCapabilities,
    });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    logger.error(`Error in /api/models/details for model "${model || "unknown"}":`, error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch model details" },
      { status: 500 }
    );
  }
}

