export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { setupRequestLogInterceptor } = await import("./lib/logger");
    setupRequestLogInterceptor();
  }
}
