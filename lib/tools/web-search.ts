import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { performWebSearch } from "../services/web-search";
import { logger } from "../logger";

export const webSearchTool = tool(
  async ({ query, maxResults }, config) => {
    const threadId = config.configurable?.thread_id ?? "default-session";
    try {
      logger.info(`Tool "web_search" execution start (Session: "${threadId}", Query: "${query}")`);
      const results = await performWebSearch(query, maxResults);
      logger.info(`Tool "web_search" execution completed successfully (Session: "${threadId}")`);
      return results;
    } catch (error) {
      logger.error(`Tool "web_search" execution failed (Session: "${threadId}"):`, error);
      const msg = error instanceof Error ? error.message : String(error);
      return `Failed to perform web search: ${msg}`;
    }
  },
  {
    name: "web_search",
    description: "Searches the web for real-time information, news, current events, or general knowledge. Use this tool whenever the user asks questions about facts, current events, or information not present in your local training data.",
    schema: z.object({
      query: z.string().describe("The search query to execute (e.g. 'current price of Bitcoin' or 'who won the latest Super Bowl')"),
      maxResults: z.number().optional().default(5).describe("Maximum number of search results to return"),
    }),
  }
);
