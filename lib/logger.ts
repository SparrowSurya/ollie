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
