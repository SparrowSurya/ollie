"use client";

import React from "react";
import ChatView from "@/components/chat/view";
import { useChatContext } from "@/contexts/ChatContext";

export default function ChatPage() {
  const {
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
  } = useChatContext();

  if (isInitializing) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full select-none animate-fade-in">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="loading loading-spinner loading-lg text-user-accent"></span>
          <div className="flex flex-col gap-1">
            <h3 className="font-mono font-bold text-sm tracking-wider uppercase text-base-content/80">
              Initializing Ollie
            </h3>
            <p className="text-xs text-base-content/40 italic font-sans">
              Loading preferences and local tag registries...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 w-full">
      <ChatView
        messages={messages}
        onSend={sendMessage}
        isGenerating={isGenerating}
        isBootstrapping={isBootstrapping}
        isModelLoaded={isModelLoaded}
        activeModel={activeModel}
        defaultModel={defaultModel}
        runnableModels={runnableModels}
        bootstrapChat={bootstrapChat}
        setActiveModel={setActiveModel}
        errorToast={errorToast}
        setErrorToast={setErrorToast}
      />
    </div>
  );
}