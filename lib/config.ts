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
   * Maximum search results for web search (default: 5)
   */
  tavilyMaxResults: number;

  /**
   * MCP connection timeout in milliseconds (default: 5000)
   */
  mcpConnectionTimeoutMs: number;

  /**
   * MCP tool execution timeout in milliseconds (default: 8000)
   */
  mcpExecutionTimeoutMs: number;

  /**
   * List of tools enabled by default for the whole server (no UI selection, always active)
   */
  enabledToolsList: string[];

  /**
   * List of tools that are completely disabled (no UI selection, cannot be run)
   */
  disabledToolsList: string[];

  /**
   * List of tools that require manual user selection in the UI to be active
   */
  manualToolsList: string[];
}

/**
 * Reads the environment variables for the project.
 * @returns {EnvConfig}
 */
export default function readEnv(): EnvConfig {
  const parseToolList = (envVal: string | undefined): string[] => {
    if (!envVal) return [];
    return envVal
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  };

  return {
    envType: process.env.ENV_TYPE ?? "dev",
    ollamaHost: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    keepAlive: process.env.KEEP_ALIVE ?? "5m",
    storagePath: process.env.STORAGE_PATH ?? 'storage',
    maxImageCount: Number(process.env.NEXT_PUBLIC_MAX_IMAGE_COUNT ?? process.env.MAX_IMAGE_COUNT ?? 5),
    maxImageSizeMb: Number(process.env.NEXT_PUBLIC_MAX_IMAGE_SIZE_MB ?? process.env.MAX_IMAGE_SIZE_MB ?? 5),
    tavilyApiKey: process.env.TAVILY_API_KEY,
    tavilyMaxResults: Number(process.env.TAVILY_MAX_RESULTS ?? 5),
    mcpConnectionTimeoutMs: Number(process.env.MCP_CONNECTION_TIMEOUT_MS ?? 5000),
    mcpExecutionTimeoutMs: Number(process.env.MCP_EXECUTION_TIMEOUT_MS ?? 8000),
    enabledToolsList: parseToolList(process.env.ENABLED_TOOLS),
    disabledToolsList: parseToolList(process.env.DISABLED_TOOLS),
    manualToolsList: parseToolList(process.env.MANNUAL_TOOLS || process.env.MANUAL_TOOLS),
  };
}

/**
 * Resolves the status of a tool based on the environment configuration rules.
 *
 * Rules:
 * 1. If in disabledToolsList, status is DISABLED.
 * 2. If in manualToolsList (and not disabled), status is MANUAL (requires UI selection).
 * 3. Otherwise (and not disabled), status is ENABLED (enabled by default, no UI selection needed).
 */
export function getToolStatus(toolName: string, env: EnvConfig): "DISABLED" | "MANUAL" | "ENABLED" {
  if (env.disabledToolsList.includes(toolName)) {
    return "DISABLED";
  }
  if (env.manualToolsList.includes(toolName)) {
    return "MANUAL";
  }
  return "ENABLED";
}
