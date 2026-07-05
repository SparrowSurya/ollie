import { NextResponse } from "next/server";
import { OllamaService } from "@/lib/services/ollama";

// Helper to format bytes to human readable sizes
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const model = searchParams.get("model");

    if (!model) {
      return NextResponse.json({ error: "Missing model parameter" }, { status: 400 });
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
      console.warn("Failed to check loaded status from /api/ps:", e);
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
      console.warn("Failed to fetch model size from /api/tags:", e);
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
    console.error("Error in /api/models/details:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch model details" },
      { status: 500 }
    );
  }
}
