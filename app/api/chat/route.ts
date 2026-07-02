import { NextRequest, NextResponse } from "next/server";

// Mock sentences to generate realistic streaming responses on the server
const mockSentences = [
  "Ollama is a lightweight, extensible framework for building and running large language models on your local machine.",
  "It allows developers to download, run, and customize open-source models like Gemma, Llama, and Mistral with a simple set of commands.",
  "In the next step of this project, we will establish a Next.js API route that connects this frontend application directly to your local Ollama server.",
  "This will enable real-time streaming responses from your locally running models, utilizing Server-Sent Events for a smooth user experience.",
  "The UI is designed to support dynamic theme switching using the Catppuccin color scheme, including Latte, Frappe, Macchiato, and Mocha flavors.",
  "Once the database integration is complete, all chat histories, settings, and sessions will be persisted locally, allowing you to resume chats anytime.",
  "Next.js App Router provides efficient server rendering, while Tailwind CSS v4 and daisyUI v5 ensure a highly polished, responsive interface."
];

export async function POST(req: NextRequest) {
  try {
    const encoder = new TextEncoder();

    // Prepare the word pool
    const allWords = mockSentences.join(" ").split(/\s+/);
    const wordCount = Math.floor(Math.random() * 21) + 40; // 40-60 words
    const startIndex = Math.floor(Math.random() * Math.max(1, allWords.length - wordCount));
    const selectedWords = allWords.slice(startIndex, startIndex + wordCount);

    const stream = new ReadableStream({
      async start(controller) {
        let currentIndex = 0;

        const sendWord = () => {
          if (currentIndex < selectedWords.length) {
            // Enqueue word with a space
            const word = selectedWords[currentIndex];
            const data = currentIndex === 0 ? word : ` ${word}`;
            controller.enqueue(encoder.encode(data));
            currentIndex++;
            setTimeout(sendWord, 45); // Stream a word approximately every 45ms
          } else {
            controller.close();
          }
        };

        sendWord();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
