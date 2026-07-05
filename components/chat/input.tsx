"use client";

import React, { useState, useRef, useEffect } from "react";
import { SendHorizonal, Plus, X } from "lucide-react";
import { useChatContext } from "@/contexts/ChatContext";
import { useOllama } from "@/contexts/OllamaContext";

export interface ChatInputProps {
  placeholder?: string;
  onSend?: (text: string, imageFiles?: File[]) => void;
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

  const { imageModels } = useOllama();
  const { activeModelSupportsVision } = useChatContext();

  const isImageModel = imageModels.includes(activeModel);
  const defaultPlaceholder = isImageModel
    ? "Describe the image you want to generate..."
    : "Ask Olly...";

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
    onSend?.(message, filesToSend);

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
      if (!disabled) {
        handleSubmit();
      }
    }
  };

  return (
    <div
      className="flex flex-col glass-card rounded-2xl md:rounded-3xl p-3 px-4 transition-all shadow-lg focus-within:border-user-accent focus-within:ring-1 focus-within:ring-user-accent/30 gap-1.5"
    >
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
        className="w-full bg-transparent border-none text-base text-base-content leading-relaxed font-sans placeholder-base-content/30 resize-none max-h-40 py-1 focus:outline-hidden focus:ring-0 focus:ring-offset-0 min-h-6 max-w-full"
      ></textarea>

      {/* Bottom Actions Toolbar */}
      <div className="flex items-center justify-between border-t border-base-content/5 pt-2 mt-0.5 select-none">
        {/* Left: Attachment & Model Selector Pill */}
        <div className="flex items-center gap-2">
          {activeModelSupportsVision && (
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
          disabled={disabled || (text.trim() === "" && attachments.length === 0)}
          className={`btn btn-circle btn-xs md:btn-sm shrink-0 shadow-xs border bg-transparent hover:bg-user-accent/10 transition-all ${
            disabled || (text.trim() === "" && attachments.length === 0)
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
