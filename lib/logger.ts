/* eslint-disable @typescript-eslint/no-explicit-any */
const colors = {
  DEBUG: "\x1b[36m",   // Cyan
  INFO: "\x1b[32m",    // Green
  WARNING: "\x1b[33m", // Yellow
  ERROR: "\x1b[31m",   // Red
};
const RESET = "\x1b[0m";

function getFormattedTime(): string {
  const now = new Date();
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 hour should be 12
  const hourStr = String(hours).padStart(2, "0");
  return `${hourStr}:${minutes}:${seconds} ${ampm}`;
}

export const logger = {
  debug(message: string): void {
    console.log(`${colors.DEBUG}[DEBUG]${RESET} [${getFormattedTime()}] ${message}`);
  },
  info(message: string): void {
    console.log(`${colors.INFO}[INFO]${RESET} [${getFormattedTime()}] ${message}`);
  },
  warning(message: string): void {
    console.log(`${colors.WARNING}[WARNING]${RESET} [${getFormattedTime()}] ${message}`);
  },
  error(message: string, error?: any): void {
    const errorDetails = error ? ` (Details: ${error.message || String(error)})` : "";
    console.error(`${colors.ERROR}[ERROR]${RESET} [${getFormattedTime()}] ${message}${errorDetails}`);
  },
};

let isHooked = false;

export function setupRequestLogInterceptor(): void {
  if (isHooked) return;
  if (typeof window !== "undefined") return; // Only run on server
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== "nodejs") return;

  const originalWrite = process.stdout.write.bind(process.stdout);
  
  process.stdout.write = (chunk: any, encoding?: any, callback?: any): boolean => {
    try {
      const str = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      
      // Strip ANSI escape color codes to get raw text for reliable matching
      const cleanStr = str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
      const trimmedStr = cleanStr.trim();
      
      // Regex matches Next.js dev server request logs: METHOD PATH STATUS in TIME EXTRA
      // Handles any HTTP method, path, 3-digit status code, time (e.g. 41ms, 1.2s), and extra metadata
      const nextLogRegex = /^(GET|POST|PATCH|DELETE|PUT|OPTIONS|HEAD)\s+(\/\S*)\s+(\d{3})\s+in\s+(\S+)(.*)$/i;
      const match = trimmedStr.match(nextLogRegex);
      
      if (match) {
        const [, method, path, status, time, extra] = match;
        const statusCode = parseInt(status, 10);
        
        let level = "INFO";
        let color = colors.INFO;
        
        if (statusCode >= 500) {
          level = "ERROR";
          color = colors.ERROR;
        } else if (statusCode >= 400) {
          level = "WARNING";
          color = colors.WARNING;
        }
        
        const timePart = getFormattedTime();
        const cleanExtra = extra ? extra.trim() : "";
        const extraPart = cleanExtra ? ` ${cleanExtra}` : "";
        
        const formatted = `${color}[${level}]${RESET} [${timePart}] ${method} ${path} ${status} in ${time}${extraPart}\n`;
        
        originalWrite(formatted, encoding, callback);
        return true;
      }
    } catch {
      // Fallback to original write in case of parsing error
    }
    return originalWrite(chunk, encoding, callback);
  };
  
  isHooked = true;
}

// Auto-initialize if loaded
setupRequestLogInterceptor();
