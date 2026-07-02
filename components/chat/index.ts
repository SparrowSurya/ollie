import ChatInput, { ChatInputProps } from "./input";
import ChatMessage, { ChatMessageProps } from "./message";
import ChatView, { ChatViewProps } from "./view";
import { ChatUiMessage, MessageRole } from "./types";

export type { ChatUiMessage, MessageRole };
export default ChatView;

export {
  ChatInput,
  ChatMessage,
  type ChatInputProps,
  type ChatMessageProps,
  type ChatViewProps,
};