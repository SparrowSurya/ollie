import { NextResponse } from "next/server";
import { OllamaService } from "@/lib/services/ollama";

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
  try {
    const data = await OllamaService.getTags(AbortSignal.timeout(3000));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawPulledModels = data.models?.map((m: any) => m.name) || [];

    const models: string[] = [];
    const imageModels: string[] = [];

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

    return NextResponse.json({ models, imageModels, allInstalledModels: rawPulledModels });
  } catch (error) {
    console.error("Error in /api/models:", error);
    return NextResponse.json(
      { models: [], imageModels: [], allInstalledModels: [], error: "Ollama host is unreachable. Please ensure the Ollama service is running." },
      { status: 503 }
    );
  }
}
