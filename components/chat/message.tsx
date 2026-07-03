import React from "react";
import { MessageRole } from "./types";
import { parseResponseParts } from "@/lib/markdown";

export interface ChatMessageProps {
  role: MessageRole;
  content: string;
  pendingStatus?: "loading" | "generating";
  modelName?: string;
}

export default function ChatMessage({
  role,
  content,
  pendingStatus,
  modelName,
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

  const { thinkingHtml, contentHtml, isStillThinking, hasThinking } = parseResponseParts(content);

  // Assistant response is raw text flowing top-down on the left, displaying optional thinking process
  return (
    <div className="flex flex-col justify-start w-full my-4 font-sans text-base leading-relaxed text-base-content max-w-full">
      {modelName && (
        <span className="text-xs font-mono font-bold tracking-wider text-base-content/50 mb-1.5 block select-none uppercase">
          {modelName}
        </span>
      )}
      {hasThinking && (
        <details
          open={isStillThinking}
          className="mb-4 group border-l-2 border-base-content/15 pl-4 select-none w-full"
        >
          <summary className="cursor-pointer text-xs font-medium tracking-wide uppercase text-base-content/50 hover:text-base-content flex items-center gap-2 list-none outline-hidden">
            {isStillThinking ? "Thinking Process..." : "Thought Process"}
            <span className="text-[10px] opacity-60 transition-transform group-open:rotate-90">
              ▶
            </span>
          </summary>
          <div
            className="markdown-content mt-2 text-sm italic text-base-content/70 select-text"
            dangerouslySetInnerHTML={{ __html: thinkingHtml || "<p>Analyzing...</p>" }}
          />
        </details>
      )}
      {contentHtml && (
        <div
          className="markdown-content w-full select-text"
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />
      )}
    </div>
  );
}
