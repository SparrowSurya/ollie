import { ChatOllama } from "@langchain/ollama";
import { MessagesAnnotation, StateGraph, MemorySaver } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import readEnv from "./config";

// Read current environment host configuration
const env = readEnv();

// Initialize the ChatOllama model targeting our local model
const model = new ChatOllama({
  model: "gemma4:e2b",
  baseUrl: env.ollamaHost,
  think: true,
});

// Node function: calls the model with the current messages state
const callModel = async (state: typeof MessagesAnnotation.State) => {
  const response = await model.invoke(state.messages);
  return { messages: [response] };
};

// Define the LangGraph workflow
const workflow = new StateGraph(MessagesAnnotation)
  .addNode("agent", callModel)
  .addEdge("__start__", "agent")
  .addEdge("agent", "__end__");

// Compile the graph with MemorySaver for in-memory session persistence
const app = workflow.compile({ checkpointer: new MemorySaver() });

/**
 * Bootstraps the local model by forcing Ollama to load its weights into memory.
 * This blocks until the model is fully loaded in VRAM/RAM.
 *
 * @param threadId The unique chat session identifier
 * @returns Promise<boolean> True when loaded
 */
export async function bootstrapModel(threadId: string): Promise<boolean> {
  const response = await fetch(`${env.ollamaHost}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gemma4:e2b",
      prompt: "",
      keep_alive: "5m", // Keep model warm in memory for 5 minutes of idle time
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

  return true;
}

/**
 * Runs the compiled LangGraph workflow for the given threadId and streams the output tokens.
 *
 * @param message The user's prompt message
 * @param threadId The session thread identifier for history retrieval
 * @returns ReadableStream of encoded string tokens
 */
export function streamAgentResponse(message: string, threadId: string): ReadableStream {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        // Run the graph and listen to stream events
        const eventStream = app.streamEvents(
          { messages: [new HumanMessage(message)] },
          { version: "v2", configurable: { thread_id: threadId } }
        );

        let hasStartedThinking = false;
        let hasFinishedThinking = false;

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
                hasStartedThinking = true;
              }
              controller.enqueue(encoder.encode(reasoning));
            } else if (chunk && typeof chunk.content === "string" && chunk.content) {
              // If we were thinking but haven't written the closing tag, write it now
              if (hasStartedThinking && !hasFinishedThinking) {
                controller.enqueue(encoder.encode("\n</think>\n"));
                hasFinishedThinking = true;
              }
              controller.enqueue(encoder.encode(chunk.content));
            }
          }
        }
        controller.close();
      } catch (error) {
        console.error("Error in streamAgentResponse:", error);
        controller.error(error);
      }
    },
  });
}
