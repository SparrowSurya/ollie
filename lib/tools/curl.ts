import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { logger } from "../logger";

export const curlTool = tool(
  async ({ url, method = "GET", headers = {}, body }, config) => {
    const threadId = config.configurable?.thread_id ?? "default-session";
    try {
      logger.info(`Tool "curl" execution start (Session: "${threadId}", URL: "${url}", Method: "${method}")`);
      const response = await fetch(url, {
        method,
        headers: headers as Record<string, string>,
        body: body ? body : undefined,
      });

      const text = await response.text();
      const result = JSON.stringify({
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: text,
      });
      logger.info(`Tool "curl" execution completed successfully (Session: "${threadId}", Status: ${response.status})`);
      return result;
    } catch (error) {
      logger.error(`Tool "curl" execution failed (Session: "${threadId}", URL: "${url}"):`, error);
      return `Error fetching URL "${url}": ${error instanceof Error ? error.message : String(error)}`;
    }
  },
  {
    name: "curl",
    description: "Fetches text or API response data from a specified URL. Supports standard HTTP methods, headers, and body payload.",
    schema: z.object({
      url: z.string().url().describe("The absolute URL to fetch (e.g. 'https://api.github.com/repos/node/node')"),
      method: z
        .enum(["GET", "POST", "PUT", "DELETE"])
        .optional()
        .default("GET")
        .describe("The HTTP method to use (default: GET)"),
      headers: z.record(z.string(), z.string()).optional().describe("Optional HTTP request headers as key-value pairs"),
      body: z.string().optional().describe("Optional HTTP request body payload"),
    }),
  }
);
