"use client";

import React, { useRef, useEffect } from "react";
import ChatInput from "./input";
import MessageView from "./message-view";
import ChatEmpty from "./empty";
import { ChatUiMessage } from "./types";

export interface ChatViewProps {
  messages: ChatUiMessage[];
  onSend: (text: string) => void;
  isGenerating?: boolean;
  isBootstrapping?: boolean;
}

export default function ChatView({
  messages,
  onSend,
  isGenerating = false,
  isBootstrapping = false,
}: Readonly<ChatViewProps>) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom of the message container when new messages arrive
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  // If bootstrapping is active, we don't show the welcome empty state greeting
  const isEmpty = messages.length === 0 && !isBootstrapping;

  return (
    <div className="flex flex-col h-full w-full max-w-3xl mx-auto px-4 justify-between bg-transparent">
      {isEmpty ? (
        // Empty State: Greeting centered in viewport with input below it
        <div className="flex-1 flex flex-col justify-center items-stretch w-full max-w-xl mx-auto px-2 select-none">
          <ChatEmpty />
          <div className="w-full">
            <ChatInput onSend={onSend} disabled={isGenerating} />
          </div>
        </div>
      ) : (
        // Active Chat: Scrollable messages and sticky bottom input
        <div className="flex-1 flex flex-col h-full min-h-0 justify-between">
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto min-h-0 no-scrollbar pr-1"
          >
            <MessageView
              messages={messages}
              isGenerating={isGenerating}
              isBootstrapping={isBootstrapping}
            />
          </div>
          <div className="py-4 bg-transparent shrink-0">
            <ChatInput
              onSend={onSend}
              disabled={isGenerating || isBootstrapping}
            />
          </div>
        </div>
      )}
    </div>
  );
}