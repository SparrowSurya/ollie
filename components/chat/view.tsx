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
  const isLockedRef = useRef<boolean>(true);

  // Track user's manual scroll actions to toggle the auto-scroll lock
  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Lock auto-scroll only if the user is within 30px of the absolute bottom
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 30;
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

  // If bootstrapping is active, we don't show the welcome empty state greeting
  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full w-full justify-between bg-transparent">
      {isEmpty ? (
        // Empty State: Greeting centered in viewport with input below it
        <div className="flex-1 flex flex-col justify-center items-stretch w-full max-w-xl mx-auto px-6 select-none">
          <ChatEmpty />
          <div className="w-full">
            <ChatInput onSend={onSend} disabled={isGenerating} />
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
            />
          </div>
        </div>
      )}
    </div>
  );
}