import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { logger } from "../logger";

export const datetimeTool = tool(
  async ({ timezone }, config) => {
    const threadId = config.configurable?.thread_id ?? "default-session";
    try {
      logger.info(`Tool "datetime" execution start (Session: "${threadId}", Timezone: "${timezone || "default"}")`);
      const options: Intl.DateTimeFormatOptions = {
        dateStyle: "full",
        timeStyle: "long",
        timeZone: timezone || undefined,
      };
      const formatter = new Intl.DateTimeFormat("en-US", options);
      const now = new Date();
      const result = `Current date and time: ${formatter.format(now)}`;
      logger.info(`Tool "datetime" execution completed successfully (Session: "${threadId}")`);
      return result;
    } catch (error) {
      logger.error(`Tool "datetime" execution failed (Session: "${threadId}"):`, error);
      const now = new Date();
      return `Current date and time (UTC): ${now.toUTCString()} (Error applying timezone: ${
        error instanceof Error ? error.message : String(error)
      })`;
    }
  },
  {
    name: "datetime",
    description: "Returns the current date and time on the server, optionally formatted according to a specific timezone.",
    schema: z.object({
      timezone: z
        .string()
        .optional()
        .describe("IANA Time Zone name (e.g. 'UTC', 'America/New_York', 'Asia/Kolkata'). Defaults to server's local timezone."),
    }),
  }
);
