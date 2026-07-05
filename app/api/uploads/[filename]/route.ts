import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import readEnv from "@/lib/config";

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
  try {
    const { filename } = await params;

    // Sanitize filename to prevent directory traversal
    const sanitizedFilename = path.basename(filename);

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
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("Error serving uploaded file:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
