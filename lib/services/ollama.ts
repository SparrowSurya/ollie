import readEnv from "../config";

const env = readEnv();

export class OllamaService {
  /**
   * Fetches all pulled/downloaded models from the Ollama host registry tags API.
   */
  static async getTags(signal?: AbortSignal) {
    const res = await fetch(`${env.ollamaHost}/api/tags`, { signal });
    if (!res.ok) {
      throw new Error(`Ollama tags query failed: ${res.statusText}`);
    }
    return res.json();
  }

  /**
   * Shows details of a specific local model.
   */
  static async showModel(modelName: string, signal?: AbortSignal) {
    const res = await fetch(`${env.ollamaHost}/api/show`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: modelName }),
      signal,
    });
    if (!res.ok) {
      throw new Error(`Ollama show model metadata failed: ${res.statusText}`);
    }
    return res.json();
  }

  /**
   * Fetches capabilities (e.g. "image", "completion") for a specific model.
   */
  static async getModelCapabilities(modelName: string, signal?: AbortSignal): Promise<string[]> {
    try {
      const data = await this.showModel(modelName, signal);
      return data.capabilities || [];
    } catch {
      return [];
    }
  }

  /**
   * Fetches currently loaded models from the active memory processes (/api/ps).
   */
  static async ps(signal?: AbortSignal) {
    const res = await fetch(`${env.ollamaHost}/api/ps`, { signal });
    if (!res.ok) {
      throw new Error(`Ollama processes state check failed: ${res.statusText}`);
    }
    return res.json();
  }

  /**
   * Deletes a local model from Ollama.
   */
  static async delete(modelName: string, signal?: AbortSignal) {
    const res = await fetch(`${env.ollamaHost}/api/delete`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: modelName }),
      signal,
    });
    if (!res.ok) {
      throw new Error(`Ollama delete model failed: ${res.statusText}`);
    }
    return res.ok;
  }

  /**
   * Triggers a model pull (download) request from the Ollama library.
   * Returns the Response directly to allow streaming progress chunks.
   */
  static async pullStream(modelName: string, signal?: AbortSignal): Promise<Response> {
    const res = await fetch(`${env.ollamaHost}/api/pull`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: modelName, stream: true }),
      signal,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(errText || `Ollama pull initiation failed: ${res.statusText}`);
    }
    return res;
  }
}
