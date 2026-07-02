"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChatUiMessage } from "@/components/chat";

export interface UseChatReturn {
  messages: ChatUiMessage[];
  isGenerating: boolean;
  isBootstrapping: boolean;
  sendMessage: (text: string) => Promise<void>;
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatUiMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isBootstrapping, setIsBootstrapping] = useState<boolean>(true);
  const threadIdRef = useRef<string>("");

  // Initialize session and bootstrap the model on mount
  useEffect(() => {
    const activeThreadId = crypto.randomUUID();
    threadIdRef.current = activeThreadId;

    const initBootstrap = async () => {
      try {
        const response = await fetch("/api/chat/bootstrap", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ threadId: activeThreadId }),
        });

        if (!response.ok) {
          throw new Error("Bootstrap failed");
        }
      } catch (error) {
        console.error("Error bootstrapping model:", error);
      } finally {
        setIsBootstrapping(false);
      }
    };

    initBootstrap();
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (isGenerating || isBootstrapping) return;

      setIsGenerating(true);

      const userMessage: ChatUiMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        timestamp: new Date(),
      };

      const assistantMessageId = crypto.randomUUID();
      const assistantMessagePlaceholder: ChatUiMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
      };

      // Add user message and assistant placeholder message to state
      setMessages((prev) => [...prev, userMessage, assistantMessagePlaceholder]);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content: text, threadId: threadIdRef.current }),
        });

        if (!response.ok) {
          throw new Error("Failed to connect to chat API");
        }

        if (!response.body) {
          throw new Error("Response body is unreadable");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === assistantMessageId) {
                return {
                  ...msg,
                  content: msg.content + chunk,
                };
              }
              return msg;
            })
          );
        }
      } catch (error) {
        console.error("Streaming error:", error);
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === assistantMessageId) {
              return {
                ...msg,
                content: "Error: Failed to stream response from the server. Make sure the backend is running.",
              };
            }
            return msg;
          })
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [isGenerating, isBootstrapping]
  );

  return {
    messages,
    isGenerating,
    isBootstrapping,
    sendMessage,
  };
}
