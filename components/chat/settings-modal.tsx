"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Trash2 } from "lucide-react";
import { ACCENT_COLORS, applyAccentColor } from "@/lib/accent";

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabId = "apperence" | "model" | "database";

export default function SettingsModal({ isOpen, onClose }: Readonly<SettingsModalProps>) {
  const [activeTab, setActiveTab] = useState<TabId>("model");
  const [activeTheme, setActiveTheme] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.getAttribute("data-theme") || "mocha";
    }
    return "mocha";
  });
  const [activeAccent, setActiveAccent] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("olly-accent") || "lavender";
    }
    return "lavender";
  });
  const [runnableModels, setRunnableModels] = useState<string[]>([]);
  const [defaultModel, setDefaultModelState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("olly-default-model") || "";
    }
    return "";
  });
  const [activeModel, setActiveModelState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("olly-active-model") || "";
    }
    return "";
  });

  // Pull states and simulated mocks helpers
  const [pullingStatus, setPullingStatus] = useState<Record<string, { percent: number; status: string; error?: boolean }>>({});
  const [customModelName, setCustomModelName] = useState<string>("");
  const [modelToast, setModelToast] = useState<string | null>(null);

  // Model Details pane states
  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [loadedDetails, setLoadedDetails] = useState<Record<string, any>>({});
  const [loadingDetails, setLoadingDetails] = useState<Record<string, boolean>>({});

  // Deletion confirmation state
  const [deletingModel, setDeletingModel] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement | null>(null);
  const abortControllersRef = useRef<Record<string, AbortController>>({});

  const showModelToast = (msg: string) => {
    setModelToast(msg);
    setTimeout(() => setModelToast(null), 3000);
  };

  const fetchRunnable = async () => {
    try {
      const response = await fetch("/api/models?downloaded=true");
      if (response.ok) {
        const data = await response.json();
        const list = data.models || [];

        // Read mock/simulated models from localStorage to display
        const simulatedStr = localStorage.getItem("olly-simulated-models") || "[]";
        const simulatedList: string[] = JSON.parse(simulatedStr);
        const mergedList = Array.from(new Set([...list, ...simulatedList]));

        setRunnableModels(mergedList);

        if (typeof window !== "undefined") {
          const savedDefault = localStorage.getItem("olly-default-model") || "";
          if (savedDefault && mergedList.includes(savedDefault)) {
            setDefaultModelState(savedDefault);
          } else if (mergedList.length > 0) {
            setDefaultModelState(mergedList[0]);
            localStorage.setItem("olly-default-model", mergedList[0]);
          }

          const savedActive = localStorage.getItem("olly-active-model") || "";
          if (savedActive && mergedList.includes(savedActive)) {
            setActiveModelState(savedActive);
          } else if (mergedList.length > 0) {
            setActiveModelState(mergedList[0]);
          }
        }
      }
    } catch (error) {
      console.error("Settings: Failed to load runnable models:", error);
    }
  };

  // Fetch runnable models and reset states when settings modal opens
  useEffect(() => {
    if (isOpen) {
      fetchRunnable();
      setExpandedModel(null);
      setDeletingModel(null);
      setCustomModelName("");
    }
  }, [isOpen]);

  // Listen to Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Listen to external pull cancellations from the global notification dropdown button
  useEffect(() => {
    const handleCancelRequest = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { model } = customEvent.detail;
      if (abortControllersRef.current[model]) {
        abortControllersRef.current[model].abort();
      }
    };
    window.addEventListener("olly-pull-cancel-request", handleCancelRequest);
    return () => window.removeEventListener("olly-pull-cancel-request", handleCancelRequest);
  }, []);

  if (!isOpen) return null;

  const handleThemeChange = (newTheme: string) => {
    setActiveTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    document.documentElement.style.colorScheme = newTheme === "latte" ? "light" : "dark";

    // Set cookie to persist theme on server-side renders (expiring in 1 year)
    document.cookie = `theme=${newTheme}; path=/; max-age=31536000; SameSite=Lax`;

    // Re-apply the accent color for the new theme flavor
    applyAccentColor(activeAccent, newTheme);
  };

  const handleAccentChange = (newAccent: string) => {
    setActiveAccent(newAccent);
    localStorage.setItem("olly-accent", newAccent);
    applyAccentColor(newAccent, activeTheme);
  };

  const handleDefaultModelChange = (val: string) => {
    setDefaultModelState(val);
    localStorage.setItem("olly-default-model", val);
  };

  const handleActiveModelChange = (val: string) => {
    setActiveModelState(val);
    localStorage.setItem("olly-active-model", val);
    window.dispatchEvent(new Event("olly-active-model-changed"));
  };

  // Helper to fetch details on double-click
  const handleModelDoubleClick = async (modelName: string) => {
    // Toggle details pane if already expanded
    if (expandedModel === modelName) {
      setExpandedModel(null);
      return;
    }

    setExpandedModel(modelName);

    // If details are already loaded, do not re-fetch
    if (loadedDetails[modelName]) return;

    // Fast mock fallback for simulated models
    if (modelName.startsWith("mock-")) {
      setLoadedDetails((prev) => ({
        ...prev,
        [modelName]: {
          name: modelName,
          size: "3.8 GB",
          sizeInRam: "4.2 GB (VRAM)",
          isLoaded: true,
          format: "gguf",
          family: "llama",
          quantization: "Q4_K_M",
          capabilities: ["completion", "tools", "thinking"],
        },
      }));
      return;
    }

    setLoadingDetails((prev) => ({ ...prev, [modelName]: true }));

    try {
      const response = await fetch(`/api/models/details?model=${encodeURIComponent(modelName)}`);
      if (response.ok) {
        const data = await response.json();
        setLoadedDetails((prev) => ({ ...prev, [modelName]: data }));
      } else {
        throw new Error("Failed to load details");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDetails((prev) => ({ ...prev, [modelName]: false }));
    }
  };

  // Simulated pull progress logic for mock- prefixed models
  const runSimulatedPull = (modelName: string) => {
    setPullingStatus((prev) => ({
      ...prev,
      [modelName]: { percent: 0, status: "Simulating download..." },
    }));

    window.dispatchEvent(
      new CustomEvent("olly-pull-start", {
        detail: { model: modelName },
      })
    );

    let currentPercent = 0;
    const interval = setInterval(() => {
      currentPercent += 10;
      if (currentPercent > 100) {
        clearInterval(interval);

        // Clean status
        setPullingStatus((prev) => {
          const next = { ...prev };
          delete next[modelName];
          return next;
        });

        // Add to local simulated models list
        const simulatedStr = localStorage.getItem("olly-simulated-models") || "[]";
        const simulatedList: string[] = JSON.parse(simulatedStr);
        if (!simulatedList.includes(modelName)) {
          simulatedList.push(modelName);
          localStorage.setItem("olly-simulated-models", JSON.stringify(simulatedList));
        }

        window.dispatchEvent(
          new CustomEvent("olly-pull-complete", {
            detail: { model: modelName, success: true },
          })
        );

        showModelToast(`Mock model "${modelName}" installed successfully!`);
        fetchRunnable();
        window.dispatchEvent(new Event("olly-runnable-models-changed"));
        delete abortControllersRef.current[modelName];
      } else {
        setPullingStatus((prev) => ({
          ...prev,
          [modelName]: { percent: currentPercent, status: "Downloading model chunks..." },
        }));

        window.dispatchEvent(
          new CustomEvent("olly-pull-progress", {
            detail: { model: modelName, percent: currentPercent, status: "Downloading model chunks..." },
          })
        );
      }
    }, 500);

    // Save cancellation handle as a mock AbortController structure
    abortControllersRef.current[modelName] = {
      abort: () => {
        clearInterval(interval);
        setPullingStatus((prev) => {
          const next = { ...prev };
          delete next[modelName];
          return next;
        });
        window.dispatchEvent(
          new CustomEvent("olly-pull-complete", {
            detail: { model: modelName, success: false, error: "Aborted by user" },
          })
        );
        showModelToast(`Download for "${modelName}" cancelled.`);
        delete abortControllersRef.current[modelName];
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  };

  const handlePullModel = async (modelName: string) => {
    if (!modelName.trim()) return;

    // Route to simulated pulls if prefixed with mock-
    if (modelName.startsWith("mock-")) {
      runSimulatedPull(modelName);
      return;
    }

    setPullingStatus((prev) => ({
      ...prev,
      [modelName]: { percent: 0, status: "Starting..." },
    }));

    const controller = new AbortController();
    abortControllersRef.current[modelName] = controller;

    window.dispatchEvent(
      new CustomEvent("olly-pull-start", {
        detail: { model: modelName },
      })
    );

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

              window.dispatchEvent(
                new CustomEvent("olly-pull-progress", {
                  detail: { model: modelName, percent, status },
                })
              );
            } else if (chunk.status) {
              const status = chunk.status;
              setPullingStatus((prev) => ({
                ...prev,
                [modelName]: {
                  percent: prev[modelName]?.percent || 0,
                  status,
                },
              }));

              window.dispatchEvent(
                new CustomEvent("olly-pull-progress", {
                  detail: { model: modelName, percent: pullingStatus[modelName]?.percent || 0, status },
                })
              );
            }
          } catch (e) {
            console.error("Error parsing progress chunk:", e);
          }
        }
      }

      setPullingStatus((prev) => {
        const next = { ...prev };
        delete next[modelName];
        return next;
      });

      window.dispatchEvent(
        new CustomEvent("olly-pull-complete", {
          detail: { model: modelName, success: true },
        })
      );

      showModelToast(`Model "${modelName}" installed!`);
      await fetchRunnable();
      window.dispatchEvent(new Event("olly-runnable-models-changed"));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      if (err.name === "AbortError") {
        setPullingStatus((prev) => {
          const next = { ...prev };
          delete next[modelName];
          return next;
        });
        window.dispatchEvent(
          new CustomEvent("olly-pull-complete", {
            detail: { model: modelName, success: false, error: "Aborted by user" },
          })
        );
        showModelToast(`Download for "${modelName}" cancelled.`);
        return;
      }

      console.error("Error pulling model:", err);
      setPullingStatus((prev) => ({
        ...prev,
        [modelName]: { percent: 0, status: err.message || "Failed", error: true },
      }));

      window.dispatchEvent(
        new CustomEvent("olly-pull-complete", {
          detail: { model: modelName, success: false, error: err.message },
        })
      );

      showModelToast(`Failed: ${err.message}`);
    } finally {
      delete abortControllersRef.current[modelName];
    }
  };

  const handleDeleteModel = async (modelName: string) => {
    // If it's a simulated model, delete it locally from localStorage
    if (modelName.startsWith("mock-")) {
      const simulatedStr = localStorage.getItem("olly-simulated-models") || "[]";
      let simulatedList: string[] = JSON.parse(simulatedStr);
      simulatedList = simulatedList.filter((m) => m !== modelName);
      localStorage.setItem("olly-simulated-models", JSON.stringify(simulatedList));

      showModelToast(`Mock model "${modelName}" deleted.`);
      await fetchRunnable();
      window.dispatchEvent(new Event("olly-runnable-models-changed"));
      return;
    }

    try {
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

      showModelToast(`Model "${modelName}" deleted.`);
      await fetchRunnable();
      window.dispatchEvent(new Event("olly-runnable-models-changed"));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error("Error deleting model:", err);
      showModelToast(`Failed: ${err.message}`);
    }
  };

  const handlePullCustomModel = () => {
    const name = customModelName.trim();
    if (!name) return;
    setCustomModelName("");
    handlePullModel(name);
  };

  // Close modal if user clicks the backdrop overlay outside the card
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: "apperence", label: "Apperence" },
    { id: "model", label: "Model" },
    { id: "database", label: "Database" },
  ];

  const allModelNames = Array.from(
    new Set([
      ...runnableModels,
      ...Object.keys(pullingStatus),
    ])
  );

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 bg-black/15 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in"
    >
      <div
        ref={modalRef}
        className="bg-base-200 text-base-content rounded-2xl border border-base-content/10 w-full max-w-4xl h-[440px] max-h-[90vh] shadow-2xl p-6 overflow-hidden flex flex-col select-none relative"
      >
        {/* Header: Title is always left-aligned, close button is on the right */}
        <div className="flex items-center justify-between border-b border-base-content/10 pb-4 mb-5 shrink-0">
          <h3 className="text-lg font-bold uppercase tracking-wider text-base-content">
            {activeTab === "apperence"
              ? "Appearance Settings"
              : activeTab === "model"
              ? "Model Settings"
              : "Database Configuration"}
          </h3>
          <button
            onClick={onClose}
            className="btn btn-sm btn-ghost btn-circle text-base-content/60 hover:text-base-content hover:bg-base-200 focus:outline-hidden"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content: Split Pane */}
        <div className="flex-1 flex gap-6 overflow-hidden min-h-0">
          {/* Left Navigation Bar */}
          <div className="w-40 shrink-0 flex flex-col border-r border-base-content/10 pr-4 select-none">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setExpandedModel(null); // Clear detail states on tab shift
                }}
                className={`py-2 px-3 text-left text-base rounded-xl font-bold uppercase tracking-wide transition-all ${
                  activeTab === tab.id
                    ? "bg-user-accent/10 text-user-accent border-l-3 border-user-accent pl-2.5"
                    : "text-base-content/65 hover:text-base-content hover:bg-base-content/5"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Right Content Pane: Scrollable internally on overflow */}
          <div className="flex-1 h-full overflow-y-auto pr-1 select-text">
            {activeTab === "apperence" && (
              <div className="flex flex-col gap-1">
                {/* Theme Selector Row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 py-3 border-b border-base-content/5">
                  <div className="flex flex-col text-left gap-0.5 max-w-xs">
                    <span className="text-base font-bold uppercase tracking-wider text-base-content">
                      Theme:
                    </span>
                    <span className="text-sm text-base-content/80 leading-relaxed font-sans select-none">
                      Customize the global background theme (Latte, Frappé, Macchiato, Mocha).
                    </span>
                  </div>
                  <select
                    value={activeTheme}
                    onChange={(e) => handleThemeChange(e.target.value)}
                    className="select select-bordered select-sm w-full sm:w-48 bg-base-300 font-sans cursor-pointer focus:outline-hidden text-base h-9 px-3"
                  >
                    <option value="latte">Latte (Light)</option>
                    <option value="frappe">Frappé (Dark)</option>
                    <option value="macchiato">Macchiato (Dark)</option>
                    <option value="mocha">Mocha (Default Dark)</option>
                  </select>
                </div>

                {/* Accent Selector Row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 py-3 mt-1">
                  <div className="flex flex-col text-left gap-0.5 max-w-xs">
                    <span className="text-base font-bold uppercase tracking-wider text-base-content">
                      Accent:
                    </span>
                    <span className="text-sm text-base-content/80 leading-relaxed font-sans select-none">
                      Select your highlight color preference applied to buttons, borders, and active tabs.
                    </span>
                  </div>
                  <select
                    value={activeAccent}
                    onChange={(e) => handleAccentChange(e.target.value)}
                    className="select select-bordered select-sm w-full sm:w-48 bg-base-300 font-sans cursor-pointer focus:outline-hidden text-base h-9 px-3"
                  >
                    {Object.entries(ACCENT_COLORS).map(([key, color]) => (
                      <option key={key} value={key}>
                        {color.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {activeTab === "model" && (
              <div className="flex flex-col gap-1 pb-4">
                {/* Default Model Select Row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 py-3 border-b border-base-content/5">
                  <div className="flex flex-col text-left gap-0.5 max-w-xs">
                    <span className="text-base font-bold uppercase tracking-wider text-base-content">
                      Default Model:
                    </span>
                    <span className="text-sm text-base-content/80 leading-relaxed font-sans select-none">
                      The model used automatically when starting a new chat session.
                    </span>
                  </div>
                  <select
                    value={defaultModel}
                    onChange={(e) => handleDefaultModelChange(e.target.value)}
                    disabled={runnableModels.length === 0}
                    className="select select-bordered select-sm w-full sm:w-48 bg-base-300 font-sans cursor-pointer focus:outline-hidden text-base h-9 px-3"
                  >
                    {runnableModels.length === 0 ? (
                      <option value="">No models installed</option>
                    ) : (
                      runnableModels.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Active Model Select Row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 py-3">
                  <div className="flex flex-col text-left gap-0.5 max-w-xs">
                    <span className="text-base font-bold uppercase tracking-wider text-base-content">
                      Active Model:
                    </span>
                    <span className="text-sm text-base-content/80 leading-relaxed font-sans select-none">
                      The model currently processing responses in this chat thread.
                    </span>
                  </div>
                  <select
                    value={activeModel}
                    onChange={(e) => handleActiveModelChange(e.target.value)}
                    disabled={runnableModels.length === 0}
                    className="select select-bordered select-sm w-full sm:w-48 bg-base-300 font-sans cursor-pointer focus:outline-hidden text-base h-9 px-3"
                  >
                    {runnableModels.length === 0 ? (
                      <option value="">No models installed</option>
                    ) : (
                      runnableModels.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Installed Models Section */}
                <div className="flex flex-col gap-1 py-3 border-t border-base-content/5 mt-3 select-none">
                  <span className="text-base font-bold uppercase tracking-wider text-base-content">
                    Installed Models:
                  </span>
                  <span className="text-xs text-base-content/80 leading-relaxed font-sans select-none mb-2">
                    Double click on a model name to see its details.
                  </span>

                  <div className="flex flex-col gap-2">
                    {allModelNames.length === 0 ? (
                      <span className="text-sm text-base-content/40 italic py-2">
                        No models installed. Pull a model using the form below.
                      </span>
                    ) : (
                      allModelNames.map((name) => {
                        const isInstalled = runnableModels.includes(name);
                        const pullState = pullingStatus[name];

                        return (
                          <div key={name} className="flex flex-col w-full">
                            <div
                              className="flex items-center justify-between py-1.5 px-3 bg-base-300/40 rounded-xl border border-base-content/5 hover:border-base-content/10 transition-all gap-4"
                            >
                              {/* Model name trigger details pane on double click */}
                              <span
                                onDoubleClick={() => handleModelDoubleClick(name)}
                                className="text-xs font-mono font-bold text-base-content leading-none cursor-pointer hover:underline py-1 flex-1 text-left"
                                title="Double click to view details"
                              >
                                {name}
                              </span>

                              <div className="flex items-center gap-2">
                                {pullState ? (
                                  <div className="flex items-center gap-2">
                                    <progress
                                      className={`progress progress-primary w-16 sm:w-24 ${
                                        pullState.error ? "progress-error" : "animate-pulse"
                                      }`}
                                      value={pullState.percent}
                                      max="100"
                                    ></progress>
                                    <span className="text-[10px] font-mono font-bold text-base-content/60 leading-none">
                                      {pullState.percent}%
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => abortControllersRef.current[name]?.abort()}
                                      className="btn btn-xs btn-ghost text-error hover:bg-error/15 hover:text-error rounded-full px-2 text-[9px] font-bold uppercase h-5 min-h-0"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : isInstalled ? (
                                  <div className="flex items-center gap-2">
                                    {deletingModel === name ? (
                                      // Confirmation State: Confirm comes BEFORE cancel
                                      <div className="flex items-center gap-1.5 animate-fade-in select-none">
                                        <button
                                          onClick={() => {
                                            handleDeleteModel(name);
                                            setDeletingModel(null);
                                          }}
                                          className="btn btn-xs bg-error hover:bg-error/85 border-none text-error-content rounded-lg text-[9px] font-bold uppercase h-5 min-h-0"
                                        >
                                          Confirm
                                        </button>
                                        <button
                                          onClick={() => setDeletingModel(null)}
                                          className="btn btn-xs bg-base-content/10 hover:bg-base-content/15 border-none text-base-content rounded-lg text-[9px] font-bold uppercase h-5 min-h-0"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    ) : (
                                      // Standard state
                                      <>
                                        {name.startsWith("mock-") && (
                                          <span className="badge badge-warning text-[9px] font-bold uppercase py-0.5 text-warning-content px-1.5 rounded-md border-none scale-90 select-none">
                                            Simulated
                                          </span>
                                        )}
                                        <button
                                          onClick={() => setDeletingModel(name)}
                                          className="btn btn-xs btn-ghost text-error hover:bg-error/15 hover:text-error rounded-full p-1 h-6 w-6 min-h-0 shrink-0"
                                          title="Delete model"
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handlePullModel(name)}
                                    className="btn btn-xs border-user-accent/40 text-user-accent hover:bg-user-accent/15 hover:border-user-accent bg-transparent rounded-full px-3 text-[10px] font-bold uppercase h-6 min-h-0 shrink-0"
                                  >
                                    Pull
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Collapsible Details Pane */}
                            {expandedModel === name && (
                              <div className="mt-1.5 p-3 bg-base-300/60 rounded-xl border border-base-content/5 text-left text-xs font-sans text-base-content/85 flex flex-col gap-1.5 select-text animate-fade-in mx-1">
                                {loadingDetails[name] ? (
                                  <div className="flex items-center gap-2 text-base-content/50 select-none py-1.5">
                                    <span className="loading loading-spinner loading-xs text-user-accent"></span>
                                    <span>Loading model metadata...</span>
                                  </div>
                                ) : loadedDetails[name] ? (
                                  <>
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 font-mono text-xs">
                                      <div>
                                        <span className="opacity-55">Size on Disk:</span>{" "}
                                        {loadedDetails[name].size}
                                      </div>
                                      <div>
                                        <span className="opacity-55">Size in VRAM/RAM:</span>{" "}
                                        {loadedDetails[name].sizeInRam || "0 B"}
                                      </div>
                                      <div>
                                        <span className="opacity-55">Format:</span>{" "}
                                        {loadedDetails[name].format}
                                      </div>
                                      <div>
                                        <span className="opacity-55">Family:</span>{" "}
                                        {loadedDetails[name].family}
                                      </div>
                                      <div>
                                        <span className="opacity-55">Quantization:</span>{" "}
                                        {loadedDetails[name].quantization}
                                      </div>
                                      <div>
                                        <span className="opacity-55">Status:</span>{" "}
                                        <span
                                          className={
                                            loadedDetails[name].isLoaded
                                              ? "text-success font-bold"
                                              : "opacity-60"
                                          }
                                        >
                                          {loadedDetails[name].isLoaded
                                            ? "Loaded in memory"
                                            : "Idle"}
                                        </span>
                                      </div>
                                    </div>
                                    {loadedDetails[name].capabilities?.length > 0 && (
                                      <div className="mt-1.5 flex flex-wrap gap-1 items-center">
                                        <span className="opacity-55 font-mono text-[11px] mr-1">
                                          Capabilities:
                                        </span>
                                        {loadedDetails[name].capabilities.map((cap: string) => (
                                          <span
                                            key={cap}
                                            className="badge bg-base-content/10 text-base-content/80 border-none font-mono text-[9px] scale-90 px-1.5 py-0.5 rounded-md select-none"
                                          >
                                            {cap}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <div className="text-error/70 font-medium py-1 select-none">
                                    Failed to load model metadata.
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Pull Custom Model Section */}
                <div className="flex flex-col gap-2 py-3 border-t border-base-content/5 mt-1 select-none">
                  <span className="text-base font-bold uppercase tracking-wider text-base-content">
                    Pull Custom Model:
                  </span>
                  <span className="text-xs text-base-content/80 leading-relaxed font-sans select-none mb-1">
                    To test offline simulated pulls, type <code className="bg-base-300 px-1 py-0.5 rounded-sm">mock-llama3</code> or similar and click Pull.
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter model name (e.g. qwen2.5:3b)"
                      value={customModelName}
                      onChange={(e) => setCustomModelName(e.target.value)}
                      className="input input-bordered input-sm flex-1 bg-base-300 border-base-content/15 font-sans focus:outline-hidden text-base h-8 px-2.5 rounded-lg"
                    />
                    <button
                      onClick={handlePullCustomModel}
                      disabled={!customModelName.trim()}
                      className="btn btn-sm shrink-0 border-user-accent bg-user-accent hover:bg-user-accent/85 hover:border-user-accent/85 text-base-100 uppercase tracking-wider font-bold h-8 text-[11px] px-4 rounded-lg cursor-pointer disabled:opacity-40"
                    >
                      Pull
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "database" && (
              <div className="flex flex-col gap-3 py-2 text-left">
                <span className="text-base font-bold uppercase tracking-wider text-base-content">
                  Database History:
                </span>
                <p className="text-base text-base-content/80 italic bg-base-300 p-4 rounded-xl border border-base-content/5">
                  Currently running: SQLite (No active sessions saved)
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Floating internal Model Toast overlay */}
        {modelToast && (
          <div className="toast toast-bottom toast-center z-50 absolute pointer-events-none pb-4 animate-fade-in">
            <div className="alert alert-success shadow-lg text-xs rounded-xl py-2.5 px-5 text-success-content font-sans border-none select-text">
              <span>{modelToast}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
