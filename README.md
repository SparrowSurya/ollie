# Ollie

Ollie is a premium, modern, glassmorphic web interface for running local LLMs served via Ollama. Built using Next.js (App Router), Tailwind CSS, DaisyUI (Catppuccin themes), LangChain, LangGraph, and Prisma.

---

## Key Features

- **Local LLM Chatting & Streaming**: Stream responses dynamically from any model pulled in Ollama.
- **Thinking Process Collapser**: Supports rendering of reasoning/thinking tokens (e.g., DeepSeek/Gemma reasoning states) inside a neat collapsible dropdown.
- **Direct Image Chat**: Dedicated image generation interface for models that natively generate images (e.g., FLUX, Stable Diffusion).
- **Extensible AI Tool Calling**: Equip text-only models with tools like `generate_image`, enabling them to dynamically call image models in the background when the user asks to draw or paint.
- **Zero-Config Database Setup**: Uses a local SQLite file database for immediate local development, but includes an environment-aware pre-hook script supporting automatic transition to PostgreSQL or Turso for production.
- **Full Conversation History**: Persist chat sessions, dynamic sidebar navigation, and session rename/deletion controls.

---

## Directory Structure

```
ollie/
├── app/                      # Next.js layouts, pages, and API routing
│   ├── api/                  # Route handlers (chat pipeline, model management, sessions, file uploads)
│   └── chat/                 # Main chat page and session routing
├── components/               # UI components
│   ├── chat/                 # Chat input, message list, sidebar navigation, and global settings
│   └── settings/             # Settings tabs (Appearance, Model Manager, Database)
├── contexts/                 # React Context providers (Chat, Ollama state, and Settings)
├── lib/                      # Core business logic
│   ├── db/                   # Prisma database client & repository operations
│   ├── services/             # Low-level API callers (Ollama tags, processes, image generations)
│   ├── tools/                # Modular agent tool schemas (LangChain binding)
│   ├── agent.ts              # LangGraph StateGraph orchestrator
│   └── markdown.ts           # Markdown & LaTeX parser
├── prisma/                   # Database models & configuration (schema.prisma)
├── public/                   # Static assets (stylesheets, logos, resources)
└── scripts/                  # Project utility scripts (Prisma preprocessing)
```

---

## Setup & Installation

### Prerequisites
- [Ollama](https://ollama.com/) must be installed and running on your local machine.
- [Bun](https://bun.sh/) package manager.

### 1. Install Dependencies
```bash
bun install
```

### 2. Set Up Environment Variables
Create a `.env` file in the root directory:
```env
DATABASE_URL="file:./dev.db"

# Maximum count of image uploads allowed per user request (default is 5)
NEXT_PUBLIC_MAX_IMAGE_COUNT=5

# Maximum size in MB of each uploaded image (default is 5)
NEXT_PUBLIC_MAX_IMAGE_SIZE_MB=5

# Project environment type
ENV_TYPE="dev"

# Ollama host service provider
OLLAMA_HOST="http://localhost:11434"

# Maximum time a model is allowed to be loaded in GPU while not running. (see ollama docs for details)
KEEP_ALIVE="5m"

# Tavily Search API Key for agent web search capabilities
TAVILY_API_KEY=""
```

### 3. Initialize the Database
This runs the Prisma preprocessor to set the correct database provider, generates the client, and pushes the tables:
```bash
bun run db:push
```

### 4. Start the Development Server
```bash
bun run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Database Preprocessor (`scripts/prepare-prisma.ts`)

The project uses a custom pre-hook script (`bun scripts/prepare-prisma.ts`) that runs automatically during `bun run dev` or `bun run build`. 
- **SQLite**: Defaults to `sqlite` when running locally with `file:./dev.db`.
- **PostgreSQL**: Detects a `postgres://` or `postgresql://` string in `DATABASE_URL` and rewrites the `datasource db` provider in `schema.prisma` to `postgresql` dynamically.

---

## Developer Guide: Adding New Agent Tools

Ollie features a highly modular, decoupled tool architecture. Tools are defined separately from the core agent orchestrator, making it easy to extend the agent's capabilities.

### How Tools are Modularized
1. **Services (`lib/services/`)**: Handle direct network requests, file operations, database calls, or integrations.
2. **Tool Schemas (`lib/tools/`)**: Define the validation schema (using Zod) and wrap the service method to match LangChain's interface.
3. **Tool Registry (`lib/tools/index.ts`)**: Collects and exports the array of tools so they are dynamically bound to the Ollama model instance.

### Steps to Add a New Tool (e.g. Web Search)

1. **Implement the Service**: Create `lib/services/web-search.ts` to perform the actual query:
   ```typescript
   export async function performWebSearch(query: string): Promise<string> {
     // Fetch results from Google, Bing, DuckDuckGo, etc.
     return "Search results...";
   }
   ```

2. **Define the Tool wrapper**: Create `lib/tools/web-search.ts` using `@langchain/core/tools`:
   ```typescript
   import { tool } from "@langchain/core/tools";
   import { z } from "zod";
   import { performWebSearch } from "../services/web-search";

   export const webSearchTool = tool(
     async ({ query }) => {
       try {
         const results = await performWebSearch(query);
         return `Search Results: ${results}`;
       } catch (err: any) {
         return `Search failed: ${err.message}`;
       }
     },
     {
       name: "web_search",
       description: "Searches the web for recent info. Use this when the user asks queries about real-time events.",
       schema: z.object({
         query: z.string().describe("The search query to lookup"),
       }),
     }
   );
   ```

3. **Register the Tool**: Import and add the new tool to the `agentTools` array in `lib/tools/index.ts`:
   ```typescript
   import { imageGenTool } from "./image-gen";
   import { webSearchTool } from "./web-search"; // 1. Import new tool

   export { imageGenTool, webSearchTool };

   export const agentTools = [
     imageGenTool,
     webSearchTool, // 2. Add to registry
   ];
   ```

The LangGraph compiler in `lib/agent.ts` automatically binds `agentTools` to the `ChatOllama` model and routes control loops to the executor when the model requests tool calls.