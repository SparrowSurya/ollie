export type MessageRole = "user" | "assistant";

export interface ChatUiMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
}
