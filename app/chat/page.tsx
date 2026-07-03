"use client";

import React, { useEffect } from "react";
import ChatView from "@/components/chat/view";
import { useChat } from "@/hooks/useChat";

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
  } = useChat();

  // Register the global clipboard copy handler on component mount (MUST run before any conditional returns)
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).copyCode = (button: HTMLButtonElement) => {
      const wrapper = button.closest(".code-block-wrapper");
      const code = wrapper?.querySelector("code");

      if (code) {
        // Read text content and copy to user clipboard
        navigator.clipboard.writeText(code.innerText).then(() => {
          // Temporarily show success state referencing the static check SVG
          button.innerHTML = `<img src="/resources/svg/check-icon.svg" class="w-3.25 h-3.25 pointer-events-none" alt="Copied" />`;
          button.classList.add("text-success");
          button.setAttribute("title", "Copied!");

          setTimeout(() => {
            // Restore original copy button state referencing the static copy SVG asset
            button.innerHTML = `<img src="/resources/svg/copy-icon.svg" class="w-3.25 h-3.25 pointer-events-none" alt="Copy" />`;
            button.classList.remove("text-success");
            button.setAttribute("title", "Copy code");
          }, 2000);
        }).catch((err) => {
          console.error("Failed to copy text: ", err);
        });
      }
    };
  }, []);

  // Conditional rendering checks placed safely after all Hook declarations
  if (isInitializing) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-base-100 select-none animate-fade-in">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="loading loading-spinner loading-lg text-user-accent"></span>
          <div className="flex flex-col gap-1">
            <h3 className="font-mono font-bold text-sm tracking-wider uppercase text-base-content/80">
              Initializing Olly
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
    <main className="flex-1 flex flex-col h-screen max-h-screen overflow-hidden bg-base-100 py-6">
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
    </main>
  );
}