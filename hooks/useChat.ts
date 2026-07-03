"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChatUiMessage } from "@/components/chat";

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
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatUiMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isBootstrapping, setIsBootstrapping] = useState<boolean>(false);
  const [isModelLoaded, setIsModelLoaded] = useState<boolean>(false);
  const [activeModel, setActiveModelState] = useState<string>("");
  const [defaultModel, setDefaultModel] = useState<string>("");
  const [runnableModels, setRunnableModels] = useState<string[]>([]);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const threadIdRef = useRef<string>("");

  // Setter helper that dispatches custom events to notify other layout parts
  const setActiveModel = useCallback((modelName: string) => {
    setActiveModelState(modelName);
    localStorage.setItem("olly-active-model", modelName);
    window.dispatchEvent(new Event("olly-active-model-changed"));
  }, []);

  // Fetch pulled (downloaded) models and initialize preferences on mount
  useEffect(() => {
    const activeThreadId = crypto.randomUUID();
    threadIdRef.current = activeThreadId;

    const fetchModels = async () => {
      try {
        const response = await fetch("/api/models?downloaded=true");
        if (response.ok) {
          const data = await response.json();
          const modelsList: string[] = data.models || [];
          setRunnableModels(modelsList);

          // Resolve default model from localStorage or use the first model in list
          const savedDefault = localStorage.getItem("olly-default-model") || "";
          if (savedDefault && modelsList.includes(savedDefault)) {
            setDefaultModel(savedDefault);
          } else if (modelsList.length > 0) {
            setDefaultModel(modelsList[0]);
            localStorage.setItem("olly-default-model", modelsList[0]);
          }

          // Initial active model fallback
          const savedActive = localStorage.getItem("olly-active-model") || "";
          if (savedActive && modelsList.includes(savedActive)) {
            setActiveModelState(savedActive);
          } else if (savedDefault && modelsList.includes(savedDefault)) {
            setActiveModelState(savedDefault);
          } else if (modelsList.length > 0) {
            setActiveModelState(modelsList[0]);
          }
        }
      } catch (error) {
        console.error("Failed to load runnable models:", error);
      }
    };

    fetchModels();
  }, []);

  // Listen to external active model changes (e.g. from the settings modal)
  useEffect(() => {
    const handleActiveModelChanged = () => {
      const currentActive = localStorage.getItem("olly-active-model") || "";
      if (currentActive) {
        setActiveModelState(currentActive);
      }
    };

    window.addEventListener("olly-active-model-changed", handleActiveModelChanged);
    return () => {
      window.removeEventListener("olly-active-model-changed", handleActiveModelChanged);
    };
  }, []);

  // Handler to bootstrap and warm up the selected model
  const bootstrapChat = useCallback(
    async (selectedModel: string, useAsDefault: boolean) => {
      if (isBootstrapping) return;

      setIsBootstrapping(true);
      setActiveModel(selectedModel);

      if (useAsDefault) {
        setDefaultModel(selectedModel);
        localStorage.setItem("olly-default-model", selectedModel);
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
    [isBootstrapping, setActiveModel]
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
    [isGenerating, isBootstrapping, isModelLoaded, activeModel]
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
  };
}
