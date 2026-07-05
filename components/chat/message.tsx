import React, { useState, useEffect } from "react";
import { MessageRole } from "./types";
import { parseResponseParts } from "@/lib/markdown";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export interface ChatMessageProps {
  role: MessageRole;
  content: string;
  pendingStatus?: "loading" | "generating";
  modelName?: string;
  images?: string[];
  generatedImages?: string[];
}

export default function ChatMessage({
  role,
  content,
  pendingStatus,
  modelName,
  images,
  generatedImages,
}: Readonly<ChatMessageProps>) {
  const isUser = role === "user";
  const displayImages = images || generatedImages;
  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);

  // Keyboard navigation listener for full screen modal
  useEffect(() => {
    if (activeImageIndex === null || !displayImages || displayImages.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveImageIndex(null);
      } else if (e.key === "ArrowLeft" && displayImages.length > 1) {
        setActiveImageIndex((prev) => (prev !== null ? (prev - 1 + displayImages.length) % displayImages.length : null));
      } else if (e.key === "ArrowRight" && displayImages.length > 1) {
        setActiveImageIndex((prev) => (prev !== null ? (prev + 1) % displayImages.length : null));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeImageIndex, displayImages]);

  // Toggle body class for lightbox state transitions
  useEffect(() => {
    if (activeImageIndex !== null) {
      document.body.classList.add("lightbox-open");
    } else {
      document.body.classList.remove("lightbox-open");
    }
    return () => {
      document.body.classList.remove("lightbox-open");
    };
  }, [activeImageIndex]);

  const handleCopyCodeClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const button = target.closest(".copy-button") as HTMLButtonElement;
    if (!button) return;

    const wrapper = button.closest(".code-block-wrapper");
    const code = wrapper?.querySelector("code");

    if (code) {
      // Read text content and copy to user clipboard
      navigator.clipboard.writeText(code.innerText).then(() => {
        // Temporarily show success state referencing the static check SVG
        button.innerHTML = `<img src="/resources/svg/check-icon.svg" class="w-3.25 h-3.25 pointer-events-none" alt="Copied" />`;
        button.classList.add("text-success");
        button.setAttribute("title", "Copied!");

        setTimeout(() => {
          // Restore original copy button state referencing the static copy SVG asset
          button.innerHTML = `<img src="/resources/svg/copy-icon.svg" class="w-3.25 h-3.25 pointer-events-none" alt="Copy" />`;
          button.classList.remove("text-success");
          button.setAttribute("title", "Copy code");
        }, 2000);
      }).catch((err) => {
        console.error("Failed to copy text: ", err);
      });
    }
  };

  if (pendingStatus === "loading") {
    return (
      <div className="flex justify-start w-full my-4 font-sans text-base-content/50 max-w-full items-center gap-2 select-none animate-pulse">
        <span className="loading loading-dots loading-sm text-user-accent"></span>
        <span className="text-sm font-light italic">Loading the model...</span>
      </div>
    );
  }

  if (pendingStatus === "generating") {
    return (
      <div className="flex justify-start w-full my-4 font-sans text-base-content/50 max-w-full items-center gap-2 select-none animate-pulse">
        <span className="loading loading-ring loading-sm text-user-accent"></span>
        <span className="text-sm font-light italic">Generating...</span>
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="flex flex-col items-end w-full my-2">
        {displayImages && displayImages.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 max-w-[70%] justify-end select-none">
            {displayImages.map((src, index) => (
              <div
                key={src}
                className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border border-base-content/10 group cursor-pointer hover:opacity-90 shadow-md transition-all"
                onClick={() => setActiveImageIndex(index)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt="Message attachment"
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        )}
        <div className="glass-card text-base-content max-w-[70%] px-4 py-3 rounded-2xl rounded-tr-xs shadow-md text-base font-sans whitespace-pre-wrap">
          {content}
        </div>

        {/* Lightbox full screen image modal */}
        {activeImageIndex !== null && displayImages && displayImages[activeImageIndex] && (
          <div className="fixed inset-0 bg-base-300/40 backdrop-blur-xl z-[150] flex items-center justify-center select-none animate-fade-in p-4 border border-base-content/5 shadow-2xl">
            <div
              className="absolute inset-0 cursor-zoom-out"
              onClick={() => setActiveImageIndex(null)}
            />

            <button
              onClick={() => setActiveImageIndex(null)}
              className="absolute top-4 right-4 md:top-6 md:right-6 btn btn-circle bg-base-300/80 hover:bg-base-300 border border-base-content/15 text-base-content hover:scale-105 transition-all shadow-lg z-[160] w-10 h-10 md:w-12 md:h-12 flex items-center justify-center"
              title="Close preview"
            >
              <X size={20} className="text-base-content" />
            </button>

            {displayImages.length > 1 && (
              <button
                onClick={() =>
                  setActiveImageIndex((prev) =>
                    prev !== null ? (prev - 1 + displayImages.length) % displayImages.length : null
                  )
                }
                className="absolute left-6 btn btn-circle btn-sm bg-base-content/10 hover:bg-base-content/20 border border-base-content/10 backdrop-blur-md text-base-content/85 hover:text-base-content shadow-lg transition-all z-[160] w-10 h-10"
                title="Previous image"
              >
                <ChevronLeft size={20} />
              </button>
            )}

            <div className="relative max-h-[85vh] max-w-[85vw] flex items-center justify-center z-[160]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={displayImages[activeImageIndex]}
                alt="Expanded view"
                className="max-h-[85vh] max-w-[85vw] object-contain rounded-xl shadow-2xl border border-base-content/10 transition-all"
              />
              {displayImages.length > 1 && (
                <span className="absolute -bottom-10 text-[11px] font-mono font-bold text-base-content/75 bg-base-content/10 border border-base-content/10 backdrop-blur-md px-3 py-1 rounded-full">
                  {activeImageIndex + 1} / {displayImages.length}
                </span>
              )}
            </div>

            {displayImages.length > 1 && (
              <button
                onClick={() =>
                  setActiveImageIndex((prev) => (prev !== null ? (prev + 1) % displayImages.length : null))
                }
                className="absolute right-6 btn btn-circle btn-sm bg-base-content/10 hover:bg-base-content/20 border border-base-content/10 backdrop-blur-md text-base-content/85 hover:text-base-content shadow-lg transition-all z-[160] w-10 h-10"
                title="Next image"
              >
                <ChevronRight size={20} />
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  const { thinkingHtml, contentHtml, isStillThinking, hasThinking } = parseResponseParts(content);

  // Assistant response is raw text flowing top-down on the left, displaying optional thinking process
  return (
    <div className="flex flex-col justify-start w-full my-4 font-sans text-base leading-relaxed text-base-content max-w-full">
      {modelName && (
        <span className="text-xs font-mono font-bold tracking-wider text-base-content/50 mb-1.5 block select-none uppercase">
          {modelName}
        </span>
      )}
      {hasThinking && (
        <details
          open={isStillThinking}
          className="mb-4 group border-l-2 border-user-accent/20 pl-4 select-none w-full"
        >
          <summary className="cursor-pointer text-xs font-medium tracking-wide uppercase text-base-content/50 hover:text-base-content flex items-center gap-2 list-none outline-hidden">
            {isStillThinking ? "Thinking Process..." : "Thought Process"}
            <span className="text-[10px] opacity-60 transition-transform group-open:rotate-90">
              ▶
            </span>
          </summary>
          <div
            className="markdown-content mt-2 text-sm italic text-base-content/70 select-text"
            onClick={handleCopyCodeClick}
            dangerouslySetInnerHTML={{ __html: thinkingHtml || "<p>Analyzing...</p>" }}
          />
        </details>
      )}
      {contentHtml && (
        <div
          className="markdown-content w-full select-text"
          onClick={handleCopyCodeClick}
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />
      )}

      {displayImages && displayImages.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3 select-none">
          {displayImages.map((src, index) => (
            <div
              key={src}
              className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border border-base-content/10 group cursor-pointer hover:opacity-90 shadow-md transition-all"
              onClick={() => setActiveImageIndex(index)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt="Generated output"
                className="w-full h-full object-cover"
              />
            </div>
          ))}
        </div>
      )}

      {/* Lightbox full screen image modal */}
      {activeImageIndex !== null && displayImages && displayImages[activeImageIndex] && (
        <div className="fixed inset-0 bg-base-300/40 backdrop-blur-xl z-[150] flex items-center justify-center select-none animate-fade-in p-4 border border-base-content/5 shadow-2xl">
          <div
            className="absolute inset-0 cursor-zoom-out"
            onClick={() => setActiveImageIndex(null)}
          />

          <button
            onClick={() => setActiveImageIndex(null)}
            className="absolute top-4 right-4 md:top-6 md:right-6 btn btn-circle bg-base-300/80 hover:bg-base-300 border border-base-content/15 text-base-content hover:scale-105 transition-all shadow-lg z-[160] w-10 h-10 md:w-12 md:h-12 flex items-center justify-center"
            title="Close preview"
          >
            <X size={20} className="text-base-content" />
          </button>

          {displayImages.length > 1 && (
            <button
              onClick={() =>
                setActiveImageIndex((prev) =>
                  prev !== null ? (prev - 1 + displayImages.length) % displayImages.length : null
                )
              }
              className="absolute left-6 btn btn-circle btn-sm bg-base-content/10 hover:bg-base-content/20 border border-base-content/10 backdrop-blur-md text-base-content/85 hover:text-base-content shadow-lg transition-all z-[160] w-10 h-10"
              title="Previous image"
            >
              <ChevronLeft size={20} />
            </button>
          )}

          <div className="relative max-h-[85vh] max-w-[85vw] flex items-center justify-center z-[160]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displayImages[activeImageIndex]}
              alt="Expanded view"
              className="max-h-[85vh] max-w-[85vw] object-contain rounded-xl shadow-2xl border border-base-content/10 transition-all"
            />
            {displayImages.length > 1 && (
              <span className="absolute -bottom-10 text-[11px] font-mono font-bold text-base-content/75 bg-base-content/10 border border-base-content/10 backdrop-blur-md px-3 py-1 rounded-full">
                {activeImageIndex + 1} / {displayImages.length}
              </span>
            )}
          </div>

          {displayImages.length > 1 && (
            <button
              onClick={() =>
                setActiveImageIndex((prev) => (prev !== null ? (prev + 1) % displayImages.length : null))
              }
              className="absolute right-6 btn btn-circle btn-sm bg-base-content/10 hover:bg-base-content/20 border border-base-content/10 backdrop-blur-md text-base-content/85 hover:text-base-content shadow-lg transition-all z-[160] w-10 h-10"
              title="Next image"
            >
              <ChevronRight size={20} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
