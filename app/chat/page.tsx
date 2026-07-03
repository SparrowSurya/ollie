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
    defaultModel,
    runnableModels,
    bootstrapChat,
    sendMessage,
  } = useChat();

  // Register the global clipboard copy handler on component mount
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

  return (
    <main className="flex-1 flex flex-col h-screen max-h-screen overflow-hidden bg-base-100 py-6">
      <div className="flex-1 min-h-0 w-full">
        <ChatView
          messages={messages}
          onSend={sendMessage}
          isGenerating={isGenerating}
          isBootstrapping={isBootstrapping}
          isModelLoaded={isModelLoaded}
          defaultModel={defaultModel}
          runnableModels={runnableModels}
          bootstrapChat={bootstrapChat}
        />
      </div>
    </main>
  );
}