import fs from "fs/promises";
import path from "path";
import { getPrisma } from "../lib/db/client";

async function getReferencedFiles(): Promise<Set<string>> {
  const referenced = new Set<string>();
  const prisma = getPrisma();

  try {
    const messages = await prisma.message.findMany({
      select: {
        images: true,
        generatedImages: true,
      },
    });

    for (const msg of messages) {
      if (msg.images) {
        const urls = msg.images.split(",").map((url: string) => url.trim()).filter(Boolean);
        for (const url of urls) {
          referenced.add(path.basename(url));
        }
      }
      if (msg.generatedImages) {
        const urls = msg.generatedImages.split(",").map((url: string) => url.trim()).filter(Boolean);
        for (const url of urls) {
          referenced.add(path.basename(url));
        }
      }
    }
  } catch (error) {
    console.error("Failed to query messages from database, assuming no files are referenced:", error);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }

  return referenced;
}

async function clearDirectory(dirPath: string, referencedFiles: Set<string>) {
  try {
    const files = await fs.readdir(dirPath);
    for (const file of files) {
      if (file === ".gitkeep" || file === ".gitignore" || file.startsWith(".")) {
        continue;
      }
      
      const fullPath = path.join(dirPath, file);
      const stat = await fs.stat(fullPath);
      
      if (stat.isFile()) {
        if (referencedFiles.has(file)) {
          console.log(`Skipping referenced file: ${file}`);
        } else {
          await fs.unlink(fullPath);
          console.log(`Deleted unreferenced file: ${file}`);
        }
      }
    }
  } catch (error) {
    const err = error as { code?: string; message?: string };
    if (err.code === "ENOENT") {
      console.log(`Directory does not exist, skipping: ${dirPath}`);
    } else {
      console.error(`Error clearing directory ${dirPath}:`, err.message ?? String(error));
    }
  }
}

async function main() {
  const storageDir = process.env.STORAGE_PATH 
    ? path.resolve(process.env.STORAGE_PATH)
    : path.join(process.cwd(), "storage");

  console.log(`Starting image cleanup in storage path: ${storageDir}`);

  // Fetch all image files referenced in active chats
  const referencedFiles = await getReferencedFiles();
  console.log(`Found ${referencedFiles.size} referenced image files in the database.`);

  const generatedDir = path.join(storageDir, "generated");
  const uploadDir = path.join(storageDir, "upload");

  console.log(`Clearing generated images in: ${generatedDir}`);
  await clearDirectory(generatedDir, referencedFiles);

  console.log(`Clearing uploaded images in: ${uploadDir}`);
  await clearDirectory(uploadDir, referencedFiles);

  console.log("Image cleanup complete!");
}

main().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
