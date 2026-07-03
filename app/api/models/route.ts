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

// Helper to determine if a local model supports chat completions
async function supportsChat(modelName: string): Promise<boolean> {
  try {
    const res = await fetch(`${env.ollamaHost}/api/show`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: modelName }),
    });

    if (!res.ok) return false;
    const data = await res.json();

    // Verify chat capability using Ollama's capabilities array
    const capabilities = data.capabilities || [];
    if (!capabilities.includes("completion")) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawPulledModels = data.models?.map((m: any) => m.name) || [];

    // Verify chat support in parallel for all locally pulled models
    const checkPromises = rawPulledModels.map(async (name: string) => {
      const ok = await supportsChat(name);
      return ok ? name : null;
    });
    const checkedResults = await Promise.all(checkPromises);
    const pulledModels = checkedResults.filter((name): name is string => name !== null);

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
