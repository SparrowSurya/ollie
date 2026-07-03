import { NextResponse } from "next/server";
import { OllamaService } from "@/lib/services/ollama";

// Helper to determine if a local model supports chat completions
async function supportsChat(modelName: string): Promise<boolean> {
  try {
    const data = await OllamaService.showModel(modelName);
    // Verify chat capability using Ollama's capabilities array
    const capabilities = data.capabilities || [];
    return capabilities.includes("completion");
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    const data = await OllamaService.getTags(AbortSignal.timeout(3000));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawPulledModels = data.models?.map((m: any) => m.name) || [];

    // Verify chat support in parallel for all locally pulled models
    const checkPromises = rawPulledModels.map(async (name: string) => {
      const ok = await supportsChat(name);
      return ok ? name : null;
    });
    const checkedResults = await Promise.all(checkPromises);
    const pulledModels = checkedResults.filter((name): name is string => name !== null);

    return NextResponse.json({ models: pulledModels });
  } catch (error) {
    console.error("Error in /api/models:", error);
    return NextResponse.json(
      { models: [], error: "Ollama host is unreachable. Please ensure the Ollama service is running." },
      { status: 503 }
    );
  }
}
