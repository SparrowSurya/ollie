import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import readEnv from "@/lib/config";

const env = readEnv();

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    // Max limit validation
    if (files.length > 5) {
      return NextResponse.json({ error: "Cannot upload more than 5 images at once." }, { status: 400 });
    }

    // Determine storage location
    const baseStorageDir = env.storagePath 
      ? path.resolve(env.storagePath) 
      : path.join(process.cwd(), "storage");
      
    const uploadDir = path.join(baseStorageDir, "upload");

    // Ensure upload directory exists recursively
    await fs.mkdir(uploadDir, { recursive: true });

    const savedFileUrls: string[] = [];

    for (const file of files) {
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: `File ${file.name} exceeds the 5MB limit` }, { status: 400 });
      }

      // Validate file type (image only)
      if (!file.type.startsWith("image/")) {
        return NextResponse.json({ error: `File ${file.name} is not an image` }, { status: 400 });
      }

      // Generate UNIX-TIMESTAMP_RANDOM-INT_IMAGENAME.IMAGE_EXTENSION filename
      const timestamp = Date.now();
      const randomInt = Math.floor(Math.random() * 10001); // 0 to 10000 inclusive
      
      // Sanitize the filename to prevent directory traversal
      const originalExtension = path.extname(file.name);
      const originalBaseName = path.basename(file.name, originalExtension);
      const sanitizedBaseName = originalBaseName.replace(/[^a-zA-Z0-9_-]/g, "_");
      
      const newFilename = `${timestamp}_${randomInt}_${sanitizedBaseName}${originalExtension}`;
      const destinationPath = path.join(uploadDir, newFilename);

      // Write file contents to disk
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await fs.writeFile(destinationPath, buffer);

      // Return the file reference URL. E.g. `/api/uploads/${newFilename}`
      savedFileUrls.push(`/api/uploads/${newFilename}`);
    }

    return NextResponse.json({ urls: savedFileUrls });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("Error in /api/upload:", error);
    return NextResponse.json(
      { error: error.message || "Failed to upload files" },
      { status: 500 }
    );
  }
}
