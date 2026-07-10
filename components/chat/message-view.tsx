import React from "react";
import ChatMessage from "./message";
import { ChatUiMessage } from "./types";

export interface MessageViewProps {
  messages: ChatUiMessage[];
  isGenerating?: boolean;
  isBootstrapping?: boolean;
}

const MessageView = React.memo(function MessageView({
  messages,
  isGenerating = false,
  isBootstrapping = false,
}: Readonly<MessageViewProps>) {
  // If the model is currently bootstrapping/warming up, show the loading indicator
  if (isBootstrapping) {
    return (
      <div className="flex flex-col w-full gap-2 px-1 py-4">
        <ChatMessage
          role="assistant"
          content=""
          pendingStatus="loading"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full gap-2 px-1 py-4">
      {messages.map((msg, index) => {
        const isLast = index === messages.length - 1;

        // Show "generating" status only for the last message if it's assistant and currently empty
        const isGeneratingPlaceholder =
          isGenerating &&
          isLast &&
          msg.role === "assistant" &&
          msg.content === "";

        return (
          <ChatMessage
            key={`IDM-${msg.id}` || `IDX-${index}`}
            id={msg.id}
            role={msg.role}
            content={msg.content}
            pendingStatus={isGeneratingPlaceholder ? "generating" : undefined}
            modelName={msg.modelName}
            images={msg.images}
            generatedImages={msg.generatedImages}
            replyToText={msg.replyToText}
          />
        );
      })}
    </div>
  );
});

export default MessageView;