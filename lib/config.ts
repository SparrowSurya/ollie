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
}

/**
 * Reads the environment variables for the project.
 * @returns {EnvConfig}
 */
export default function readEnv(): EnvConfig {
  return {
    envType: Bun.env.ENV_TYPE ?? "dev",
    ollamaHost: Bun.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    keepAlive: Bun.env.keepAlive ?? Bun.env.KEEP_ALIVE ?? "5m",
    storagePath: Bun.env.STORAGE_PATH ?? 'storage',
  };
}
