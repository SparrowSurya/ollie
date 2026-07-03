import { NextResponse } from "next/server";
import readEnv from "@/lib/config";

const env = readEnv();

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
    const showRes = await fetch(`${env.ollamaHost}/api/show`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
    });

    if (!showRes.ok) {
      throw new Error(`Ollama show failed: ${showRes.statusText}`);
    }

    const showData = await showRes.json();

    // 2. Fetch loaded models from Ollama /api/ps to verify loaded status
    let isLoaded = false;
    let sizeInRam = "0 B";

    try {
      const psRes = await fetch(`${env.ollamaHost}/api/ps`);
      if (psRes.ok) {
        const psData = await psRes.json();
        const loadedMatch = psData.models?.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (m: any) => m.name === model || m.model === model
        );
        if (loadedMatch) {
          isLoaded = true;
          sizeInRam = formatBytes(loadedMatch.size_vram || loadedMatch.size || 0);
        }
      }
    } catch (e) {
      console.warn("Failed to check loaded status from /api/ps:", e);
    }

    // 3. Resolve exact file size on disk from Ollama tags registry
    let size = 0;
    try {
      const tagsRes = await fetch(`${env.ollamaHost}/api/tags`);
      if (tagsRes.ok) {
        const tagsData = await tagsRes.json();
        const matched = tagsData.models?.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (m: any) => m.name === model || m.model === model
        );
        if (matched) {
          size = matched.size || 0;
        }
      }
    } catch (e) {
      console.warn("Failed to fetch model size from /api/tags:", e);
    }
    const formattedSize = size ? formatBytes(size) : "Unknown";

    return NextResponse.json({
      name: model,
      size: formattedSize,
      sizeInRam,
      isLoaded,
      format: showData.details?.format || "Unknown",
      family: showData.details?.family || "Unknown",
      quantization: showData.details?.quantization_level || "Unknown",
      capabilities: showData.capabilities || [],
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
