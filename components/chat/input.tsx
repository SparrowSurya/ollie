"use client";

import React, { useState, useRef, useEffect } from "react";
import { SendHorizonal } from "lucide-react";

export interface ChatInputProps {
  placeholder?: string;
  onSend?: (text: string) => void;
  disabled?: boolean;
  activeModel?: string;
  runnableModels?: string[];
  onModelChange?: (model: string) => void;
}

export default function ChatInput({
  placeholder,
  onSend,
  disabled = false,
  activeModel = "",
  runnableModels = [],
  onModelChange,
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
      className="flex flex-col glass-card rounded-2xl md:rounded-3xl p-3 px-4 transition-all shadow-lg focus-within:border-user-accent focus-within:ring-1 focus-within:ring-user-accent/30 gap-1.5"
    >
      <textarea
        ref={textareaRef}
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? "Ask Olly..."}
        className="w-full bg-transparent border-none text-base text-base-content leading-relaxed font-sans placeholder-base-content/30 resize-none max-h-40 py-1 focus:outline-hidden focus:ring-0 focus:ring-offset-0 min-h-6 max-w-full"
      ></textarea>

      {/* Bottom Actions Toolbar */}
      <div className="flex items-center justify-between border-t border-base-content/5 pt-2 mt-0.5 select-none">
        {/* Left: Model Selector Pill */}
        <div className="flex items-center">
          {runnableModels.length > 0 && activeModel ? (
            <div className="dropdown dropdown-top select-none">
              <div
                tabIndex={0}
                role="button"
                className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-base-content/60 bg-base-content/5 hover:bg-base-content/10 h-6 px-2.5 rounded-full cursor-pointer focus:outline-hidden"
              >
                <span>{activeModel}</span>
                <span className="text-[8px] opacity-65">▼</span>
              </div>
              <ul
                tabIndex={0}
                className="dropdown-content menu p-1.5 shadow-xl glass-card rounded-xl w-48 text-[11px] font-mono font-bold text-base-content/85 z-50 mb-1.5"
              >
                {runnableModels.map((m) => (
                  <li key={m}>
                    <button
                      type="button"
                      onClick={() => {
                        onModelChange?.(m);
                        if (document.activeElement instanceof HTMLElement) {
                          document.activeElement.blur();
                        }
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-left w-full hover:bg-base-content/10 hover:text-base-content ${
                        m === activeModel ? "bg-user-accent/10 text-user-accent" : ""
                      }`}
                    >
                      {m}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <span className="text-[11px] font-mono font-semibold text-base-content/30 bg-base-content/5 px-2 py-0.5 rounded-full select-none">
              No active model
            </span>
          )}
        </div>

        {/* Right: Send Button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || text.trim() === ""}
          className={`btn btn-circle btn-xs md:btn-sm shrink-0 shadow-xs border bg-transparent hover:bg-user-accent/10 transition-all ${
            disabled || text.trim() === ""
              ? "opacity-30 cursor-not-allowed border-base-content/10 text-base-content/30"
              : "hover:scale-105 active:scale-95 border-user-accent text-user-accent"
          }`}
        >
          <SendHorizonal size={14} className="text-inherit animate-none" />
        </button>
      </div>
    </div>
  );
}
