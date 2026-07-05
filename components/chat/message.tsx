import React from "react";
import { MessageRole } from "./types";
import { parseResponseParts } from "@/lib/markdown";

export interface ChatMessageProps {
  role: MessageRole;
  content: string;
  pendingStatus?: "loading" | "generating";
  modelName?: string;
  images?: string[];
}

export default function ChatMessage({
  role,
  content,
  pendingStatus,
  modelName,
  images,
}: Readonly<ChatMessageProps>) {
  const isUser = role === "user";

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
        {images && images.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 max-w-[70%] justify-end select-none">
            {images.map((src) => (
              <div
                key={src}
                className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border border-base-content/10 group cursor-pointer hover:opacity-90 shadow-md transition-all"
                onClick={() => window.open(src, "_blank")}
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
    </div>
  );
}
