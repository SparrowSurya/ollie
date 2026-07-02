"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";

export interface ChatInputProps {
  placeholder?: string;
  onSend?: (text: string) => void;
  disabled?: boolean;
}

export default function ChatInput({
  placeholder,
  onSend,
  disabled = false,
}: Readonly<ChatInputProps>) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [text, setText] = useState<string>("");

  // Auto-resize textarea as content changes
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const scrollHeight = textarea.scrollHeight;
    textarea.style.height = `${Math.min(scrollHeight, 160)}px`;
  }, [text]);

  const handleSubmit = () => {
    if (disabled) return;
    const message = text.trim();
    if (message === "") return;

    onSend?.(message);
    setText("");

    // Refocus the textarea after sending
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled) {
        handleSubmit();
      }
    }
  };

  return (
    <div
      className="flex items-end gap-2 bg-base-300 border border-base-content/20 rounded-2xl md:rounded-3xl px-4 py-2.5 transition-all shadow-xs focus-within:border-base-content/40"
    >
      <textarea
        ref={textareaRef}
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? "Ask Olly..."}
        className="flex-1 bg-transparent border-none text-base text-base-content leading-relaxed font-sans placeholder-base-content/30 resize-none max-h-40 py-1.5 focus:outline-none focus:ring-0 focus:ring-offset-0 min-h-6 max-w-full"
      ></textarea>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled || text.trim() === ""}
        className={`btn btn-circle btn-primary btn-xs md:btn-sm shrink-0 shadow-xs transition-opacity ${
          disabled || text.trim() === ""
            ? "opacity-40 cursor-not-allowed"
            : "hover:scale-105 active:scale-95"
        }`}
      >
        <Send size={14} className="text-primary-content" />
      </button>
    </div>
  );
}
