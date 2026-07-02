"use client";

import React, { useState } from "react";
import ChatView from "@/components/chat/view";
import { ChatUiMessage } from "@/components/chat";

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatUiMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const handleSend = async (text: string) => {
    if (isGenerating) return;

    setIsGenerating(true);

    const userMessage: ChatUiMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    const assistantMessageId = crypto.randomUUID();
    const assistantMessagePlaceholder: ChatUiMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage, assistantMessagePlaceholder]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: text }),
      });

      if (!response.ok) {
        throw new Error("Failed to connect to chat API");
      }

      if (!response.body) {
        throw new Error("Response body is unreadable");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === assistantMessageId) {
              return {
                ...msg,
                content: msg.content + chunk,
              };
            }
            return msg;
          })
        );
      }
    } catch (error) {
      console.error("Streaming error:", error);
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === assistantMessageId) {
            return {
              ...msg,
              content: "Error: Failed to stream response from the server. Make sure the backend is running.",
            };
          }
          return msg;
        })
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col h-screen max-h-screen overflow-hidden bg-base-100 py-6">
      <div className="flex-1 min-h-0 w-full">
        <ChatView
          messages={messages}
          onSend={handleSend}
          isGenerating={isGenerating}
        />
      </div>
    </main>
  );
}