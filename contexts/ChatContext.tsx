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
  parentMessageId?: string;
  timestamp: string | Date;
}

export interface ToolInfo {
  name: string;
  description: string;
}

export interface ChatContextType {
  messages: ChatUiMessage[];
  allMessages: ChatUiMessage[];
  isGenerating: boolean;
  isBootstrapping: boolean;
  isModelLoaded: boolean;
  activeModel: string;
  defaultModel: string;
  runnableModels: string[];
  activeModelSupportsVision: boolean;
  bootstrapChat: (
    model: string,
    useAsDefault: boolean,
    customInstructions?: string,
    mcpServers?: { name: string; url: string }[]
  ) => Promise<void>;
  sendMessage: (text: string, imageFiles?: File[], existingImages?: string[]) => Promise<void>;
  stopGeneration: () => void;
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
  availableTools: ToolInfo[];
  activeTools: string[];
  toggleTool: (name: string) => void;
  switchBranch: (messageId: string) => Promise<void>;
  editMessage: (messageId: string, newText: string) => Promise<void>;
  regenerateMessage: (assistantMessageId: string) => Promise<void>;
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
  const [allMessages, setAllMessages] = useState<ChatUiMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isBootstrapping, setIsBootstrapping] = useState<boolean>(false);
  const [isModelLoaded, setIsModelLoaded] = useState<boolean>(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [activeModelSupportsVision, setActiveModelSupportsVision] = useState<boolean>(false);

  // History session states
  const [sessions, setSessions] = useState<DbSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");

  // Tool states
  const [availableTools, setAvailableTools] = useState<ToolInfo[]>([]);
  const [activeTools, setActiveToolsState] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ollie-active-tools");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // Ignore
        }
      }
    }
    return [];
  });

  // Load available tools on mount
  useEffect(() => {
    const fetchTools = async () => {
      try {
        const res = await fetch("/api/tools");
        if (res.ok) {
          const data = await res.json();
          setAvailableTools(data.tools || []);
        }
      } catch (e) {
        console.error("ChatContext: Failed to fetch available tools:", e);
      }
    };
    fetchTools();
  }, []);

  const toggleTool = useCallback((toolName: string) => {
    setActiveToolsState((prev) => {
      const updated = prev.includes(toolName)
        ? prev.filter((name) => name !== toolName)
        : [...prev, toolName];
      localStorage.setItem("ollie-active-tools", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const loadedSessionIdRef = useRef<string>("");
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
  }, []);

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
        setAllMessages([]);

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
            const mapMsg = (m: DbMessageResponse) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              timestamp: new Date(m.timestamp),
              modelName: m.modelName || undefined,
              images: m.images ? m.images.split(",") : undefined,
              generatedImages: m.generatedImages ? m.generatedImages.split(",") : undefined,
              parentMessageId: m.parentMessageId || undefined,
            });
            setMessages((data.messages || []).map(mapMsg));
            setAllMessages((data.allMessages || []).map(mapMsg));
            if (data.model) {
              setActiveModel(data.model);
            }
            setIsModelLoaded(true);
            loadedSessionIdRef.current = activeSessionId;
          } else {
            // Session not found in DB, treat as a fresh chat session with this ID
            setMessages([]);
            setAllMessages([]);
            setIsModelLoaded(false);
          }
        } catch (e) {
          console.error("ChatContext: Failed to load session messages:", e);
          setMessages([]);
          setAllMessages([]);
          setIsModelLoaded(false);
        }
      };
      loadSession();
    }
  }, [activeSessionId, urlSessionId, setActiveModel]);

  const startNewChat = useCallback(() => {
    setMessages([]);
    const newUuid = crypto.randomUUID();
    setActiveSessionId(newUuid);
    loadedSessionIdRef.current = newUuid;
    setIsModelLoaded(false);
    isStartingImageChatRef.current = false;

    const targetModel = defaultModel || (runnableModels.length > 0 ? runnableModels[0] : "");
    if (targetModel) {
      setActiveModel(targetModel);
    }

    router.push("/chat");
  }, [defaultModel, runnableModels, setActiveModel, router]);

  const startNewImageChat = useCallback(() => {
    setMessages([]);
    const newUuid = crypto.randomUUID();
    setActiveSessionId(newUuid);
    loadedSessionIdRef.current = newUuid;

    const targetImgModel = defaultImageModel || (imageModels.length > 0 ? imageModels[0] : "");
    if (targetImgModel) {
      setActiveModel(targetImgModel);
      setIsModelLoaded(false);
      isStartingImageChatRef.current = false;
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

  const bootstrapChat = useCallback(
    async (
      selectedModel: string,
      useAsDefault: boolean,
      customInstructions?: string,
      mcpServers?: { name: string; url: string }[]
    ) => {
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
            customInstructions,
            mcpServers,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || "Bootstrap request failed");
        }

        setIsModelLoaded(true);
        // Refresh sidebar sessions to register the newly active thread if it was just loaded
        await fetchSessions();
        router.push(`/chat/${activeSessionId}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        console.error("Error bootstrapping model:", error);
        setErrorToast(error.message || "Failed to load model weights.");
      } finally {
        setIsBootstrapping(false);
      }
    },
    [activeSessionId, isBootstrapping, setActiveModel, setDefaultModel, fetchSessions, router]
  );

  const sendMessage = useCallback(
    async (text: string, imageFiles?: File[], existingImages?: string[]) => {
      if (isGenerating || isBootstrapping || !isModelLoaded) return;

      setIsGenerating(true);
      setErrorToast(null); // Clear previous errors

      let uploadedUrls: string[] = [];
      const assistantMessageId = crypto.randomUUID();

      const controller = new AbortController();
      abortControllerRef.current = controller;

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
          images: uploadedUrls.length > 0 ? uploadedUrls : existingImages,
          timestamp: new Date(),
          parentMessageId: messages[messages.length - 1]?.id || undefined,
        };

        const assistantMessagePlaceholder: ChatUiMessage = {
          id: assistantMessageId,
          role: "assistant",
          content: "",
          timestamp: new Date(),
          modelName: activeModel,
          parentMessageId: userMessage.id,
        };

        // Add user message and assistant placeholder message to state
        setMessages((prev) => [...prev, userMessage, assistantMessagePlaceholder]);
        setAllMessages((prev) => [...prev, userMessage, assistantMessagePlaceholder]);

        // If we are on /chat, redirect to /chat/[activeSessionId] on first message submission
        if (!urlSessionId) {
          router.push(`/chat/${activeSessionId}`);
        }

        // Sync sessions in sidebar immediately so it lists this session
        await fetchSessions();

        const storedNickname = typeof window !== "undefined" ? localStorage.getItem("ollie-nickname") || "" : "";
        const storedAboutMe = typeof window !== "undefined" ? localStorage.getItem("ollie-about-me") || "" : "";

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
            enabledTools: activeTools,
            nickname: storedNickname || undefined,
            aboutMe: storedAboutMe || undefined,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to connect to chat API");
        }

        const contentType = response.headers.get("Content-Type") || "";
        if (contentType.includes("application/json")) {
          const data = await response.json();
          const updateMsgs = (prev: ChatUiMessage[]) =>
            prev.map((msg) => {
              if (msg.id === assistantMessageId) {
                return {
                  ...msg,
                  content: data.content || "",
                  generatedImages: data.generatedImages || undefined,
                };
              }
              return msg;
            });
          setMessages(updateMsgs);
          setAllMessages(updateMsgs);
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
            const updateMsgs = (prev: ChatUiMessage[]) =>
              prev.map((msg) => {
                if (msg.id === assistantMessageId) {
                  return {
                    ...msg,
                    content: msg.content + chunk,
                  };
                }
                return msg;
              });
            setMessages(updateMsgs);
            setAllMessages(updateMsgs);
          }
        }

        // Stream completed successfully, reload sessions to capture potential auto-title or updated order
        await fetchSessions();

        // Sync messages from the database to load the generated images correctly into the message state gallery
        try {
          const syncRes = await fetch(`/api/sessions/messages?id=${activeSessionId}`);
          if (syncRes.ok) {
            const syncData = await syncRes.json();
            const mapMsg = (m: DbMessageResponse) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              timestamp: new Date(m.timestamp),
              modelName: m.modelName || undefined,
              images: m.images ? m.images.split(",") : undefined,
              generatedImages: m.generatedImages ? m.generatedImages.split(",") : undefined,
              parentMessageId: m.parentMessageId || undefined,
            });
            setMessages((syncData.messages || []).map(mapMsg));
            setAllMessages((syncData.allMessages || []).map(mapMsg));
          }
        } catch (syncErr) {
          console.error("Failed to sync message state after stream complete:", syncErr);
        }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        if (error.name === "AbortError") {
          console.log("ChatContext: Streaming aborted by user.");
          await fetchSessions().catch(() => {});
        } else {
          console.error("Streaming error:", error);
          const errMsg = error.message || "Failed to stream response from the server.";
          setErrorToast(errMsg);
          const updateMsgs = (prev: ChatUiMessage[]) =>
            prev.map((msg) => {
              if (msg.id === assistantMessageId) {
                return {
                  ...msg,
                  content: `Error: ${errMsg}`,
                };
              }
              return msg;
            });
          setMessages(updateMsgs);
          setAllMessages(updateMsgs);
        }
      } finally {
        setIsGenerating(false);
        abortControllerRef.current = null;
      }
    },
    [isGenerating, isBootstrapping, isModelLoaded, messages, activeModel, urlSessionId, fetchSessions, activeSessionId, defaultImageModel, customInstructions, activeTools, router]
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

  const switchBranch = useCallback(async (messageId: string) => {
    // 1. Walk forward from messageId to find the leaf node of this branch
    let currentId = messageId;
    
    // Map parentMessageId to children messages
    const parentToChildren = new Map<string, ChatUiMessage[]>();
    allMessages.forEach((m) => {
      if (m.parentMessageId) {
        const children = parentToChildren.get(m.parentMessageId) || [];
        children.push(m);
        parentToChildren.set(m.parentMessageId, children);
      }
    });

    // Walk down to the leaf node
    while (true) {
      const children = parentToChildren.get(currentId);
      if (!children || children.length === 0) {
        break; // Reached leaf
      }
      // If there are multiple children (sub-branches), pick the one with the latest timestamp
      children.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      currentId = children[0].id;
    }

    const response = await fetch("/api/sessions/messages", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId: activeSessionId,
        activeMessageId: currentId,
      }),
    });

    if (!response.ok) {
      setErrorToast("Failed to switch branch.");
      return;
    }

    try {
      const res = await fetch(`/api/sessions/messages?id=${activeSessionId}`);
      if (res.ok) {
        const data = await res.json();
        const mapMsg = (m: DbMessageResponse) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: new Date(m.timestamp),
          modelName: m.modelName || undefined,
          images: m.images ? m.images.split(",") : undefined,
          generatedImages: m.generatedImages ? m.generatedImages.split(",") : undefined,
          parentMessageId: m.parentMessageId || undefined,
        });
        setMessages((data.messages || []).map(mapMsg));
        setAllMessages((data.allMessages || []).map(mapMsg));
      }
    } catch (e) {
      console.error("ChatContext: Failed to reload messages after branch switch:", e);
    }
  }, [activeSessionId, allMessages]);

  const editMessage = useCallback(async (messageId: string, newText: string) => {
    const msg = allMessages.find((m) => m.id === messageId);
    if (!msg) return;

    const parentId = msg.parentMessageId || "";

    const branchRes = await fetch("/api/sessions/messages", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId: activeSessionId,
        activeMessageId: parentId || null,
      }),
    });

    if (!branchRes.ok) {
      setErrorToast("Failed to switch branch context for editing.");
      return;
    }

    const msgIndex = messages.findIndex((m) => m.id === messageId);
    const parentPath = msgIndex >= 0 ? messages.slice(0, msgIndex) : [];
    setMessages(parentPath);
    setAllMessages(parentPath);

    await sendMessage(newText, undefined, msg.images);
  }, [messages, allMessages, activeSessionId, sendMessage]);

  const regenerateMessage = useCallback(async (assistantMessageId: string) => {
    const msgIndex = messages.findIndex((m) => m.id === assistantMessageId);
    if (msgIndex <= 0) return;

    const userPrompt = messages[msgIndex - 1];
    if (userPrompt.role !== "user") return;

    const parentId = userPrompt.parentMessageId || "";

    const branchRes = await fetch("/api/sessions/messages", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId: activeSessionId,
        activeMessageId: parentId || null,
      }),
    });

    if (!branchRes.ok) {
      setErrorToast("Failed to switch branch context for regeneration.");
      return;
    }

    const parentPath = messages.slice(0, msgIndex - 1);
    setMessages(parentPath);
    setAllMessages(parentPath);

    await sendMessage(userPrompt.content, undefined, userPrompt.images);
  }, [messages, activeSessionId, sendMessage]);

  return (
    <ChatContext.Provider
      value={{
        messages,
        allMessages,
        isGenerating,
        isBootstrapping,
        isModelLoaded,
        activeModelSupportsVision,
        activeModel,
        defaultModel,
        runnableModels,
        bootstrapChat,
        sendMessage,
        stopGeneration,
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
        availableTools,
        activeTools,
        toggleTool,
        switchBranch,
        editMessage,
        regenerateMessage,
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
