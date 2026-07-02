import React from "react";
import ChatMessage from "./message";
import { ChatUiMessage } from "./types";

export interface MessageViewProps {
  messages: ChatUiMessage[];
}

export default function MessageView({
  messages,
}: Readonly<MessageViewProps>) {
  return (
    <div className="flex flex-col w-full gap-2 px-1 py-4">
      {messages.map((msg, index) => (
        <ChatMessage
          key={index}
          role={msg.role}
          content={msg.content}
        />
      ))}
    </div>
  );
}