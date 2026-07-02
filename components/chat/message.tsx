import React from "react";
import { MessageRole } from "./types";

export interface ChatMessageProps {
  role: MessageRole;
  content: string;
}

export default function ChatMessage({
  role,
  content,
}: Readonly<ChatMessageProps>) {
  const isUser = role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end w-full my-2">
        <div className="bg-base-200 text-base-content max-w-[70%] px-4 py-3 rounded-2xl rounded-tr-xs shadow-xs text-base font-sans whitespace-pre-wrap">
          {content}
        </div>
      </div>
    );
  }

  // Assistant response is raw text flowing top-down on the left
  return (
    <div className="flex justify-start w-full my-4 font-sans text-base leading-relaxed text-base-content max-w-full">
      <div className="whitespace-pre-wrap w-full select-text">{content}</div>
    </div>
  );
}
