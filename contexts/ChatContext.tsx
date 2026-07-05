"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
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
  images?: string;
  generatedImages?: string;
  timestamp: string | Date;
}

export interface ChatContextType {
  messages: ChatUiMessage[];
  isGenerating: boolean;
  isBootstrapping: boolean;
  isModelLoaded: boolean;
  activeModel: string;
  defaultModel: string;
  runnableModels: string[];
  activeModelSupportsVision: boolean;
  bootstrapChat: (model: string, useAsDefault: boolean) => Promise<void>;
  sendMessage: (text: string, imageFiles?: File[]) => Promise<void>;
  setActiveModel: (model: string) => void;
  errorToast: string | null;
  setErrorToast: (msg: string | null) => void;
  isInitializing: boolean;
  sessions: DbSession[];
  activeSessionId: string;
  startNewChat: () => void;
  startNewImageChat: () => void;
  switchSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  renameSession: (sessionId: string, newTitle: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const urlSessionId = params?.sessionId as string | undefined;

  const {
    runnableModels,
    imageModels,
    defaultModel,
    defaultImageModel,
    activeModel,
    setActiveModel,
    setDefaultModel,
    isInitializing: isOllamaInitializing,
  } = useOllama();

  const { customInstructions } = useSettings();

  const [messages, setMessages] = useState<ChatUiMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isBootstrapping, setIsBootstrapping] = useState<boolean>(false);
  const [isModelLoaded, setIsModelLoaded] = useState<boolean>(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [activeModelSupportsVision, setActiveModelSupportsVision] = useState<boolean>(false);

  // History session states
  const [sessions, setSessions] = useState<DbSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");

  const loadedSessionIdRef = useRef<string>("");

  // Sync active model vision capabilities when activeModel changes
  useEffect(() => {
    let active = true;
    const checkVision = async () => {
      // Force asynchronous state update to satisfy react-hooks/set-state-in-effect rule
      await Promise.resolve();

      if (!activeModel || !isModelLoaded) {
        if (active) setActiveModelSupportsVision(false);
        return;
      }

      try {
        const response = await fetch(`/api/models/details?model=${encodeURIComponent(activeModel)}`);
        if (response.ok && active) {
          const data = await response.json();
          const supports = data.capabilities?.includes("vision") || false;
          setActiveModelSupportsVision(supports);
        }
      } catch (e) {
        console.error("ChatContext: Failed to check model vision capability:", e);
        if (active) setActiveModelSupportsVision(false);
      }
    };
    checkVision();

    return () => {
      active = false;
    };
  }, [activeModel, isModelLoaded]);

  const fetchSessions = useCallback(async () => {
    try {
      const response = await fetch("/api/sessions");
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
      }
    } catch (e) {
      console.error("ChatContext: Failed to fetch sessions:", e);
    }
  }, []);

  // Fetch sessions list on mount
  useEffect(() => {
    const loadList = async () => {
      await fetchSessions();
    };
    loadList();
  }, [fetchSessions]);

  const isStartingImageChatRef = useRef<boolean>(false);

  // Sync activeSessionId with URL param
  useEffect(() => {
    const syncSession = async () => {
      if (urlSessionId) {
        setActiveSessionId(urlSessionId);
      } else {
        // Clear messages and model status for new chat on /chat
        const newUuid = crypto.randomUUID();
        setActiveSessionId(newUuid);
        loadedSessionIdRef.current = newUuid;
        setMessages([]);

        if (isStartingImageChatRef.current) {
          setIsModelLoaded(true);
          isStartingImageChatRef.current = false;
        } else {
          setIsModelLoaded(false);
        }
      }
    };
    syncSession();
  }, [urlSessionId]);

  // Load message history when activeSessionId changes (matching the URL)
  useEffect(() => {
    if (!activeSessionId) return;

    if (urlSessionId && activeSessionId === urlSessionId) {
      if (loadedSessionIdRef.current === activeSessionId) return;

      const loadSession = async () => {
        try {
          const response = await fetch(`/api/sessions/messages?id=${activeSessionId}`);
          if (response.ok) {
            const data = await response.json();
            setMessages(
              (data.messages || []).map((m: DbMessageResponse) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                timestamp: new Date(m.timestamp),
                modelName: m.modelName || undefined,
                images: m.images ? m.images.split(",") : undefined,
                generatedImages: m.generatedImages ? m.generatedImages.split(",") : undefined,
              }))
            );
            if (data.model) {
              setActiveModel(data.model);
            }
            setIsModelLoaded(true);
            loadedSessionIdRef.current = activeSessionId;
          } else {
            // Session not found in DB, treat as a fresh chat session with this ID
            setMessages([]);
            setIsModelLoaded(false);
          }
        } catch (e) {
          console.error("ChatContext: Failed to load session messages:", e);
          setMessages([]);
          setIsModelLoaded(false);
        }
      };
      loadSession();
    }
  }, [activeSessionId, urlSessionId, setActiveModel]);

  const startNewChat = useCallback(() => {
    router.push("/chat");
  }, [router]);

  const startNewImageChat = useCallback(() => {
    setMessages([]);
    const newUuid = crypto.randomUUID();
    setActiveSessionId(newUuid);
    loadedSessionIdRef.current = newUuid;

    const targetImgModel = defaultImageModel || (imageModels.length > 0 ? imageModels[0] : "");
    if (targetImgModel) {
      setActiveModel(targetImgModel);
      setIsModelLoaded(true);
      isStartingImageChatRef.current = true;
    } else {
      setIsModelLoaded(false);
      setErrorToast("No image generation models installed. Please pull an image model (like flux) in Settings.");
    }

    router.push("/chat");
  }, [defaultImageModel, imageModels, setActiveModel, router]);

  const switchSession = useCallback(async (sessionId: string) => {
    router.push(`/chat/${sessionId}`);
  }, [router]);

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
      console.error("ChatContext: Failed to delete session:", e);
    }
  }, [activeSessionId, fetchSessions, startNewChat]);

  const renameSession = useCallback(async (sessionId: string, newTitle: string) => {
    try {
      const response = await fetch("/api/sessions", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: sessionId,
          title: newTitle,
        }),
      });

      if (response.ok) {
        await fetchSessions();
      } else {
        throw new Error("Failed to rename session");
      }
    } catch (e) {
      console.error("ChatContext: Failed to rename session:", e);
    }
  }, [fetchSessions]);

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
    async (text: string, imageFiles?: File[]) => {
      if (isGenerating || isBootstrapping || !isModelLoaded) return;

      setIsGenerating(true);
      setErrorToast(null); // Clear previous errors

      let uploadedUrls: string[] = [];
      const assistantMessageId = crypto.randomUUID();

      try {
        if (imageFiles && imageFiles.length > 0) {
          const formData = new FormData();
          imageFiles.forEach((file) => {
            formData.append("files", file);
          });

          const uploadRes = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });

          if (!uploadRes.ok) {
            const errData = await uploadRes.json().catch(() => ({}));
            throw new Error(errData.error || "Failed to upload attached images");
          }

          const uploadData = await uploadRes.json();
          uploadedUrls = uploadData.urls || [];
        }

        const userMessage: ChatUiMessage = {
          id: crypto.randomUUID(),
          role: "user",
          content: text,
          images: uploadedUrls.length > 0 ? uploadedUrls : undefined,
          timestamp: new Date(),
        };

        const assistantMessagePlaceholder: ChatUiMessage = {
          id: assistantMessageId,
          role: "assistant",
          content: "",
          timestamp: new Date(),
          modelName: activeModel,
        };

        // Add user message and assistant placeholder message to state
        setMessages((prev) => [...prev, userMessage, assistantMessagePlaceholder]);

        // If we are on /chat, redirect to /chat/[activeSessionId] on first message submission
        if (!urlSessionId) {
          router.push(`/chat/${activeSessionId}`);
        }

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
            defaultImageModel: defaultImageModel || undefined,
            customInstructions: customInstructions || "",
            images: uploadedUrls.length > 0 ? uploadedUrls : undefined,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to connect to chat API");
        }

        const contentType = response.headers.get("Content-Type") || "";
        if (contentType.includes("application/json")) {
          const data = await response.json();
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === assistantMessageId) {
                return {
                  ...msg,
                  content: data.content || "",
                  generatedImages: data.generatedImages || undefined,
                };
              }
              return msg;
            })
          );
        } else {
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
        }

        // Stream completed successfully, reload sessions to capture potential auto-title or updated order
        await fetchSessions();

        // Sync messages from the database to load the generated images correctly into the message state gallery
        try {
          const syncRes = await fetch(`/api/sessions/messages?id=${activeSessionId}`);
          if (syncRes.ok) {
            const syncData = await syncRes.json();
            setMessages(
              (syncData.messages || []).map((m: DbMessageResponse) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                timestamp: new Date(m.timestamp),
                modelName: m.modelName || undefined,
                images: m.images ? m.images.split(",") : undefined,
                generatedImages: m.generatedImages ? m.generatedImages.split(",") : undefined,
              }))
            );
          }
        } catch (syncErr) {
          console.error("Failed to sync message state after stream complete:", syncErr);
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
    [isGenerating, isBootstrapping, isModelLoaded, activeModel, activeSessionId, customInstructions, fetchSessions, urlSessionId, router, defaultImageModel]
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
      console.error("ChatContext: Failed to update session model in DB:", e);
    }
  }, [activeSessionId, fetchSessions, setActiveModel]);

  return (
    <ChatContext.Provider
      value={{
        messages,
        isGenerating,
        isBootstrapping,
        isModelLoaded,
        activeModelSupportsVision,
        activeModel,
        defaultModel,
        runnableModels,
        bootstrapChat,
        sendMessage,
        setActiveModel: changeActiveModel,
        errorToast,
        setErrorToast,
        isInitializing: isOllamaInitializing,
        sessions,
        activeSessionId,
        startNewChat,
        startNewImageChat,
        switchSession,
        deleteSession,
        renameSession,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return context;
}
