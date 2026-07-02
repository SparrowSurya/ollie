"use client";

import React from "react";
import ChatView from "@/components/chat/view";
import { useChat } from "@/hooks/useChat";

export default function ChatPage() {
  const { messages, isGenerating, isBootstrapping, sendMessage } = useChat();

  return (
    <main className="flex-1 flex flex-col h-screen max-h-screen overflow-hidden bg-base-100 py-6">
      <div className="flex-1 min-h-0 w-full">
        <ChatView
          messages={messages}
          onSend={sendMessage}
          isGenerating={isGenerating}
          isBootstrapping={isBootstrapping}
        />
      </div>
    </main>
  );
}