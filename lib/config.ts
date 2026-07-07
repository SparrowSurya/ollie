/**
 * Interface containing collection of environment variables.
 */
export interface EnvConfig {
  /**
   * Environment type (default: 'dev')
   */
  envType: "prod" | "dev" | string;

  /**
   * Ollama Base URL (default: 'http://localhost:11434')
   */
  ollamaHost: string;

  /**
   * Duration to keep model warm in memory (default: '5m')
   */
  keepAlive: string;

  /**
   * Storage path for user file uploads (default: 'storage')
   */
  storagePath?: string;

  /**
   * Maximum count of images a user can upload at once (default: 5)
   */
  maxImageCount: number;

  /**
   * Maximum size limit in MB for each uploaded image (default: 5)
   */
  maxImageSizeMb: number;

  /**
   * Tavily Search API Key
   */
  tavilyApiKey?: string;

  /**
   * MCP connection timeout in milliseconds (default: 5000)
   */
  mcpConnectionTimeoutMs: number;

  /**
   * MCP tool execution timeout in milliseconds (default: 8000)
   */
  mcpExecutionTimeoutMs: number;
}

/**
 * Reads the environment variables for the project.
 * @returns {EnvConfig}
 */
export default function readEnv(): EnvConfig {
  return {
    envType: process.env.ENV_TYPE ?? "dev",
    ollamaHost: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    keepAlive: process.env.KEEP_ALIVE ?? "5m",
    storagePath: process.env.STORAGE_PATH ?? 'storage',
    maxImageCount: Number(process.env.NEXT_PUBLIC_MAX_IMAGE_COUNT ?? process.env.MAX_IMAGE_COUNT ?? 5),
    maxImageSizeMb: Number(process.env.NEXT_PUBLIC_MAX_IMAGE_SIZE_MB ?? process.env.MAX_IMAGE_SIZE_MB ?? 5),
    tavilyApiKey: process.env.TAVILY_API_KEY,
    mcpConnectionTimeoutMs: Number(process.env.MCP_CONNECTION_TIMEOUT_MS ?? 5000),
    mcpExecutionTimeoutMs: Number(process.env.MCP_EXECUTION_TIMEOUT_MS ?? 8000),
  };
}
