import { NextResponse } from "next/server";
import readEnv from "@/lib/config";

const env = readEnv();

// Registry of some suggested available models for users to pull
const REGISTRY_MODELS = [
  "deepseek-r1:1.5b",
  "deepseek-r1:8b",
  "llama3:8b",
  "qwen2.5-coder:7b",
  "gemma4:e2b",
];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const downloadedOnly = searchParams.get("downloaded") === "true";

    const res = await fetch(`${env.ollamaHost}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch models from Ollama: ${res.statusText}`);
    }

    const data = await res.json();
    const pulledModels = data.models?.map((m: {name: string}) => m.name) || [];

    if (downloadedOnly) {
      return NextResponse.json({ models: pulledModels });
    }

    // Merge pulled models with registry suggestions, removing duplicates
    const allModelsSet = new Set([...pulledModels, ...REGISTRY_MODELS]);
    return NextResponse.json({ models: Array.from(allModelsSet) });
  } catch (error) {
    console.error("Error in /api/models:", error);
    return NextResponse.json(
      { models: [], error: "Ollama host is unreachable. Please ensure the Ollama service is running." },
      { status: 503 }
    );
  }
}
