import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { generateImage } from "../services/image-gen";
import { logger } from "../logger";

export const imageGenTool = tool(
  async ({ prompts }, config) => {
    const threadId = config.configurable?.thread_id ?? "default-session";
    const imageModel = config.configurable?.image_model;
    try {
      logger.info(`Tool "generate_image" execution start (Session: "${threadId}", Model: "${imageModel || "none"}", Count: ${prompts.length})`);

      if (!imageModel) {
        const errorMsg = "No model found for image generation. Please configure or pull a model capable of generating images.";
        logger.warning(`Tool "generate_image" aborted: ${errorMsg}`);
        return errorMsg;
      }

      const response = await generateImage(prompts, threadId, imageModel, true);

      logger.info(`Tool "generate_image" execution completed successfully (Session: "${threadId}")`);
      // Return raw markdown image tags for all generated images
      return response.generatedImages.map((url, i) => `![${prompts[i].prompt}](${url})`).join("\n");
    } catch (error) {
      logger.error(`Tool "generate_image" execution failed (Session: "${threadId}"):`, error);
      const msg = error instanceof Error ? error.message : String(error);
      return `Failed to generate image: ${msg}`;
    }
  },
  {
    name: "generate_image",
    description: "Generates one or more images from detailed descriptive text prompts in parallel. Use this tool whenever the user asks to draw, paint, generate, or create images.",
    schema: z.object({
      prompts: z.array(
        z.object({
          prompt: z.string().describe("Detailed descriptive prompt for the image generation model (e.g. 'a golden retriever playing in a park, oil painting style')"),
        })
      ).describe("List of prompts to generate in parallel"),
    }),
  }
);

