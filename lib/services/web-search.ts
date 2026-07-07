import readEnv from "../config";
import { logger } from "../logger";

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export interface TavilySearchResponse {
  results: TavilySearchResult[];
  answer?: string;
}

/**
 * Performs a web search using the Tavily Search API.
 * @param query The search query string
 * @param maxResults Number of search results to retrieve (default: 5)
 */
export async function performWebSearch(query: string, maxResults?: number): Promise<string> {
  const env = readEnv();
  const apiKey = env.tavilyApiKey || process.env.TAVILY_API_KEY;

  if (!apiKey) {
    logger.warning("Tavily API key is not configured.");
    throw new Error("Tavily API key is not configured. Please add TAVILY_API_KEY to your .env file.");
  }

  const targetMaxResults = maxResults ?? env.tavilyMaxResults;

  logger.info(`Performing web search for query: "${query}" (maxResults: ${targetMaxResults})`);

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      max_results: targetMaxResults,
      search_depth: "basic",
      include_answer: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(`Tavily API request failed: ${response.statusText}`, errorText);
    throw new Error(`Tavily search request failed: ${response.statusText} (${errorText})`);
  }

  const data = (await response.json()) as TavilySearchResponse;
  
  if (!data.results || data.results.length === 0) {
    return "No search results found.";
  }

  // Format search results nicely for the LLM
  return data.results
    .map((result, idx) => {
      return `[${idx + 1}] Title: ${result.title}\nURL: ${result.url}\nSnippet: ${result.content}\n`;
    })
    .join("\n");
}
