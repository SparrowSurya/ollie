import { ChatOllama } from "@langchain/ollama";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { MessagesAnnotation, StateGraph, MemorySaver } from "@langchain/langgraph";
import { HumanMessage, SystemMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import path from "path";
import fs from "fs/promises";
import readEnv, { getToolStatus, RemoteModel } from "./config";
import { createSession, getSession, updateSessionTitle, updateSessionModel, getMessages, saveMessage, listMcpServers } from "./db";
import { agentTools } from "./tools";
import { logger } from "./logger";

// Read current environment host configuration
const env = readEnv();

// Helper function to fetch the first available pulled model name dynamically
export async function getDefaultModel(): Promise<string> {
  // 1. Try local Ollama first
  try {
    const res = await fetch(`${env.ollamaHost}/api/tags`);
    if (res.ok) {
      const data = await res.json();
      if (data.models && data.models.length > 0) {
        return data.models[0].name;
      }
    }
  } catch {
    logger.warning("Ollama not reachable during getDefaultModel check, falling back to remote models");
  }

  // 2. Fall back to first enabled remote model in the registry
  try {
    const registryPath = path.join(process.cwd(), "config", "models-registry.json");
    const fileContent = await fs.readFile(registryPath, "utf-8");
    const remoteModels: RemoteModel[] = JSON.parse(fileContent);
    for (const m of remoteModels) {
      let isEnabled = false;
      if (m.provider === "openai") isEnabled = !!env.openaiApiKey;
      else if (m.provider === "anthropic") isEnabled = !!env.anthropicApiKey;
      else if (m.provider === "gemini") isEnabled = !!env.geminiApiKey;

      if (isEnabled) {
        return m.id;
      }
    }
  } catch (err) {
    logger.error("Failed to load remote models during getDefaultModel fallback:", err);
  }

  throw new Error("No models are available. Please ensure Ollama is running or configure remote API keys in the environment.");
}

// Helper function to check if a model supports thinking capability
async function supportsThinking(modelName: string): Promise<boolean> {
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

    const capabilities = data.capabilities || [];
    return capabilities.includes("thinking");
  } catch {
    return false;
  }
}

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildMessageContent(text: string, imageUrls?: string[]): Promise<any> {
  if (!imageUrls || imageUrls.length === 0) {
    return text;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contentParts: any[] = [{ type: "text", text }];

  for (const imgUrl of imageUrls) {
    if (!imgUrl.trim()) continue;
    try {
      const filename = path.basename(imgUrl);
      const baseStorageDir = env.storagePath
        ? path.resolve(env.storagePath)
        : path.join(process.cwd(), "storage");
      const filePath = path.join(baseStorageDir, "upload", filename);

      const fileBuffer = await fs.readFile(filePath);
      const ext = path.extname(filename).toLowerCase();
      const mimeType = MIME_TYPES[ext] || "image/jpeg";
      const base64Data = fileBuffer.toString("base64");

      contentParts.push({
        type: "image_url",
        image_url: {
          url: `data:${mimeType};base64,${base64Data}`,
        },
      });
    } catch (err) {
      logger.error(`Failed to read image ${imgUrl} for model content:`, err);
    }
  }

  return contentParts;
}

// MCP Integration Helpers
interface McpJsonSchema {
  type?: string;
  description?: string;
  nullable?: boolean;
  items?: McpJsonSchema;
  properties?: Record<string, McpJsonSchema>;
  required?: string[];
}

interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

function jsonSchemaToZod(schema: McpJsonSchema | undefined): z.ZodType<unknown> {
  if (!schema) return z.any();

  switch (schema.type) {
    case "string": {
      let zString = z.string();
      if (schema.description) zString = zString.describe(schema.description);
      return schema.nullable ? zString.nullable() : zString;
    }
    case "number":
    case "integer": {
      let zNumber = z.number();
      if (schema.description) zNumber = zNumber.describe(schema.description);
      return schema.nullable ? zNumber.nullable() : zNumber;
    }
    case "boolean": {
      let zBoolean = z.boolean();
      if (schema.description) zBoolean = zBoolean.describe(schema.description);
      return schema.nullable ? zBoolean.nullable() : zBoolean;
    }
    case "array": {
      let zArray = z.array(jsonSchemaToZod(schema.items));
      if (schema.description) zArray = zArray.describe(schema.description);
      return schema.nullable ? zArray.nullable() : zArray;
    }
    case "object": {
      const shape: Record<string, z.ZodType<unknown>> = {};
      if (schema.properties) {
        for (const [key, value] of Object.entries(schema.properties)) {
          let fieldSchema = jsonSchemaToZod(value);
          const isRequired = Array.isArray(schema.required) && schema.required.includes(key);
          if (!isRequired) {
            fieldSchema = fieldSchema.optional();
          }
          shape[key] = fieldSchema;
        }
      }
      let zObject = z.object(shape);
      if (schema.description) zObject = zObject.describe(schema.description);
      return schema.nullable ? zObject.nullable() : zObject;
    }
    default: {
      return z.any();
    }
  }
}

async function fetchMcpTools(url: string): Promise<McpToolDefinition[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let transport: any = null;
  try {
    const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
    const { StreamableHTTPClientTransport } = await import("@modelcontextprotocol/sdk/client/streamableHttp.js");

    const connectPromise = async () => {
      transport = new StreamableHTTPClientTransport(new URL(url));
      const client = new Client({ name: "Ollie-Client", version: "1.0.0" });
      await client.connect(transport);
      const response = await client.listTools();
      await transport.close();
      return (response.tools as McpToolDefinition[]) || [];
    };

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`MCP connection timeout after ${env.mcpConnectionTimeoutMs}ms`)), env.mcpConnectionTimeoutMs)
    );

    return await Promise.race([connectPromise(), timeoutPromise]);
  } catch (error) {
    logger.error(`Failed to fetch tools from MCP server at ${url}:`, error);
    if (transport) {
      try {
        await transport.close();
      } catch {}
    }
    return [];
  }
}

// Node function: calls the model dynamically with the configured model name
const callModel = async (state: typeof MessagesAnnotation.State, config?: RunnableConfig) => {
  const modelName = config?.configurable?.model_name || (await getDefaultModel());
  const customInstructions = config?.configurable?.custom_instructions;
  const isRemoteModel = modelName.includes("/");

  let chatModel: ChatOpenAI | ChatAnthropic | ChatGoogleGenerativeAI | ChatOllama;
  if (isRemoteModel) {
    const [provider, name] = modelName.split("/");
    const currentEnv = readEnv();
    if (provider === "openai") {
      if (!currentEnv.openaiApiKey) {
        throw new Error("OPENAI_API_KEY environment variable is not configured on the server.");
      }
      chatModel = new ChatOpenAI({
        model: name,
        apiKey: currentEnv.openaiApiKey,
        streaming: true,
      });
    } else if (provider === "anthropic") {
      if (!currentEnv.anthropicApiKey) {
        throw new Error("ANTHROPIC_API_KEY environment variable is not configured on the server.");
      }
      chatModel = new ChatAnthropic({
        model: name,
        apiKey: currentEnv.anthropicApiKey,
        streaming: true,
      });
    } else if (provider === "gemini") {
      if (!currentEnv.geminiApiKey) {
        throw new Error("GEMINI_API_KEY environment variable is not configured on the server.");
      }
      chatModel = new ChatGoogleGenerativeAI({
        model: name,
        apiKey: currentEnv.geminiApiKey,
        streaming: true,
      });
    } else {
      throw new Error(`Unsupported remote model provider: ${provider}`);
    }
  } else {
    const hasThinking = await supportsThinking(modelName);
    const ollamaModel = new ChatOllama({
      model: modelName,
      baseUrl: env.ollamaHost,
      keepAlive: env.keepAlive,
      ...(hasThinking ? { think: true } : {}),
    });

    // Patch client.chat to merge consecutive user messages (due to LangChain splitting content parts)
    const originalChat = ollamaModel.client.chat.bind(ollamaModel.client);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ollamaModel.client as any).chat = async function (args: any) {
      if (args && Array.isArray(args.messages)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mergedMessages: any[] = [];
        for (const msg of args.messages) {
          if (
            mergedMessages.length > 0 &&
            msg.role === "user" &&
            mergedMessages[mergedMessages.length - 1].role === "user"
          ) {
            const prevMsg = mergedMessages[mergedMessages.length - 1];
            prevMsg.content = (prevMsg.content || "") + (msg.content || "");
            if (msg.images) {
              prevMsg.images = [...(prevMsg.images || []), ...msg.images];
            }
          } else {
            mergedMessages.push({ ...msg });
          }
        }
        args.messages = mergedMessages;
      }
      return originalChat(args);
    };

    chatModel = ollamaModel;
  }

  const threadId = config?.configurable?.thread_id;
  const currentEnv = readEnv();

  // 1. Fetch MCP servers for this session
  const mcpServers = threadId
    ? await listMcpServers(threadId)
    : [];

  // 2. Fetch and convert MCP tools
  const mcpTools: ReturnType<typeof tool>[] = [];
  for (const server of mcpServers) {
    const tools = await fetchMcpTools(server.url);
    for (const t of tools) {
      if (getToolStatus(t.name, currentEnv) === "DISABLED") {
        continue;
      }
      let zodSchema = jsonSchemaToZod(t.inputSchema as McpJsonSchema | undefined);
      if (!(zodSchema instanceof z.ZodObject)) {
        zodSchema = z.object({});
      }
      const langchainTool = tool(async () => {}, {
        name: t.name,
        description: t.description || "",
        schema: zodSchema,
      });
      mcpTools.push(langchainTool);
    }
  }

  const enabledTools = config?.configurable?.enabled_tools as string[] | undefined;

  // Filter standard tools:
  // - If DISABLED: do not bind.
  // - If ENABLED: always bind (enabled by default).
  // - If MANUAL: bind only if the user explicitly enabled/selected it in the UI.
  const standardToolsToBind = agentTools.filter((t) => {
    const status = getToolStatus(t.name, currentEnv);
    if (status === "DISABLED") {
      return false;
    }
    if (status === "ENABLED") {
      return true;
    }
    if (status === "MANUAL") {
      return enabledTools ? enabledTools.includes(t.name) : false;
    }
    return false;
  });

  // Combine standard and MCP tools
  const toolsToBind = [...standardToolsToBind, ...mcpTools];

  const dynamicModel = toolsToBind.length > 0 ? chatModel.bindTools(toolsToBind) : chatModel;

  let messages = state.messages;
  if (customInstructions && typeof customInstructions === "string" && customInstructions.trim()) {
    messages = [new SystemMessage(customInstructions), ...messages];
  }

  const response = await dynamicModel.invoke(messages, config);
  return { messages: [response] };
};

// Define custom tool execution node
const callToolsNode = async (state: typeof MessagesAnnotation.State, config?: RunnableConfig) => {
  const lastMessage = state.messages[state.messages.length - 1];
  if (!lastMessage || !("tool_calls" in lastMessage) || !Array.isArray(lastMessage.tool_calls)) {
    return { messages: [] };
  }

  const threadId = config?.configurable?.thread_id;

  // Fetch MCP servers for this session
  const mcpServers = threadId
    ? await listMcpServers(threadId)
    : [];

  const currentEnv = readEnv();

  const toolOutputs = await Promise.all(
    lastMessage.tool_calls.map(async (toolCall) => {
      // Check if tool is disabled via environment variables
      if (getToolStatus(toolCall.name, currentEnv) === "DISABLED") {
        return new ToolMessage({
          name: toolCall.name,
          content: `Error: Tool "${toolCall.name}" is disabled by server configuration.`,
          tool_call_id: toolCall.id!,
        });
      }

      // Try finding in standard agent tools first
      const standardTool = agentTools.find((t) => t.name === toolCall.name);
      if (standardTool) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await (standardTool as any).invoke(toolCall.args);
          const content = typeof result === "string" ? result : JSON.stringify(result);
          return new ToolMessage({
            name: toolCall.name,
            content,
            tool_call_id: toolCall.id!,
          });
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          return new ToolMessage({
            name: toolCall.name,
            content: `Error executing tool: ${errMsg}`,
            tool_call_id: toolCall.id!,
          });
        }
      }

      // Look in MCP servers
      for (const server of mcpServers) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let transport: any = null;
        try {
          const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
          const { StreamableHTTPClientTransport } = await import("@modelcontextprotocol/sdk/client/streamableHttp.js");

          const callPromise = async () => {
            transport = new StreamableHTTPClientTransport(new URL(server.url));
            const client = new Client({ name: "Ollie-Client", version: "1.0.0" });
            await client.connect(transport);

            const toolsData = await client.listTools();
            const hasTool = toolsData.tools.some((t) => t.name === toolCall.name);

            if (hasTool) {
              const mcpResult = await client.callTool({
                name: toolCall.name,
                arguments: toolCall.args,
              });
              const content = typeof mcpResult.content === "string"
                ? mcpResult.content
                : JSON.stringify(mcpResult.content);
              await transport.close();
              return { hasTool: true, content };
            }
            await transport.close();
            return { hasTool: false, content: null };
          };

          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`MCP tool execution timeout after ${env.mcpExecutionTimeoutMs}ms`)), env.mcpExecutionTimeoutMs)
          );

          const result = await Promise.race([callPromise(), timeoutPromise]);
          if (result.hasTool) {
            return new ToolMessage({
              name: toolCall.name,
              content: result.content!,
              tool_call_id: toolCall.id!,
            });
          }
        } catch (err) {
          logger.error(`Error invoking MCP server ${server.name} for tool ${toolCall.name}:`, err);
          if (transport) {
            try {
              await transport.close();
            } catch {}
          }
        }
      }

      // If tool not found anywhere
      return new ToolMessage({
        name: toolCall.name,
        content: `Error: Tool "${toolCall.name}" not found or failed to execute.`,
        tool_call_id: toolCall.id!,
      });
    })
  );

  return { messages: toolOutputs };
};

const toolNode = callToolsNode;

// Define routing logic for tool execution
const shouldContinue = (state: typeof MessagesAnnotation.State) => {
  const lastMessage = state.messages[state.messages.length - 1];
  if (
    lastMessage &&
    "tool_calls" in lastMessage &&
    Array.isArray(lastMessage.tool_calls) &&
    lastMessage.tool_calls.length > 0
  ) {
    return "tools";
  }
  return "__end__";
};

// Define the LangGraph workflow
const workflow = new StateGraph(MessagesAnnotation)
  .addNode("agent", callModel)
  .addNode("tools", toolNode)
  .addEdge("__start__", "agent")
  .addConditionalEdges("agent", shouldContinue)
  .addEdge("tools", "agent");

// Compile the graph with MemorySaver for in-memory session persistence
const app = workflow.compile({ checkpointer: new MemorySaver() });

/**
 * Bootstraps the local model by forcing Ollama to load its weights into memory.
 * This blocks until the model is fully loaded in VRAM/RAM.
 *
 * @param threadId The unique chat session identifier
 * @param modelName Optional model name to pre-warm
 * @returns Promise<boolean> True when loaded
 */
export async function bootstrapModel(threadId: string, modelName?: string): Promise<boolean> {
  const targetModel = modelName || (await getDefaultModel());
  logger.info(`Bootstrapping model: "${targetModel}" (SessionID: "${threadId}")`);
  try {
    const response = await fetch(`${env.ollamaHost}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: targetModel,
        prompt: "",
        keep_alive: env.keepAlive,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to bootstrap model: ${response.statusText}`);
    }

    // Consume the stream. Ollama holds the request open until the model weights
    // are loaded and initial generation completes.
    const reader = response.body?.getReader();
    if (reader) {
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    }

    logger.info(`Model "${targetModel}" bootstrapped successfully`);
    return true;
  } catch (error) {
    logger.error(`Failed to bootstrap model "${targetModel}":`, error);
    throw error;
  }
}


/**
 * Runs the compiled LangGraph workflow for the given threadId and streams the output tokens.
 *
 * @param message The user's prompt message
 * @param threadId The session thread identifier for history retrieval
 * @param modelName Optional model name to invoke
 * @returns ReadableStream of encoded string tokens
 */
export function streamAgentResponse(
  message: string,
  threadId: string,
  modelName?: string,
  customInstructions?: string,
  images?: string[],
  defaultImageModel?: string,
  enabledTools?: string[],
  signal?: AbortSignal,
  nickname?: string,
  aboutMe?: string,
  isRegenerate?: boolean,
  replyToText?: string
): ReadableStream {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      let targetModel = "";
      let assistantContent = "";
      let userMsgId = "";
      try {
        targetModel = modelName || (await getDefaultModel());
        logger.info(`Starting agent response stream [SessionID: "${threadId}", Model: "${targetModel}", CustomInstructionsLength: ${customInstructions?.length ?? 0}, InputImagesCount: ${images?.length ?? 0}]`);

        // 1. Ensure the session exists in the database
        await createSession(threadId, "New Chat", targetModel, customInstructions);
        // Also update session model in case they changed the active model
        await updateSessionModel(threadId, targetModel);

        const session = await getSession(threadId);
        let activeInstructions = (session?.customInstructions !== undefined && session?.customInstructions !== null)
          ? session.customInstructions
          : customInstructions;

        if (nickname || aboutMe) {
          let personalContext = "";
          if (nickname) {
            personalContext += `User's nickname: ${nickname}. You must refer to the user by this name when appropriate.\n`;
          }
          if (aboutMe) {
            personalContext += `About the user: ${aboutMe}\n`;
          }
          activeInstructions = personalContext + (activeInstructions || "");
        }

        // 2. Always synchronize graph state with the database messages (source of truth)
        const dbMessages = await getMessages(threadId);
        logger.info(`Syncing checkpointer graph state with ${dbMessages.length} messages from database history for SessionID: "${threadId}"`);
        const langchainMessages = await Promise.all(
          dbMessages.map(async (m) => {
            if (m.role === "user") {
              const mImages = m.images ? m.images.split(",") : undefined;
              const content = await buildMessageContent(m.content, mImages);
              return new HumanMessage({ content, id: m.id });
            } else {
              return new AIMessage({ content: m.content, id: m.id });
            }
          })
        );
        await app.updateState(
          { configurable: { thread_id: threadId } },
          { messages: langchainMessages }
        );

        // 3. Save the *new* user message to the database (skip if regenerating)
        if (isRegenerate) {
          const lastDbMsg = dbMessages[dbMessages.length - 1];
          if (!lastDbMsg || lastDbMsg.role !== "user") {
            throw new Error("Cannot regenerate: last message in active path is not a user message");
          }
          userMsgId = lastDbMsg.id;
        } else {
          userMsgId = crypto.randomUUID();
          const parentMessageId = dbMessages[dbMessages.length - 1]?.id || undefined;
          await saveMessage(userMsgId, threadId, "user", message, undefined, images?.join(","), undefined, parentMessageId, replyToText);
        }

        // 4. Run the graph and listen to stream events
        const userMessageContent = await buildMessageContent(message, images);
        const eventStream = app.streamEvents(
          { messages: [new HumanMessage({ content: userMessageContent, id: userMsgId })] },
          {
            version: "v2",
            configurable: {
              thread_id: threadId,
              model_name: targetModel,
              custom_instructions: activeInstructions,
              image_model: defaultImageModel,
              enabled_tools: enabledTools,
            },
            signal,
          }
        );

        let hasStartedThinking = false;
        let hasFinishedThinking = false;

        logger.info(`Running agent graph event stream...`);
        for await (const event of eventStream) {
          // Listen specifically to model streaming events
          if (event.event === "on_chat_model_stream") {
            const chunk = event.data.chunk;

            // Extract potential reasoning tokens from different versions of LangChain
            const reasoning = chunk.additional_kwargs?.reasoning_content ||
                              chunk.response_metadata?.reasoning_content ||
                              chunk.reasoning_content;

            if (reasoning && typeof reasoning === "string" && reasoning) {
              if (!hasStartedThinking) {
                controller.enqueue(encoder.encode("<think>\n"));
                assistantContent += "<think>\n";
                hasStartedThinking = true;
              }
              controller.enqueue(encoder.encode(reasoning));
              assistantContent += reasoning;
            } else if (chunk && typeof chunk.content === "string" && chunk.content) {
              // If we were thinking but haven't written the closing tag, write it now
              if (hasStartedThinking && !hasFinishedThinking) {
                controller.enqueue(encoder.encode("\n</think>\n"));
                assistantContent += "\n</think>\n";
                hasFinishedThinking = true;
              }
              controller.enqueue(encoder.encode(chunk.content));
              assistantContent += chunk.content;
            }
          }
        }

        // Check if we need to copy tool results (e.g. image markdown) if assistantContent is empty or doesn't have the image
        try {
          const finalState = await app.getState({ configurable: { thread_id: threadId } });
          const finalMessages = finalState.values?.messages || [];

          // Gather new messages generated in this turn (after the last human message)
          const turnMessages = [];
          for (let i = finalMessages.length - 1; i >= 0; i--) {
            const msg = finalMessages[i];
            if (msg._getType() === "human" || msg.role === "user") {
              break;
            }
            turnMessages.unshift(msg);
          }

          // If assistantContent doesn't contain the generated image URL, but we have a tool response with it, append it
          if (!assistantContent.includes("/api/uploads/")) {
            let toolImageMarkdown = "";
            for (const msg of turnMessages) {
              const contentStr = typeof msg.content === "string" ? msg.content : "";
              if (msg._getType() === "tool" && contentStr.includes("/api/uploads/")) {
                toolImageMarkdown += (toolImageMarkdown ? " " : "") + contentStr;
              }
            }

            if (toolImageMarkdown) {
              // If we were thinking but didn't close it, close it now
              if (hasStartedThinking && !hasFinishedThinking) {
                controller.enqueue(encoder.encode("\n</think>\n"));
                assistantContent += "\n</think>\n";
                hasFinishedThinking = true;
              }

              controller.enqueue(encoder.encode(toolImageMarkdown));
              assistantContent += toolImageMarkdown;
            }
          }
        } catch (stateErr) {
          logger.error("Failed to inspect final state for tool outputs:", stateErr);
        }

        // 5. Save the assistant's complete generated message to the database
        const assistantMsgId = crypto.randomUUID();

        // Extract markdown image links
        const imageRegex = /!\[.*?\]\((.*?)\)/g;
        const generatedImagesList: string[] = [];
        let match;
        while ((match = imageRegex.exec(assistantContent)) !== null) {
          generatedImagesList.push(match[1]);
        }
        const generatedImagesString = generatedImagesList.length > 0 ? generatedImagesList.join(",") : undefined;

        await saveMessage(
          assistantMsgId,
          threadId,
          "assistant",
          assistantContent,
          targetModel,
          undefined,
          generatedImagesString,
          userMsgId
        );

        // 6. Auto-generate title if this is the first message in this session
        const sessionMessages = await getMessages(threadId);
        if (sessionMessages.length === 2) {
          const firstQuery = sessionMessages[0].content;
          const generatedTitle = firstQuery.slice(0, 40) + (firstQuery.length > 40 ? "..." : "");
          await updateSessionTitle(threadId, generatedTitle);
        }

        logger.info(`Agent response stream completed successfully (Generated response length: ${assistantContent.length} chars)`);
        controller.close();
      } catch (error) {
        const err = error as { name?: string; message?: string };
        if (err.name === "AbortError" || signal?.aborted) {
          logger.info(`streamAgentResponse: Execution aborted by client signal [SessionID: "${threadId}"]`);
          if (assistantContent) {
            const assistantMsgId = crypto.randomUUID();
            await saveMessage(
              assistantMsgId,
              threadId,
              "assistant",
              assistantContent,
              targetModel,
              undefined,
              undefined,
              userMsgId
            ).catch((saveErr) => {
              logger.error("Failed to save interrupted response on server:", saveErr);
            });
          }
        } else {
          logger.error(`Error in streamAgentResponse [SessionID: "${threadId}"]:`, error);
          controller.error(error);
        }
      }
    },
  });
}
