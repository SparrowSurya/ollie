import React from "react";
import { MessageRole } from "./types";
import { parseMarkdown } from "@/lib/markdown";

export interface ChatMessageProps {
  role: MessageRole;
  content: string;
  pendingStatus?: "loading" | "generating";
}

export default function ChatMessage({
  role,
  content,
  pendingStatus,
}: Readonly<ChatMessageProps>) {
  const isUser = role === "user";

  if (pendingStatus === "loading") {
    return (
      <div className="flex justify-start w-full my-4 font-sans text-base-content/50 max-w-full items-center gap-2 select-none animate-pulse">
        <span className="loading loading-dots loading-sm text-user-accent"></span>
        <span className="text-sm font-light italic">Loading the model...</span>
      </div>
    );
  }

  if (pendingStatus === "generating") {
    return (
      <div className="flex justify-start w-full my-4 font-sans text-base-content/50 max-w-full items-center gap-2 select-none animate-pulse">
        <span className="loading loading-ring loading-sm text-user-accent"></span>
        <span className="text-sm font-light italic">Generating...</span>
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="flex justify-end w-full my-2">
        <div className="bg-base-200 text-base-content max-w-[70%] px-4 py-3 rounded-2xl rounded-tr-xs shadow-xs text-base font-sans whitespace-pre-wrap">
          {content}
        </div>
      </div>
    );
  }

  // Assistant response is raw text flowing top-down on the left, compiled to HTML
  return (
    <div className="flex justify-start w-full my-4 font-sans text-base leading-relaxed text-base-content max-w-full">
      <div 
        className="markdown-content w-full select-text"
        dangerouslySetInnerHTML={{ __html: parseMarkdown(content) }}
      />
    </div>
  );
}
