"use client";

import React, { useRef, useEffect, useState } from "react";
import ChatInput from "./input";
import MessageView from "./message-view";
import ChatEmpty from "./empty";
import { ChatUiMessage } from "./types";
import { useSettings } from "@/contexts/SettingsContext";

export interface ChatViewProps {
  messages: ChatUiMessage[];
  onSend: (text: string, imageFiles?: File[]) => void;
  isGenerating?: boolean;
  isBootstrapping?: boolean;
  isModelLoaded?: boolean;
  activeModel?: string;
  defaultModel?: string;
  runnableModels?: string[];
  bootstrapChat?: (model: string, useAsDefault: boolean) => Promise<void>;
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
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isLockedRef = useRef<boolean>(true);

  const { customInstructions, setCustomInstructions } = useSettings();

  const [selectedModel, setSelectedModel] = useState<string>("");
  const [useAsDefault, setUseAsDefault] = useState<boolean>(true);
  const [localInstructions, setLocalInstructions] = useState<string>("");
  const [toast, setToast] = useState<string | null>(null);

  // Sync selected model state when defaultModel, activeModel, or runnableModels load
  const activeSelected = activeModel || selectedModel || defaultModel || (runnableModels.length > 0 ? runnableModels[0] : "");

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

  // Track user's manual scroll actions to toggle the auto-scroll lock
  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Lock auto-scroll only if the user is within 30px of the absolute bottom
    const isAtBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 30;
    isLockedRef.current = isAtBottom;
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

    bootstrapChat?.(targetModel, useAsDefault);
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
              className="select select-bordered select-sm w-full bg-base-content/5 backdrop-blur-sm border-user-accent/30 focus:border-user-accent focus:ring-user-accent/30 focus:outline-hidden cursor-pointer text-base h-9 px-3"
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
              onSend={onSend}
              disabled={isGenerating}
              activeModel={activeSelected}
              runnableModels={runnableModels}
              onModelChange={handleModelChange}
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
            className="flex-1 overflow-y-auto min-h-0 no-scrollbar w-full"
          >
            {/* Inner column keeps message content centered and readable */}
            <div className="w-full max-w-3xl mx-auto px-4">
              <MessageView
                messages={messages}
                isGenerating={isGenerating}
                isBootstrapping={isBootstrapping}
              />
            </div>
          </div>
          {/* Bottom input section centered and aligned with message column */}
          <div className="py-4 bg-transparent shrink-0 w-full max-w-3xl mx-auto px-4">
            <ChatInput
              onSend={onSend}
              disabled={isGenerating || isBootstrapping}
              activeModel={activeSelected}
              runnableModels={runnableModels}
              onModelChange={handleModelChange}
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