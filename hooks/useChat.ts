"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChatUiMessage } from "@/components/chat";
import { useOllama } from "@/contexts/OllamaContext";
import { useSettings } from "@/contexts/SettingsContext";

export interface UseChatReturn {
  messages: ChatUiMessage[];
  isGenerating: boolean;
  isBootstrapping: boolean;
  isModelLoaded: boolean;
  activeModel: string;
  defaultModel: string;
  runnableModels: string[];
  bootstrapChat: (selectedModel: string, useAsDefault: boolean) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  setActiveModel: (model: string) => void;
  errorToast: string | null;
  setErrorToast: (msg: string | null) => void;
  isInitializing: boolean;
}

export function useChat(): UseChatReturn {
  const {
    runnableModels,
    defaultModel,
    activeModel,
    isInitializing,
    setActiveModel,
    setDefaultModel,
  } = useOllama();

  const { customInstructions } = useSettings();

  const [messages, setMessages] = useState<ChatUiMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isBootstrapping, setIsBootstrapping] = useState<boolean>(false);
  const [isModelLoaded, setIsModelLoaded] = useState<boolean>(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  const threadIdRef = useRef<string>("");

  useEffect(() => {
    threadIdRef.current = crypto.randomUUID();
  }, []);

  // Handler to bootstrap and warm up the selected model
  const bootstrapChat = useCallback(
    async (selectedModel: string, useAsDefault: boolean) => {
      if (isBootstrapping) return;

      setIsBootstrapping(true);
      setActiveModel(selectedModel);

      if (useAsDefault) {
        setDefaultModel(selectedModel);
      }

      try {
        const response = await fetch("/api/chat/bootstrap", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            threadId: threadIdRef.current,
            model: selectedModel,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || "Bootstrap request failed");
        }

        setIsModelLoaded(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        console.error("Error bootstrapping model:", error);
        setErrorToast(error.message || "Failed to load model weights.");
      } finally {
        setIsBootstrapping(false);
      }
    },
    [isBootstrapping, setActiveModel, setDefaultModel]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (isGenerating || isBootstrapping || !isModelLoaded) return;

      setIsGenerating(true);
      setErrorToast(null); // Clear previous errors

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
        modelName: activeModel,
      };

      // Add user message and assistant placeholder message to state
      setMessages((prev) => [...prev, userMessage, assistantMessagePlaceholder]);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: text,
            threadId: threadIdRef.current,
            model: activeModel,
            customInstructions: customInstructions || "",
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to connect to chat API");
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        console.error("Streaming error:", error);
        const errMsg = error.message || "Failed to stream response from the server.";
        setErrorToast(errMsg);
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === assistantMessageId) {
              return {
                ...msg,
                content: `Error: ${errMsg}`,
              };
            }
            return msg;
          })
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [isGenerating, isBootstrapping, isModelLoaded, activeModel, customInstructions]
  );

  return {
    messages,
    isGenerating,
    isBootstrapping,
    isModelLoaded,
    activeModel,
    defaultModel,
    runnableModels,
    bootstrapChat,
    sendMessage,
    setActiveModel,
    errorToast,
    setErrorToast,
    isInitializing,
  };
}
