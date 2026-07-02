"use client";

import React, { useState } from "react";
import ChatView from "@/components/chat/view";
import { ChatUiMessage } from "@/components/chat";

// Mock sentences to generate realistic streaming responses
const mockSentences = [
  "Ollama is a lightweight, extensible framework for building and running large language models on your local machine.",
  "It allows developers to download, run, and customize open-source models like Gemma, Llama, and Mistral with a simple set of commands.",
  "In the next step of this project, we will establish a Next.js API route that connects this frontend application directly to your local Ollama server.",
  "This will enable real-time streaming responses from your locally running models, utilizing Server-Sent Events for a smooth user experience.",
  "The UI is designed to support dynamic theme switching using the Catppuccin color scheme, including Latte, Frappe, Macchiato, and Mocha flavors.",
  "Once the database integration is complete, all chat histories, settings, and sessions will be persisted locally, allowing you to resume chats anytime.",
  "Next.js App Router provides efficient server rendering, while Tailwind CSS v4 and daisyUI v5 ensure a highly polished, responsive interface."
];

// Helper to generate a mock stream of words
const generateMockStream = (
  onWord: (word: string) => void,
  onComplete: () => void
) => {
  const allWords = mockSentences.join(" ").split(/\s+/);
  const wordCount = Math.floor(Math.random() * 21) + 40;
  const startIndex = Math.floor(Math.random() * Math.max(1, allWords.length - wordCount));
  const selectedWords = allWords.slice(startIndex, startIndex + wordCount);

  let currentIndex = 0;
  const intervalId = setInterval(() => {
    if (currentIndex < selectedWords.length) {
      onWord(selectedWords[currentIndex]);
      currentIndex++;
    } else {
      clearInterval(intervalId);
      onComplete();
    }
  }, 45);
};

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatUiMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const handleSend = (text: string) => {
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

    generateMockStream(
      (word) => {
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === assistantMessageId) {
              return {
                ...msg,
                content: msg.content ? `${msg.content} ${word}` : word,
              };
            }
            return msg;
          })
        );
      },
      () => {
        setIsGenerating(false);
      }
    );
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