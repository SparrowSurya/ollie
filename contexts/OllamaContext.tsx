"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";

export interface PullState {
  percent: number;
  status: string;
  error?: boolean;
}

interface OllamaContextType {
  runnableModels: string[];
  imageModels: string[];
  allInstalledModels: string[];
  defaultModel: string;
  defaultImageModel: string;
  activeModel: string;
  pullingStatus: Record<string, PullState>;
  isInitializing: boolean;
  setDefaultModel: (modelName: string) => void;
  setDefaultImageModel: (modelName: string) => void;
  setActiveModel: (modelName: string) => void;
  fetchRunnableModels: () => Promise<void>;
  pullModel: (modelName: string) => Promise<void>;
  cancelPull: (modelName: string) => void;
  deleteModel: (modelName: string) => Promise<void>;
}

const OllamaContext = createContext<OllamaContextType | undefined>(undefined);

export function OllamaProvider({ children }: { children: React.ReactNode }) {
  const [runnableModels, setRunnableModels] = useState<string[]>([]);
  const [imageModels, setImageModels] = useState<string[]>([]);
  const [allInstalledModels, setAllInstalledModels] = useState<string[]>([]);
  const [defaultModel, setDefaultModelState] = useState<string>("");
  const [defaultImageModel, setDefaultImageModelState] = useState<string>("");
  const [activeModel, setActiveModelState] = useState<string>("");
  const [pullingStatus, setPullingStatus] = useState<Record<string, PullState>>({});
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  const abortControllersRef = useRef<Record<string, AbortController>>({});

  const fetchRunnableModels = async () => {
    try {
      const response = await fetch("/api/models");
      if (response.ok) {
        const data = await response.json();
        const list = data.models || [];
        const imgList = data.imageModels || [];
        const allList = data.allInstalledModels || [];
        setRunnableModels(list);
        setImageModels(imgList);
        setAllInstalledModels(allList);

        // Resolve default model
        const savedDefault = localStorage.getItem("ollie-default-model") || "";
        if (savedDefault && list.includes(savedDefault)) {
          setDefaultModelState(savedDefault);
        } else if (list.length > 0) {
          setDefaultModelState(list[0]);
          localStorage.setItem("ollie-default-model", list[0]);
        }

        // Resolve default image model
        const savedDefaultImg = localStorage.getItem("ollie-default-image-model") || "";
        if (savedDefaultImg && imgList.includes(savedDefaultImg)) {
          setDefaultImageModelState(savedDefaultImg);
        } else if (imgList.length > 0) {
          setDefaultImageModelState(imgList[0]);
          localStorage.setItem("ollie-default-image-model", imgList[0]);
        }

        // Resolve active model
        const savedActive = localStorage.getItem("ollie-active-model") || "";
        if (savedActive && (list.includes(savedActive) || imgList.includes(savedActive))) {
          setActiveModelState(savedActive);
        } else if (list.length > 0) {
          setActiveModelState(list[0]);
        } else if (imgList.length > 0) {
          setActiveModelState(imgList[0]);
        }
      }
    } catch (error) {
      console.error("OllamaContext: Failed to load runnable models:", error);
    }
  };

  // Sync preferences on mount
  useEffect(() => {
    const init = async () => {
      await fetchRunnableModels();
      setIsInitializing(false);
    };
    init();
  }, []);

  const setDefaultModel = (modelName: string) => {
    setDefaultModelState(modelName);
    localStorage.setItem("ollie-default-model", modelName);
  };

  const setDefaultImageModel = (modelName: string) => {
    setDefaultImageModelState(modelName);
    localStorage.setItem("ollie-default-image-model", modelName);
  };

  const setActiveModel = (modelName: string) => {
    setActiveModelState(modelName);
    localStorage.setItem("ollie-active-model", modelName);
  };

  const cancelPull = (modelName: string) => {
    const controller = abortControllersRef.current[modelName];
    if (controller) {
      controller.abort();
      delete abortControllersRef.current[modelName];
    }
    // Explicitly notify the backend to cancel and close connection to Ollama daemon
    fetch("/api/models/pull/cancel", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: modelName }),
    }).catch((err) => {
      console.error("Failed to notify server of pull cancellation:", err);
    });
  };

  const pullModel = async (modelName: string) => {
    if (!modelName.trim()) return;

    // Initialize progress state
    setPullingStatus((prev) => ({
      ...prev,
      [modelName]: { percent: 0, status: "Starting..." },
    }));

    const controller = new AbortController();
    abortControllersRef.current[modelName] = controller;

    try {
      const response = await fetch("/api/models/pull", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: modelName }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to initiate pull");
      }

      if (!response.body) {
        throw new Error("No response stream body returned");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const chunk = JSON.parse(line);
            if (chunk.error) {
              throw new Error(chunk.error);
            }
            if (chunk.completed && chunk.total) {
              const percent = Math.round((chunk.completed / chunk.total) * 100);
              const status = chunk.status || "Downloading...";
              setPullingStatus((prev) => ({
                ...prev,
                [modelName]: { percent, status },
              }));
            } else if (chunk.status) {
              const status = chunk.status;
              setPullingStatus((prev) => ({
                ...prev,
                [modelName]: {
                  percent: prev[modelName]?.percent || 0,
                  status,
                },
              }));
            }
          } catch (e) {
            console.error("OllamaContext: Error parsing progress chunk:", e);
          }
        }
      }

      // Reload list of runnable models
      await fetchRunnableModels();

      // Completed successfully
      setPullingStatus((prev) => {
        const next = { ...prev };
        delete next[modelName];
        return next;
      });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      if (err.name === "AbortError") {
        setPullingStatus((prev) => {
          const next = { ...prev };
          delete next[modelName];
          return next;
        });
        throw err; // Propagate up for UI toasts
      }

      console.error("OllamaContext: Error pulling model:", err);
      setPullingStatus((prev) => ({
        ...prev,
        [modelName]: { percent: 0, status: err.message || "Failed", error: true },
      }));
      throw err;
    } finally {
      delete abortControllersRef.current[modelName];
    }
  };

  const deleteModel = async (modelName: string) => {
    const response = await fetch("/api/models/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: modelName }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || "Failed to delete");
    }

    await fetchRunnableModels();

    // Reset default or active model if they were deleted
    setRunnableModels((prevModels) => {
      // Check default model
      const savedDefault = localStorage.getItem("ollie-default-model") || "";
      if (savedDefault === modelName || !prevModels.includes(savedDefault)) {
        const nextDefault = prevModels.length > 0 ? prevModels[0] : "";
        setDefaultModelState(nextDefault);
        localStorage.setItem("ollie-default-model", nextDefault);
      }

      // Check active model
      const savedActive = localStorage.getItem("ollie-active-model") || "";
      if (savedActive === modelName || !prevModels.includes(savedActive)) {
        const nextActive = prevModels.length > 0 ? prevModels[0] : "";
        setActiveModelState(nextActive);
        localStorage.setItem("ollie-active-model", nextActive);
      }
      return prevModels;
    });
  };

  return (
    <OllamaContext.Provider
      value={{
        runnableModels,
        imageModels,
        allInstalledModels,
        defaultModel,
        defaultImageModel,
        activeModel,
        pullingStatus,
        isInitializing,
        setDefaultModel,
        setDefaultImageModel,
        setActiveModel,
        fetchRunnableModels,
        pullModel,
        cancelPull,
        deleteModel,
      }}
    >
      {children}
    </OllamaContext.Provider>
  );
}

export function useOllama() {
  const context = useContext(OllamaContext);
  if (context === undefined) {
    throw new Error("useOllama must be used within an OllamaProvider");
  }
  return context;
}
