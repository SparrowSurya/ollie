"use client";

import React, { useState, useRef, useEffect } from "react";
import { SendHorizonal, Plus, X, Square, Wrench } from "lucide-react";
import { useChatContext } from "@/contexts/ChatContext";
import { useOllama } from "@/contexts/OllamaContext";

export interface ChatInputProps {
  placeholder?: string;
  onSend?: (text: string, imageFiles?: File[], replyToText?: string) => void;
  disabled?: boolean;
  activeModel?: string;
  runnableModels?: string[];
  onModelChange?: (model: string) => void;
  replyToText?: string | null;
  onClearReply?: () => void;
}

export default function ChatInput({
  placeholder,
  onSend,
  disabled = false,
  activeModel = "",
  runnableModels = [],
  onModelChange,
  replyToText,
  onClearReply,
}: Readonly<ChatInputProps>) {
  interface ImageAttachment {
    file: File;
    previewUrl: string;
  }

  const MAX_IMAGE_COUNT = Number(process.env.NEXT_PUBLIC_MAX_IMAGE_COUNT || 5);
  const MAX_IMAGE_SIZE_MB = Number(process.env.NEXT_PUBLIC_MAX_IMAGE_SIZE_MB || 5);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [text, setText] = useState<string>("");
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);

  const { imageModels, disabledModels } = useOllama();
  const {
    activeModelSupportsVision,
    isGenerating,
    stopGeneration,
    availableTools,
    activeTools,
    toggleTool,
    activeSessionId,
    messages,
  } = useChatContext();

  // Automatically focus input on starting a new chat
  useEffect(() => {
    if (messages.length === 0) {
      textareaRef.current?.focus();
    }
  }, [activeSessionId, messages.length]);

  // Banner state is managed in parent ChatView

  const [mcpCount, setMcpCount] = useState<number>(0);

  useEffect(() => {
    const fetchCount = async () => {
      if (!activeSessionId) {
        setMcpCount(0);
        return;
      }
      try {
        const res = await fetch(`/api/sessions/mcp?sessionId=${encodeURIComponent(activeSessionId)}`);
        if (res.ok) {
          const data = await res.json();
          setMcpCount(data.servers?.length || 0);
        }
      } catch (e) {
        console.error("Error fetching MCP count in ChatInput:", e);
      }
    };
    fetchCount();
  }, [activeSessionId]);

  const isImageModel = imageModels.includes(activeModel);
  const defaultPlaceholder = isImageModel
    ? "Describe the image you want to generate..."
    : "Ask Ollie...";

  const attachmentsRef = useRef<ImageAttachment[]>([]);
  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  // Clean up Object URLs on unmount
  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((a) => URL.revokeObjectURL(a.previewUrl));
    };
  }, []);

  // Auto-resize textarea as content changes
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const scrollHeight = textarea.scrollHeight;
    textarea.style.height = `${Math.min(scrollHeight, 160)}px`;
  }, [text]);

  // Focus textarea when replying to text
  useEffect(() => {
    textareaRef.current?.focus();
  }, [replyToText]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);

    if (attachments.length + files.length > MAX_IMAGE_COUNT) {
      setFileError(`Cannot upload more than ${MAX_IMAGE_COUNT} images at once.`);
      setTimeout(() => setFileError(null), 4000);
      return;
    }

    const validAttachments: ImageAttachment[] = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        setFileError(`File "${file.name}" is not an image.`);
        setTimeout(() => setFileError(null), 4000);
        continue;
      }
      if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
        setFileError(`File "${file.name}" exceeds the ${MAX_IMAGE_SIZE_MB}MB size limit.`);
        setTimeout(() => setFileError(null), 4000);
        continue;
      }
      validAttachments.push({
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }

    if (validAttachments.length > 0) {
      setAttachments((prev) => [...prev, ...validAttachments]);
    }
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    setAttachments((prev) => {
      const target = prev[index];
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = () => {
    if (disabled) return;
    const message = text.trim();
    if (message === "" && attachments.length === 0) return;

    const filesToSend = attachments.map((a) => a.file);
    onSend?.(message, filesToSend, replyToText || undefined);

    // Revoke all preview URLs
    attachments.forEach((a) => URL.revokeObjectURL(a.previewUrl));

    setText("");
    setAttachments([]);

    // Refocus the textarea after sending
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && !isGenerating) {
        handleSubmit();
      }
    }
  };

  return (
    <div
      className="flex flex-col glass-card rounded-2xl md:rounded-3xl p-3 px-4 transition-all shadow-lg focus-within:border-user-accent focus-within:ring-1 focus-within:ring-user-accent/30 gap-1.5"
    >
      {/* Quoted Reply Banner */}
      {replyToText && (
        <div className="flex items-start justify-between bg-base-content/5 border-l-2 border-user-accent p-2 rounded-r-lg text-xs mb-2">
          <div className="flex-1 text-base-content/75 line-clamp-3 whitespace-pre-wrap select-none font-sans italic pr-2 animate-fade-in">
            {replyToText}
          </div>
          <button
            type="button"
            onClick={onClearReply}
            className="btn btn-ghost btn-circle btn-xs text-base-content/50 hover:text-base-content"
          >
            <X size={12} />
          </button>
        </div>
      )}
      {/* File attachment previews */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2.5 mb-2 select-none">
          {attachments.map((a, index) => (
            <div
              key={a.previewUrl}
              className="relative w-14 h-14 rounded-xl overflow-hidden border border-base-content/10 group hover:scale-105 transition-all shadow-xs"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.previewUrl}
                alt="Upload preview"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(index)}
                className="absolute top-0.5 right-0.5 btn btn-circle btn-xs w-4 h-4 min-h-0 bg-black/60 hover:bg-black text-white border-none flex items-center justify-center cursor-pointer"
                title="Remove image"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* File attachment errors */}
      {fileError && (
        <div className="text-[10px] text-error font-medium px-1 mb-1.5 select-none animate-fade-in">
          {fileError}
        </div>
      )}

      <textarea
        ref={textareaRef}
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? defaultPlaceholder}
        className="chat-input-textarea w-full bg-transparent border-none text-base text-base-content leading-relaxed font-sans placeholder-base-content/30 resize-none max-h-40 py-1 focus:outline-hidden focus:ring-0 focus:ring-offset-0 min-h-6 max-w-full"
      ></textarea>

      {/* Bottom Actions Toolbar */}
      <div className="flex items-center justify-between border-t border-base-content/5 pt-2 mt-0.5 select-none">
        {/* Left: Attachment & Model Selector Pill */}
        <div className="flex items-center gap-2">
          {(activeModelSupportsVision || isImageModel) && (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-ghost btn-circle btn-xs text-base-content/60 hover:text-base-content hover:bg-base-content/10 backdrop-blur-sm"
                title="Attach images"
              >
                <Plus size={14} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
            </>
          )}

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
                className="dropdown-content menu p-1.5 shadow-xl glass-card rounded-xl w-52 text-[11px] font-mono font-bold text-base-content/85 z-50 mb-1.5"
                style={{ backgroundColor: "color-mix(in srgb, var(--color-base-200) 98%, transparent)" }}
              >
                {runnableModels.map((m) => {
                  const isDisabled = disabledModels?.includes(m);
                  const isRemote = m.includes("/");
                  const [provider, rawName] = isRemote ? m.split("/") : ["ollama", m];
                  const displayName = isRemote ? rawName.replace(/-/g, " ").toUpperCase() : m;

                  return (
                    <li key={m}>
                      <button
                        type="button"
                        disabled={isDisabled}
                        onClick={() => {
                          if (isDisabled) return;
                          onModelChange?.(m);
                          if (document.activeElement instanceof HTMLElement) {
                            document.activeElement.blur();
                          }
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-left w-full flex items-center justify-between gap-1.5 ${
                          isDisabled ? "opacity-35 cursor-not-allowed" : "hover:bg-base-content/10 hover:text-base-content"
                        } ${
                          m === activeModel ? "bg-user-accent/10 text-user-accent" : ""
                        }`}
                      >
                        <span className={`truncate max-w-30 ${isDisabled && "line-through"}`}>{displayName}</span>
                        {isRemote && (
                          <span className={`badge badge-xs text-[7.5px] scale-90 border-none font-bold px-1 py-0.5 rounded-xs select-none shrink-0 ${
                            provider === "openai" ? "bg-emerald-500/10 text-emerald-400" :
                            provider === "anthropic" ? "bg-amber-500/10 text-amber-400" :
                            provider === "gemini" ? "bg-blue-500/10 text-blue-400" : "bg-user-accent/15 text-user-accent"
                          }`}>
                            {provider.toUpperCase()}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <span className="text-[11px] font-mono font-semibold text-base-content/30 bg-base-content/5 px-2 py-0.5 rounded-full select-none">
              No active model
            </span>
          )}

          {availableTools && availableTools.length > 0 && (
            <div className="dropdown dropdown-top select-none">
              <div
                tabIndex={0}
                role="button"
                className={`flex items-center gap-1.5 text-[11px] font-mono font-bold h-6 px-2.5 rounded-full cursor-pointer focus:outline-hidden transition-all ${
                  activeTools.length > 0
                    ? "bg-user-accent/15 text-user-accent border border-user-accent/30 hover:bg-user-accent/25"
                    : "text-base-content/60 bg-base-content/5 hover:bg-base-content/10"
                }`}
              >
                <Wrench className="w-3 h-3" />
                <span>Tools ({activeTools.length})</span>
                <span className="text-[8px] opacity-65">▼</span>
              </div>
              <div
                tabIndex={0}
                className="dropdown-content card card-compact p-3 shadow-xl glass-card rounded-xl w-44 text-base-content z-50 mb-1.5 border border-base-content/10"
                style={{ backgroundColor: "color-mix(in srgb, var(--color-base-200) 95%, transparent)" }}
              >
                <h4 className="font-bold text-xs uppercase tracking-wider mb-2 border-b border-base-content/5 pb-1">
                  Active Tools
                </h4>
                <div className="flex flex-col gap-2">
                  {availableTools.map((t) => (
                    <label
                      key={t.name}
                      className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-base-content/5 cursor-pointer transition-all"
                    >
                      <input
                        type="checkbox"
                        checked={activeTools.includes(t.name)}
                        onChange={() => toggleTool(t.name)}
                        className="checkbox checkbox-xs checkbox-theme-adaptive border-user-accent checked:bg-user-accent checked:border-user-accent focus:ring-0"
                      />
                      <span className="text-[10px] font-bold font-mono text-base-content leading-none">
                        {t.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
          {mcpCount > 0 && (
            <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-user-accent bg-user-accent/10 border border-user-accent/20 h-6 px-2.5 rounded-full select-none animate-fade-in">
              <span>MCP: {mcpCount}</span>
            </div>
          )}
        </div>

        {/* Right: Send or Stop Button */}
        {isGenerating ? (
          <button
            type="button"
            onClick={stopGeneration}
            className="btn btn-circle btn-xs md:btn-sm shrink-0 shadow-xs border border-user-accent text-user-accent hover:bg-user-accent/10 hover:scale-105 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
            title="Stop generating"
          >
            <Square size={10} className="text-inherit fill-user-accent" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={disabled || (text.trim() === "" && attachments.length === 0)}
            className={`btn btn-circle btn-xs md:btn-sm shrink-0 shadow-xs border bg-transparent hover:bg-user-accent/10 transition-all ${
              disabled || (text.trim() === "" && attachments.length === 0)
                ? "opacity-30 cursor-not-allowed border-base-content/10 text-base-content/30"
                : "hover:scale-105 active:scale-95 border-user-accent text-user-accent cursor-pointer"
            }`}
          >
            <SendHorizonal size={14} className="text-inherit animate-none" />
          </button>
        )}
      </div>
    </div>
  );
}
