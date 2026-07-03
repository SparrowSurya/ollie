"use client";

import { useState, useEffect, useCallback } from "react";
import { ChatUiMessage } from "@/components/chat";
import { useOllama } from "@/contexts/OllamaContext";
import { useSettings } from "@/contexts/SettingsContext";

export interface DbSession {
  id: string;
  title: string;
  model: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DbMessageResponse {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  modelName?: string;
  timestamp: string | Date;
}

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
  // History session properties
  sessions: DbSession[];
  activeSessionId: string;
  startNewChat: () => void;
  switchSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
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

  // History session states
  const [sessions, setSessions] = useState<DbSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");

  const fetchSessions = useCallback(async () => {
    try {
      const response = await fetch("/api/sessions");
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
      }
    } catch (e) {
      console.error("useChat: Failed to fetch sessions:", e);
    }
  }, []);

  // Fetch sessions and load the most recent session on mount
  useEffect(() => {
    const initSessions = async () => {
      try {
        const response = await fetch("/api/sessions");
        if (response.ok) {
          const data = await response.json();
          const list = data.sessions || [];
          setSessions(list);

          if (list.length > 0) {
            // Load the most recent session automatically
            const latestSession = list[0];
            setActiveSessionId(latestSession.id);

            const msgResponse = await fetch(`/api/sessions/messages?id=${latestSession.id}`);
            if (msgResponse.ok) {
              const msgData = await msgResponse.json();
              setMessages(
                (msgData.messages || []).map((m: DbMessageResponse) => ({
                  id: m.id,
                  role: m.role,
                  content: m.content,
                  timestamp: new Date(m.timestamp),
                  modelName: m.modelName || undefined,
                }))
              );
              if (msgData.model) {
                setActiveModel(msgData.model);
              }
              setIsModelLoaded(true);
            }
          } else {
            // No sessions, start a fresh session
            setActiveSessionId(crypto.randomUUID());
          }
        } else {
          // If the sessions response fails (e.g. 500 error), start a fresh session
          setActiveSessionId(crypto.randomUUID());
        }
      } catch (e) {
        console.error("useChat: Failed to load initial sessions:", e);
        setActiveSessionId(crypto.randomUUID());
      }
    };

    initSessions();
  }, [setActiveModel]);

  const startNewChat = useCallback(() => {
    setActiveSessionId(crypto.randomUUID());
    setMessages([]);
    setIsModelLoaded(false);
  }, []);

  const switchSession = useCallback(async (sessionId: string) => {
    try {
      setActiveSessionId(sessionId);
      const response = await fetch(`/api/sessions/messages?id=${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(
          (data.messages || []).map((m: DbMessageResponse) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: new Date(m.timestamp),
            modelName: m.modelName || undefined,
          }))
        );
        if (data.model) {
          setActiveModel(data.model);
        }
        setIsModelLoaded(true);
      }
    } catch (e) {
      console.error("useChat: Failed to switch session:", e);
    }
  }, [setActiveModel]);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      const response = await fetch(`/api/sessions?id=${sessionId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchSessions();
        if (sessionId === activeSessionId) {
          startNewChat();
        }
      } else {
        throw new Error("Failed to delete session");
      }
    } catch (e) {
      console.error("useChat: Failed to delete session:", e);
    }
  }, [activeSessionId, fetchSessions, startNewChat]);

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
            threadId: activeSessionId,
            model: selectedModel,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || "Bootstrap request failed");
        }

        setIsModelLoaded(true);
        // Refresh sidebar sessions to register the newly active thread if it was just loaded
        await fetchSessions();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        console.error("Error bootstrapping model:", error);
        setErrorToast(error.message || "Failed to load model weights.");
      } finally {
        setIsBootstrapping(false);
      }
    },
    [activeSessionId, isBootstrapping, setActiveModel, setDefaultModel, fetchSessions]
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
        // Sync sessions in sidebar immediately so it lists this session
        await fetchSessions();

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: text,
            threadId: activeSessionId,
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

        // Stream completed successfully, reload sessions to capture potential auto-title or updated order
        await fetchSessions();

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
    [isGenerating, isBootstrapping, isModelLoaded, activeModel, activeSessionId, customInstructions, fetchSessions]
  );

  const changeActiveModel = useCallback(async (modelName: string) => {
    setActiveModel(modelName);
    if (!activeSessionId) return;

    try {
      await fetch("/api/sessions", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: activeSessionId,
          model: modelName,
        }),
      });
      await fetchSessions();
    } catch (e) {
      console.error("useChat: Failed to update session model in DB:", e);
    }
  }, [activeSessionId, fetchSessions, setActiveModel]);

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
    setActiveModel: changeActiveModel,
    errorToast,
    setErrorToast,
    isInitializing,
    sessions,
    activeSessionId,
    startNewChat,
    switchSession,
    deleteSession,
  };
}
