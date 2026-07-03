import { marked } from "marked";
import markedKatex from "marked-katex-extension";
import hljs from "highlight.js";

// Use the KaTeX extension to render inline and block LaTeX math
marked.use(
  markedKatex({
    throwOnError: false,
    nonStandard: true, // Supports $formula$ without strict surrounding whitespace
  })
);

// Customize code rendering with syntax highlighting and a sticky copy button wrapper
marked.use({
  renderer: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    code(token: any) {
      const text = token.text || "";
      const lang = token.lang || "";
      const validLanguage = lang && hljs.getLanguage(lang) ? lang : "plaintext";
      const highlighted = hljs.highlight(text, { language: validLanguage }).value;

      return `
        <div class="code-block-wrapper relative group my-4">
          <div class="absolute right-2 top-2 bottom-2 pointer-events-none flex flex-col justify-start z-10">
            <button
              type="button"
              class="copy-button sticky top-2 pointer-events-auto opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity btn btn-square btn-xs bg-base-100 hover:bg-base-200 border border-base-content/15 shadow-xs flex items-center justify-center"
              title="Copy code"
            >
              <img src="/resources/svg/copy-icon.svg" class="w-3.25 h-3.25 pointer-events-none" alt="Copy" />
            </button>
          </div>
          <pre class="no-scrollbar"><code class="hljs language-${validLanguage}">${highlighted}</code></pre>
        </div>
      `;
    },
  },
});

/**
 * Parses markdown text (including LaTeX math) into safe HTML.
 *
 * @param text The raw markdown content from the model
 * @returns Safe HTML string
 */
export function parseMarkdown(text: string): string {
  if (!text) return "";

  try {
    return marked.parse(text, {
      async: false,
      gfm: true,
      breaks: true,
    }) as string;
  } catch (error) {
    console.error("Markdown parsing error:", error);
    return text;
  }
}

export interface ParsedResponse {
  thinkingHtml: string;
  contentHtml: string;
  isStillThinking: boolean;
  hasThinking: boolean;
}

/**
 * Splits raw LLM response into thinking and content segments, compiling both into HTML.
 * 
 * @param rawText The raw text output containing optional <think>...</think> tags
 * @returns ParsedResponse containing compiled HTML parts, thinking state, and presence flag
 */
export function parseResponseParts(rawText: string): ParsedResponse {
  if (!rawText) {
    return { thinkingHtml: "", contentHtml: "", isStillThinking: false, hasThinking: false };
  }

  const trimmed = rawText.trim();
  if (trimmed.startsWith("<think>")) {
    const closeIndex = trimmed.indexOf("</think>");
    if (closeIndex !== -1) {
      // Thinking completed
      const thinkingRaw = trimmed.slice(7, closeIndex).trim();
      const contentRaw = trimmed.slice(closeIndex + 8).trim();
      return {
        thinkingHtml: parseMarkdown(thinkingRaw),
        contentHtml: parseMarkdown(contentRaw),
        isStillThinking: false,
        hasThinking: true,
      };
    } else {
      // Model is still streaming thought tokens
      const thinkingRaw = trimmed.slice(7).trim();
      return {
        thinkingHtml: parseMarkdown(thinkingRaw),
        contentHtml: "",
        isStillThinking: true,
        hasThinking: true,
      };
    }
  }

  // Standard response (no thinking tags)
  return {
    thinkingHtml: "",
    contentHtml: parseMarkdown(rawText),
    isStillThinking: false,
    hasThinking: false,
  };
}
