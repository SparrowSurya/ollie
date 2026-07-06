import { NextResponse } from "next/server";
import { getSession, updateSessionInstructions } from "@/lib/db";
import path from "path";
import fs from "fs/promises";
import readEnv from "@/lib/config";

const env = readEnv();
const baseStorageDir = env.storagePath 
  ? path.resolve(env.storagePath) 
  : path.join(process.cwd(), "storage");
const configPath = path.join(baseStorageDir, "custom_instructions.txt");

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (sessionId) {
      const session = await getSession(sessionId);
      if (session) {
        return NextResponse.json({ customInstructions: session.customInstructions || "" });
      }
    }

    // Fallback to global custom instructions from file
    let globalInstructions = "";
    try {
      globalInstructions = await fs.readFile(configPath, "utf-8");
    } catch {
      // File does not exist yet, return empty
    }

    return NextResponse.json({ customInstructions: globalInstructions });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("GET /api/settings/instructions error:", error);
    return NextResponse.json({ error: errorMsg || "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { customInstructions, sessionId } = await req.json();

    if (sessionId) {
      await updateSessionInstructions(sessionId, customInstructions || "");
      return NextResponse.json({ success: true, scope: "session" });
    }

    // Save as global custom instructions to file
    await fs.mkdir(baseStorageDir, { recursive: true });
    await fs.writeFile(configPath, customInstructions || "", "utf-8");

    return NextResponse.json({ success: true, scope: "global" });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("POST /api/settings/instructions error:", error);
    return NextResponse.json({ error: errorMsg || "Internal Server Error" }, { status: 500 });
  }
}
