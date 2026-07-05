import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { generateImage } from "../services/image-gen";

export const imageGenTool = tool(
  async ({ prompt }, config) => {
    try {
      const threadId = config.configurable?.thread_id ?? "default-session";
      const imageModel = config.configurable?.image_model;

      if (!imageModel) {
        return "No model found for image generation. Please configure or pull a model capable of generating images.";
      }

      const response = await generateImage(prompt, threadId, imageModel, true);

      // Return only the raw markdown image tag
      return `![${prompt}](${response.generatedImages[0]})`;
    } catch (error) {
      console.error("Error inside imageGenTool execution:", error);
      const msg = error instanceof Error ? error.message : String(error);
      return `Failed to generate image: ${msg}`;
    }
  },
  {
    name: "generate_image",
    description: "Generates an image from a detailed descriptive text prompt. Use this tool whenever the user asks to draw, paint, generate, or create an image.",
    schema: z.object({
      prompt: z.string().describe("Detailed descriptive prompt for the image generation model (e.g. 'a golden retriever playing in a park, oil painting style')"),
    }),
  }
);
