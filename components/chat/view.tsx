"use client";

import React, { useRef, useEffect, useState } from "react";
import ChatInput from "./input";
import MessageView from "./message-view";
import ChatEmpty from "./empty";
import { ChatUiMessage } from "./types";
import { useSettings } from "@/contexts/SettingsContext";
import { useOllama } from "@/contexts/OllamaContext";
import { useChatContext } from "@/contexts/ChatContext";
import { Plus, Pencil, Trash2, Quote } from "lucide-react";

export interface ChatViewProps {
  messages: ChatUiMessage[];
  onSend: (text: string, imageFiles?: File[], replyToText?: string) => void;
  isGenerating?: boolean;
  isBootstrapping?: boolean;
  isModelLoaded?: boolean;
  activeModel?: string;
  defaultModel?: string;
  runnableModels?: string[];
  bootstrapChat?: (
    model: string,
    useAsDefault: boolean,
    customInstructions?: string,
    mcpServers?: { name: string; url: string }[]
  ) => Promise<void>;
  setActiveModel?: (model: string) => void;
  errorToast?: string | null;
  setErrorToast?: (msg: string | null) => void;
}

export default function ChatView({
  messages,
  onSend,
  isGenerating = false,
  isBootstrapping = false,
  isModelLoaded = false,
  activeModel = "",
  defaultModel = "",
  runnableModels = [],
  bootstrapChat,
  setActiveModel,
  errorToast = null,
  setErrorToast,
}: Readonly<ChatViewProps>) {
  const { hasMore, isLoadingMore, loadOlderMessages } = useChatContext();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isLockedRef = useRef<boolean>(true);

  const [showReplyButton, setShowReplyButton] = useState(false);
  const [replyButtonPos, setReplyButtonPos] = useState({ top: 0, left: 0 });
  const [selectedText, setSelectedText] = useState("");
  const [activeReplyText, setActiveReplyText] = useState<string | null>(null);

  const { customInstructions, setCustomInstructions } = useSettings();
  const { imageModels } = useOllama();

  const [selectedModel, setSelectedModel] = useState<string>("");
  const [useAsDefault, setUseAsDefault] = useState<boolean>(true);
  const [localInstructions, setLocalInstructions] = useState<string>("");
  const [setupMcpServers, setSetupMcpServers] = useState<{ id: string; name: string; url: string }[]>([]);
  const [isAddingMcp, setIsAddingMcp] = useState(false);
  const [newMcpName, setNewMcpName] = useState("");
  const [newMcpUrl, setNewMcpUrl] = useState("");
  const [editingServerId, setEditingServerId] = useState<string | null>(null);
  const [editMcpName, setEditMcpName] = useState("");
  const [editMcpUrl, setEditMcpUrl] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const handleAddMcp = () => {
    const name = newMcpName.trim();
    const url = newMcpUrl.trim();
    if (!name || !url) return;
    setSetupMcpServers((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name, url }
    ]);
    setNewMcpName("");
    setNewMcpUrl("");
    setIsAddingMcp(false);
  };

  const handleDeleteMcp = (id: string) => {
    setSetupMcpServers((prev) => prev.filter((s) => s.id !== id));
  };

  const startEditing = (srv: { id: string; name: string; url: string }) => {
    setEditingServerId(srv.id);
    setEditMcpName(srv.name);
    setEditMcpUrl(srv.url);
  };

  const handleSaveEdit = () => {
    const name = editMcpName.trim();
    const url = editMcpUrl.trim();
    if (!name || !url || !editingServerId) return;
    setSetupMcpServers((prev) =>
      prev.map((s) => (s.id === editingServerId ? { ...s, name, url } : s))
    );
    setEditingServerId(null);
  };

  // Sync selected model state when defaultModel, activeModel, or runnableModels load
  const activeSelected = activeModel || selectedModel || defaultModel || (runnableModels.length > 0 ? runnableModels[0] : "");

  const isImageSelected = imageModels.includes(activeSelected);

  // Sync instructions local state from context on mount/update
  useEffect(() => {
    const syncInstructions = async () => {
      setLocalInstructions(customInstructions);
    };
    syncInstructions();
  }, [customInstructions]);

  const handleModelChange = (modelName: string) => {
    setSelectedModel(modelName);
    setActiveModel?.(modelName);
  };

  // Auto-dismiss the visual error toasts after a brief period
  useEffect(() => {
    if (errorToast) {
      const timer = setTimeout(() => {
        setErrorToast?.(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [errorToast, setErrorToast]);

  // Handle text selection for reply feature
  useEffect(() => {
    const handleSelectionEnd = () => {
      // Small delay to ensure browser Selection APIs are updated
      setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
          setShowReplyButton(false);
          return;
        }

        const text = selection.toString().trim();
        if (!text) {
          setShowReplyButton(false);
          return;
        }

        const anchorNode = selection.anchorNode;
        const focusNode = selection.focusNode;
        if (!anchorNode || !focusNode) return;

        const anchorEl = anchorNode instanceof Element ? anchorNode : anchorNode.parentElement;
        const focusEl = focusNode instanceof Element ? focusNode : focusNode.parentElement;

        if (!anchorEl || !focusEl) return;

        // Check if selection is within a details block (thinking process)
        if (anchorEl.closest("details") || focusEl.closest("details")) {
          setShowReplyButton(false);
          return;
        }

        const anchorEligible = anchorEl.closest('[data-reply-eligible="true"]');
        const focusEligible = focusEl.closest('[data-reply-eligible="true"]');

        if (!anchorEligible || !focusEligible || anchorEligible !== focusEligible) {
          setShowReplyButton(false);
          return;
        }

        try {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          const container = scrollContainerRef.current;
          if (container) {
            const containerRect = container.getBoundingClientRect();
            setReplyButtonPos({
              top: rect.top - containerRect.top + container.scrollTop - 8,
              left: rect.left - containerRect.left + container.scrollLeft + rect.width / 2,
            });
            setSelectedText(text);
            setShowReplyButton(true);
          }
        } catch (e) {
          console.error("Error setting reply button position:", e);
        }
      }, 10);
    };

    const handleSelectionStart = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.closest(".reply-selection-btn")) {
        return;
      }
      setShowReplyButton(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        window.getSelection()?.removeAllRanges();
        setShowReplyButton(false);
      }
    };

    document.addEventListener("mouseup", handleSelectionEnd);
    document.addEventListener("keyup", handleSelectionEnd);
    document.addEventListener("mousedown", handleSelectionStart);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mouseup", handleSelectionEnd);
      document.removeEventListener("keyup", handleSelectionEnd);
      document.removeEventListener("mousedown", handleSelectionStart);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleReply = () => {
    if (selectedText) {
      setActiveReplyText(selectedText);
      window.getSelection()?.removeAllRanges();
      setShowReplyButton(false);
    }
  };

  const handleSendWithReply = (text: string, imageFiles?: File[], replyTo?: string) => {
    onSend(text, imageFiles, replyTo);
    setActiveReplyText(null);
  };

  // Track user's manual scroll actions to toggle the auto-scroll lock and trigger pagination
  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Lock auto-scroll only if the user is within 30px of the absolute bottom
    const isAtBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 30;
    isLockedRef.current = isAtBottom;

    // Trigger pagination when scrolling to top (within 50px of top)
    if (container.scrollTop < 50 && hasMore && !isLoadingMore) {
      const beforeHeight = container.scrollHeight;
      loadOlderMessages().then(() => {
        setTimeout(() => {
          if (scrollContainerRef.current) {
            const currentContainer = scrollContainerRef.current;
            currentContainer.scrollTop = currentContainer.scrollHeight - beforeHeight;
          }
        }, 0);
      });
    }
  };

  // Auto-scroll to bottom of the message container when new messages arrive
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const lastMessage = messages[messages.length - 1];
    const isUserMsg = lastMessage?.role === "user";

    // Unconditionally scroll to bottom on new user prompt
    // For assistant stream chunks, only scroll if we are locked to the bottom
    if (isUserMsg || isLockedRef.current) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  const handleLoadModel = () => {
    if (runnableModels.length === 0) {
      showToast("No models installed. Please pull a model in Settings.");
      return;
    }
    const targetModel = activeSelected;
    if (!targetModel) return;

    // Update settings context dynamically first before warming up model
    setCustomInstructions(localInstructions);

    const mcpServersPayload = setupMcpServers.map((s) => ({
      name: s.name,
      url: s.url,
    }));

    bootstrapChat?.(targetModel, useAsDefault, localInstructions, mcpServersPayload);
  };

  // Centered Loader screen during pre-warming / bootstrapping
  if (isBootstrapping) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center w-full h-full select-none">
        <span className="loading loading-dots loading-md text-user-accent mb-2"></span>
        <span className="text-sm font-light italic text-base-content/60">
          Loading the model...
        </span>
      </div>
    );
  }

  // Centered Selector Form for landing / fresh chat page (when model is not loaded yet)
  if (!isModelLoaded) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center w-full h-full max-w-md mx-auto px-6 select-none animate-fade-in relative">
        <div className="glass-card border border-base-content/10 rounded-2xl shadow-xl p-6 w-full flex flex-col gap-4 text-center">
          <h3 className="text-lg font-bold uppercase tracking-wider text-base-content">
            Setup Session
          </h3>
          <p className="text-sm text-base-content/80 leading-relaxed">
            Select an installed local model and configure custom instructions to start.
          </p>

          {/* Model Selection Dropdown */}
          <div className="flex flex-col text-left gap-1.5 mt-2">
            <span className="text-xs font-bold uppercase tracking-wide text-base-content/60">
              Choose Model:
            </span>
            <select
              value={activeSelected}
              onChange={(e) => handleModelChange(e.target.value)}
              disabled={runnableModels.length === 0}
              className="select select-bordered select-sm w-full bg-base-200 border-user-accent/30 focus:border-user-accent focus:ring-user-accent/30 focus:outline-hidden cursor-pointer text-base h-9 px-3"
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

          {/* Custom Instructions Textarea */}
          <div className="flex flex-col text-left gap-1.5 mt-1">
            <span className="text-xs font-bold uppercase tracking-wide text-base-content/60">
              Custom Instructions:
            </span>
            <textarea
              value={localInstructions}
              onChange={(e) => setLocalInstructions(e.target.value)}
              placeholder="Enter instructions to guide the model's behavior..."
              className="textarea textarea-bordered w-full bg-base-content/5 backdrop-blur-sm border-user-accent/30 focus:border-user-accent focus:ring-user-accent/30 focus:outline-hidden text-sm h-20 px-3 py-2 resize-none leading-relaxed font-sans"
            />
          </div>

          {/* MCP Servers Section */}
          {!isImageSelected && (
            <div className="flex flex-col text-left gap-1.5 mt-1 border border-base-content/10 p-3 rounded-xl bg-base-content/5">
              <div className="flex items-center justify-between select-none">
                <span className="text-xs font-bold uppercase tracking-wide text-base-content/65">
                  MCP Servers
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddingMcp((prev) => !prev)}
                  className="btn btn-xs btn-ghost btn-circle text-user-accent hover:bg-user-accent/15 cursor-pointer"
                  title="Add MCP Server"
                >
                  <Plus size={14} />
                </button>
              </div>

              {/* Adding MCP server form inline */}
              {isAddingMcp && (
                <div className="flex flex-col gap-2 p-2 border border-user-accent/20 rounded-lg bg-base-100/50 mt-1 animate-fade-in">
                  <input
                    type="text"
                    value={newMcpName}
                    onChange={(e) => setNewMcpName(e.target.value)}
                    placeholder="Server Name (e.g. Memory Server)"
                    className="input input-bordered input-xs bg-base-200 w-full text-xs font-sans rounded-md px-2 h-7"
                  />
                  <input
                    type="url"
                    value={newMcpUrl}
                    onChange={(e) => setNewMcpUrl(e.target.value)}
                    placeholder="SSE Endpoint URL (e.g. http://.../sse)"
                    className="input input-bordered input-xs bg-base-200 w-full text-xs font-sans rounded-md px-2 h-7"
                  />
                  <div className="flex justify-end gap-1.5 mt-1 select-none">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingMcp(false);
                        setNewMcpName("");
                        setNewMcpUrl("");
                      }}
                      className="btn btn-xs btn-ghost text-base-content/60 px-2 text-[10px] uppercase font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddMcp}
                      disabled={!newMcpName.trim() || !newMcpUrl.trim()}
                      className="btn btn-xs bg-user-accent hover:bg-user-accent/85 border-none text-base-100 px-2.5 text-[10px] uppercase font-bold"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              {/* Servers List with Edit / Delete */}
              <div className="max-h-36 overflow-y-auto pr-1 flex flex-col gap-1.5 mt-1">
                {setupMcpServers.length === 0 ? (
                  !isAddingMcp && (
                    <span className="text-xs text-base-content/40 italic select-none py-1 block">
                      no mcp servers added
                    </span>
                  )
                ) : (
                  setupMcpServers.map((srv) => {
                    const isEditing = editingServerId === srv.id;
                    return (
                      <div key={srv.id} className="flex flex-col gap-1.5 p-1 px-2 hover:bg-base-content/5 rounded-lg border border-transparent hover:border-base-content/5 transition-all">
                        {!isEditing ? (
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-xs text-base-content/50 select-none">•</span>
                              <span className="text-xs font-bold text-base-content truncate font-sans" title={srv.url}>
                                {srv.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 select-none">
                              <button
                                type="button"
                                onClick={() => startEditing(srv)}
                                className="btn btn-xs btn-ghost btn-circle text-base-content/60 hover:text-user-accent hover:bg-user-accent/10"
                                title="Edit Server"
                              >
                                <Pencil size={11} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteMcp(srv.id)}
                                className="btn btn-xs btn-ghost btn-circle text-base-content/60 hover:text-error hover:bg-error/10"
                                title="Delete Server"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2 p-1.5 border border-user-accent/20 bg-base-100/50 rounded-lg animate-fade-in">
                            <input
                              type="text"
                              value={editMcpName}
                              onChange={(e) => setEditMcpName(e.target.value)}
                              placeholder="Edit name..."
                              className="input input-bordered input-xs bg-base-200 w-full text-xs font-sans rounded-md px-2 h-7"
                            />
                            <input
                              type="url"
                              value={editMcpUrl}
                              onChange={(e) => setEditMcpUrl(e.target.value)}
                              placeholder="Edit URL..."
                              className="input input-bordered input-xs bg-base-200 w-full text-xs font-sans rounded-md px-2 h-7"
                            />
                            <div className="flex justify-end gap-1.5 mt-1 select-none">
                              <button
                                type="button"
                                onClick={() => setEditingServerId(null)}
                                className="btn btn-xs btn-ghost text-base-content/60 px-2 text-[10px] uppercase font-bold"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={handleSaveEdit}
                                disabled={!editMcpName.trim() || !editMcpUrl.trim()}
                                className="btn btn-xs bg-user-accent hover:bg-user-accent/85 border-none text-base-100 px-2.5 text-[10px] uppercase font-bold"
                              >
                                Done
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Set as Default Checkbox */}
          {runnableModels.length > 0 && (
            <label className="flex items-center gap-2 cursor-pointer mt-1 text-xs font-medium text-base-content select-none">
              <input
                type="checkbox"
                checked={useAsDefault}
                onChange={(e) => setUseAsDefault(e.target.checked)}
                className="checkbox checkbox-sm checkbox-theme-adaptive border-user-accent checked:bg-user-accent checked:border-user-accent focus:ring-1 focus:ring-user-accent/30 focus:outline-hidden"
              />
              <span>Set as default model</span>
            </label>
          )}

          {/* Action Button */}
          <button
            onClick={handleLoadModel}
            disabled={runnableModels.length === 0}
            className="btn btn-sm shrink-0 border-user-accent bg-user-accent hover:bg-user-accent/85 hover:border-user-accent/85 text-base-100 uppercase tracking-wider font-bold mt-2 cursor-pointer text-base"
          >
            Start Chat
          </button>

          {runnableModels.length === 0 && (
            <p className="text-sm text-warning/80 leading-relaxed border border-warning/10 bg-warning/5 p-3 rounded-lg mt-1 select-text">
              Please click the settings icon in the top-right corner to pull a model first.
            </p>
          )}
        </div>

        {/* Floating Warning Toast Overlay */}
        {(toast || errorToast) && (
          <div className="toast toast-bottom toast-center z-50">
            <div className="alert alert-warning border border-user-accent/30 shadow-lg text-xs rounded-xl py-2 px-4 select-text">
              <span>{toast || errorToast}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full w-full justify-between bg-transparent relative">
      {isEmpty ? (
        // Empty State: Greeting centered in viewport with input below it
        <div className="flex-1 flex flex-col justify-center items-stretch w-full max-w-xl mx-auto px-6 select-none">
          <ChatEmpty />
          <div className="w-full">
            <ChatInput
              onSend={handleSendWithReply}
              disabled={isBootstrapping}
              activeModel={activeSelected}
              runnableModels={runnableModels}
              onModelChange={handleModelChange}
              replyToText={activeReplyText}
              onClearReply={() => setActiveReplyText(null)}
            />
          </div>
        </div>
      ) : (
        // Active Chat: Scrollable messages and sticky bottom input
        <div className="flex-1 flex flex-col h-full min-h-0 justify-between w-full">
          {/* Scrollable area spans full screen width to capture scroll events everywhere */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto min-h-0 no-scrollbar w-full relative"
          >
            {/* Inner column keeps message content centered and readable */}
            <div className="w-full max-w-3xl mx-auto px-4">
              {hasMore && (
                <div className="flex justify-center items-center py-4 text-user-accent">
                  {isLoadingMore ? (
                    <span className="loading loading-spinner loading-sm"></span>
                  ) : (
                    <span className="text-xs text-base-content/40 italic">Scroll up to load older messages</span>
                  )}
                </div>
              )}
              <MessageView
                messages={messages}
                isGenerating={isGenerating}
                isBootstrapping={isBootstrapping}
              />
            </div>

            {showReplyButton && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleReply();
                }}
                className="reply-selection-btn absolute z-50 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg shadow-xl bg-base-100/90 text-base-content border border-base-content/15 backdrop-blur-md hover:bg-user-accent hover:text-white hover:border-user-accent transition-all duration-200 cursor-pointer animate-fade-in -translate-x-1/2 -translate-y-full"
                style={{
                  top: `${replyButtonPos.top}px`,
                  left: `${replyButtonPos.left}px`,
                }}
              >
                <Quote className="w-3.5 h-3.5" />
                <span>Reply</span>
              </button>
            )}
          </div>
          {/* Bottom input section centered and aligned with message column */}
          <div className="py-4 bg-transparent shrink-0 w-full max-w-3xl mx-auto px-4">
            <ChatInput
              onSend={handleSendWithReply}
              disabled={isBootstrapping}
              activeModel={activeSelected}
              runnableModels={runnableModels}
              onModelChange={handleModelChange}
              replyToText={activeReplyText}
              onClearReply={() => setActiveReplyText(null)}
            />
          </div>
        </div>
      )}

      {/* Floating API Warning Toast Notification Overlay */}
      {errorToast && (
        <div className="toast toast-bottom toast-center z-50">
          <div className="alert alert-warning border border-user-accent/30 shadow-lg text-xs rounded-xl py-2 px-4 select-text font-sans">
            <span>{errorToast}</span>
          </div>
        </div>
      )}
    </div>
  );
}