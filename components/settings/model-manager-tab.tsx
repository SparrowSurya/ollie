import React, { useState } from "react";
import { Trash2 } from "lucide-react";
import { useOllama } from "@/contexts/OllamaContext";

export default function ModelManagerTab() {
  const {
    runnableModels,
    imageModels,
    allInstalledModels,
    disabledModels,
    defaultModel,
    defaultImageModel,
    activeModel,
    pullingStatus,
    setDefaultModel,
    setDefaultImageModel,
    pullModel,
    cancelPull,
    deleteModel,
  } = useOllama();

  const [customModelName, setCustomModelName] = useState<string>("");
  const [modelToast, setModelToast] = useState<string | null>(null);

  const [prevActiveModel, setPrevActiveModel] = useState(activeModel);
  const [activeSubTab, setActiveSubTabState] = useState<"ollama" | "openai" | "anthropic" | "gemini">(() => {
    if (typeof window !== "undefined") {
      const active = localStorage.getItem("ollie-active-model") || activeModel || "";
      if (active.startsWith("openai/")) return "openai";
      if (active.startsWith("anthropic/")) return "anthropic";
      if (active.startsWith("gemini/")) return "gemini";
      const lastOpened = localStorage.getItem("ollie-last-model-tab");
      if (lastOpened === "ollama" || lastOpened === "openai" || lastOpened === "anthropic" || lastOpened === "gemini") {
        return lastOpened;
      }
    }
    return "ollama";
  });

  // Synchronously adjust tab state during render if the active model changes (React Guideline #62)
  if (activeModel !== prevActiveModel) {
    setPrevActiveModel(activeModel);
    let newTab: "ollama" | "openai" | "anthropic" | "gemini" = "ollama";
    if (activeModel.startsWith("openai/")) newTab = "openai";
    else if (activeModel.startsWith("anthropic/")) newTab = "anthropic";
    else if (activeModel.startsWith("gemini/")) newTab = "gemini";
    setActiveSubTabState(newTab);
  }

  const setActiveSubTab = (tab: "ollama" | "openai" | "anthropic" | "gemini") => {
    setActiveSubTabState(tab);
    if (typeof window !== "undefined") {
      localStorage.setItem("ollie-last-model-tab", tab);
    }
  };

  // Model Details pane states
  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [loadedDetails, setLoadedDetails] = useState<Record<string, any>>({});
  const [loadingDetails, setLoadingDetails] = useState<Record<string, boolean>>({});

  // Deletion confirmation state
  const [deletingModel, setDeletingModel] = useState<string | null>(null);

  const showModelToast = (msg: string) => {
    setModelToast(msg);
    setTimeout(() => setModelToast(null), 3000);
  };

  const handleModelDoubleClick = async (modelName: string) => {
    if (expandedModel === modelName) {
      setExpandedModel(null);
      return;
    }

    setExpandedModel(modelName);

    if (loadedDetails[modelName]) return;

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

  const handlePullTrigger = async (name: string) => {
    try {
      await pullModel(name);
      showModelToast(`Model "${name}" successfully pulled!`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      if (err.name === "AbortError") {
        showModelToast(`Download for "${name}" cancelled.`);
      } else {
        showModelToast(`Failed: ${err.message || "Unknown error"}`);
      }
    }
  };

  const handlePullCustomModel = () => {
    const name = customModelName.trim();
    if (!name) return;
    setCustomModelName("");
    handlePullTrigger(name);
  };

  const handleDeleteTrigger = async (name: string) => {
    try {
      await deleteModel(name);
      showModelToast(`Model "${name}" deleted.`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      showModelToast(`Failed to delete: ${err.message || "Unknown error"}`);
    }
  };

  const allModelNames = Array.from(
    new Set([
      ...allInstalledModels,
      ...Object.keys(pullingStatus),
    ])
  );

  const renderRemoteProvider = (provider: "openai" | "anthropic" | "gemini") => {
    const providerPrefix = `${provider}/`;
    const providerModels = runnableModels.filter((m) => m.startsWith(providerPrefix));
    const isKeyMissing = providerModels.length > 0 && providerModels.every((m) => disabledModels.includes(m));
    const envKeyName = provider === "openai" ? "OPENAI_API_KEY" : provider === "anthropic" ? "ANTHROPIC_API_KEY" : "GEMINI_API_KEY";
    const providerName = provider === "openai" ? "OpenAI" : provider === "anthropic" ? "Anthropic" : "Google Gemini";

    return (
      <div className="flex flex-col gap-4 pb-4 select-none">
        {/* Status Alerts */}
        {isKeyMissing ? (
          <div className="alert alert-warning text-xs font-sans rounded-xl p-3 bg-warning/10 border-none text-warning flex flex-col gap-1 items-start text-left leading-relaxed">
            <span className="font-bold">⚠️ Integration Offline</span>
            <span>The environment variable <code>{envKeyName}</code> is not configured on the server. Models from {providerName} will remain visible but cannot be selected for chats.</span>
          </div>
        ) : (
          <div className="alert alert-success text-xs font-sans rounded-xl p-3 bg-success/15 border-none text-success flex flex-col gap-1 items-start text-left leading-relaxed">
            <span className="font-bold">✅ Integration Online</span>
            <span>All configured models for {providerName} are ready to use.</span>
          </div>
        )}

        {/* Remote Models List */}
        <div className="flex flex-col gap-1 text-left">
          <span className="text-sm font-bold uppercase tracking-wider text-base-content">
            Configured Models:
          </span>
          <span className="text-xs text-base-content/60 leading-relaxed font-sans mb-2">
            These models are loaded dynamically from the server&apos;s registry config file.
          </span>

          <div className="flex flex-col gap-2">
            {providerModels.map((m) => {
              const isDisabled = disabledModels.includes(m);
              const displayName = m.replace(providerPrefix, "").replace(/-/g, " ").toUpperCase();
              return (
                <div key={m} className="flex flex-col w-full text-left">
                  <div className="flex items-center justify-between py-2 px-3 bg-base-content/5 backdrop-blur-xs rounded-xl border border-base-content/5">
                    <div className="flex flex-col gap-0.5 truncate pr-4">
                      <span className={`text-xs font-mono font-bold ${isDisabled ? "text-base-content/40 line-through" : "text-base-content"}`}>
                        {displayName}
                      </span>
                      <span className="text-[10px] text-base-content/50 font-mono">
                        ID: {m}
                      </span>
                    </div>

                    <span className={`badge badge-xs text-[9px] font-sans border-none font-bold px-2 py-1 rounded-md shrink-0 ${
                      isDisabled ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
                    }`}>
                      {isDisabled ? "DISABLED" : "ACTIVE"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden select-none">
      {/* Horizontal Sub-tabs Pills Row */}
      <div className="flex gap-2 border-b border-base-content/5 pb-3 mb-3 shrink-0">
        {[
          { id: "ollama", label: "Ollama" },
          { id: "gemini", label: "Google" },
          { id: "openai", label: "OpenAI" },
          { id: "anthropic", label: "Anthropic" },
        ].map((tab) => {
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`py-1 px-3 text-xs rounded-full font-semibold uppercase tracking-wider transition-all select-none border ${
                isActive
                  ? "bg-user-accent/15 border-user-accent text-user-accent font-bold"
                  : "text-base-content/60 border-transparent hover:text-base-content hover:bg-base-content/5"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Sub-tab Content Area below it (Scrollable) */}
      <div className="flex-1 overflow-y-auto pr-1">
        {activeSubTab === "ollama" ? (
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
              <div className="flex flex-col items-end gap-1.5 w-full sm:w-auto">
                <select
                  value={defaultModel}
                  onChange={(e) => setDefaultModel(e.target.value)}
                  disabled={runnableModels.length === 0}
                  className="select select-bordered select-sm w-full sm:w-48 bg-base-200 font-sans cursor-pointer focus:outline-hidden text-base h-9 px-3"
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
                {runnableModels.length === 0 && (
                  <span className="text-[10px] text-error/85 font-mono italic text-right leading-tight max-w-48 select-none">
                    No models are installed.
                  </span>
                )}
              </div>
            </div>

            {/* Default Image Model Select Row */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 py-3 border-b border-base-content/5">
              <div className="flex flex-col text-left gap-0.5 max-w-xs">
                <span className="text-base font-bold uppercase tracking-wider text-base-content">
                  Default Image Model:
                </span>
                <span className="text-sm text-base-content/80 leading-relaxed font-sans select-none">
                  The model used automatically when generating local images.
                </span>
              </div>
              <div className="flex flex-col items-end gap-1.5 w-full sm:w-auto">
                <select
                  value={defaultImageModel}
                  onChange={(e) => setDefaultImageModel(e.target.value)}
                  disabled={imageModels.length === 0}
                  className="select select-bordered select-sm w-full sm:w-48 bg-base-200 font-sans cursor-pointer focus:outline-hidden text-base h-9 px-3"
                >
                  {imageModels.length === 0 ? (
                    <option value="">No image models installed</option>
                  ) : (
                    imageModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))
                  )}
                </select>
                {imageModels.length === 0 && (
                  <span className="text-[10px] text-error/85 font-mono italic text-right leading-tight max-w-48 select-none">
                    No model found with image capability.
                  </span>
                )}
              </div>
            </div>

            {/* Installed Models Section */}
            <div className="flex flex-col gap-1 py-3 select-none">
              <span className="text-base font-bold uppercase tracking-wider text-base-content text-left">
                Installed Models:
              </span>
              <span className="text-xs text-base-content/80 leading-relaxed font-sans select-none mb-2 text-left">
                Double click on a model name to see its details.
              </span>

              <div className="flex flex-col gap-2">
                {allModelNames.length === 0 ? (
                  <span className="text-sm text-base-content/40 italic py-2 text-left">
                    No models installed. Pull a model using the form below.
                  </span>
                ) : (
                  allModelNames.map((name) => {
                    const isInstalled = allInstalledModels.includes(name);
                    const pullState = pullingStatus[name];

                    return (
                      <div key={name} className="flex flex-col w-full animate-fade-in">
                        <div className="flex items-center justify-between py-1.5 px-3 bg-base-content/5 backdrop-blur-xs rounded-xl border border-base-content/5 hover:border-base-content/10 transition-all gap-4">
                          <span
                            onDoubleClick={() => handleModelDoubleClick(name)}
                            className="text-xs font-mono font-bold text-base-content leading-none cursor-pointer hover:underline py-1 flex-1 text-left truncate"
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
                                  onClick={() => cancelPull(name)}
                                  className="btn btn-xs btn-ghost text-error hover:bg-error/15 hover:text-error rounded-full px-2 text-[9px] font-bold uppercase h-5 min-h-0"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : isInstalled ? (
                              <div className="flex items-center gap-2">
                                {deletingModel === name ? (
                                  <div className="flex items-center gap-1.5 animate-fade-in select-none">
                                    <button
                                      onClick={() => {
                                        handleDeleteTrigger(name);
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
                                  <button
                                    onClick={() => setDeletingModel(name)}
                                    className="btn btn-xs btn-ghost text-error hover:bg-error/15 hover:text-error rounded-full p-1 h-6 w-6 min-h-0 shrink-0"
                                    title="Delete model"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <button
                                onClick={() => handlePullTrigger(name)}
                                className="btn btn-xs border-user-accent/40 text-user-accent hover:bg-user-accent/15 hover:border-user-accent bg-transparent rounded-full px-3 text-[10px] font-bold uppercase h-6 min-h-0 shrink-0"
                              >
                                Pull
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Collapsible Details Pane */}
                        {expandedModel === name && (
                          <div className="mt-1.5 p-3 bg-base-content/5 backdrop-blur-sm rounded-xl border border-base-content/5 text-left text-xs font-sans text-base-content/85 flex flex-col gap-1.5 select-text animate-fade-in mx-1">
                            {loadingDetails[name] ? (
                              <div className="flex items-center gap-2 text-base-content/50 select-none py-1.5">
                                <span className="loading loading-spinner loading-xs text-user-accent"></span>
                                <span>Loading model metadata...</span>
                              </div>
                            ) : loadedDetails[name] ? (
                              <>
                                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 font-mono text-[10.5px]">
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
            <div className="flex flex-col gap-2 py-3 border-t border-base-content/5 mt-1 select-none text-left">
              <span className="text-base font-bold uppercase tracking-wider text-base-content">
                Pull Custom Model:
              </span>
              <span className="text-xs text-base-content/80 leading-relaxed font-sans select-none mb-1">
                Pull any model directly from the Ollama library. Make sure to specify the tag (e.g. qwen2.5:3b).
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter model name (e.g. qwen2.5:3b)"
                  value={customModelName}
                  onChange={(e) => setCustomModelName(e.target.value)}
                  className="input input-bordered input-sm flex-1 bg-base-content/5 backdrop-blur-sm border-base-content/15 font-sans focus:outline-hidden text-base h-8 px-2.5 rounded-lg"
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
        ) : (
          renderRemoteProvider(activeSubTab)
        )}
      </div>

      {/* Internal Model Toast alert */}
      {modelToast && (
        <div className="toast toast-bottom toast-center z-50 absolute pointer-events-none pb-4 animate-fade-in">
          <div className="alert alert-success shadow-lg text-xs rounded-xl py-2.5 px-5 text-success-content font-sans border-none select-text">
            <span>{modelToast}</span>
          </div>
        </div>
      )}
    </div>
  );
}
