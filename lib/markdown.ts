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
              onclick="window.copyCode(this)"
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
