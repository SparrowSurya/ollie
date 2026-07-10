export type MessageRole = "user" | "assistant";

export interface ChatUiMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  modelName?: string;
  images?: string[];
  generatedImages?: string[];
  parentMessageId?: string;
}

