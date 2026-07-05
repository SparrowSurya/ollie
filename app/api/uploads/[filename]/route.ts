import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import readEnv from "@/lib/config";
import { logger } from "@/lib/logger";

const env = readEnv();

// Map of standard image file extensions to their MIME types
const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  let sanitizedFilename = "unknown";
  try {
    const { filename } = await params;

    // Sanitize filename to prevent directory traversal
    sanitizedFilename = path.basename(filename);
    logger.info(`Serving request for file: "${sanitizedFilename}"`);

    const baseStorageDir = env.storagePath 
      ? path.resolve(env.storagePath) 
      : path.join(process.cwd(), "storage");
      
    let filePath = path.join(baseStorageDir, "upload", sanitizedFilename);

    try {
      // Check if file exists in 'upload' folder, if not check 'generated' folder
      try {
        await fs.access(filePath);
      } catch {
        filePath = path.join(baseStorageDir, "generated", sanitizedFilename);
        await fs.access(filePath);
      }

      logger.info(`Serving file from path: "${filePath}"`);
      const fileBuffer = await fs.readFile(filePath);
      const ext = path.extname(sanitizedFilename).toLowerCase();
      const contentType = MIME_TYPES[ext] || "application/octet-stream";

      return new Response(fileBuffer, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch {
      logger.warning(`File not found: "${sanitizedFilename}" in storage folders`);
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    logger.error(`Error serving file "${sanitizedFilename}":`, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

