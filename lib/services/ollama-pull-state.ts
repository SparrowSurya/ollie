import readEnv from "../config";

const env = readEnv();

const globalForOllama = globalThis as unknown as {
  activePullControllers?: Map<string, AbortController>;
};

export const activePullControllers =
  globalForOllama.activePullControllers ?? new Map<string, AbortController>();

if (env.envType !== "prod" && env.envType !== "production") {
  globalForOllama.activePullControllers = activePullControllers;
}
