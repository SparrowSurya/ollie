import { NextResponse } from "next/server";
import { getSession, listMcpServers, createMcpServer, deleteMcpServer, updateMcpServer } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId parameter" }, { status: 400 });
    }

    const servers = await listMcpServers(sessionId);
    return NextResponse.json({ servers });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    logger.error("GET /api/sessions/mcp error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to retrieve MCP servers" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { sessionId, name, url } = await req.json();

    if (!sessionId || !name || !url) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate URL structure
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    // Verify session exists using repository
    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const server = await createMcpServer(sessionId, name, url);
    return NextResponse.json({ server });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    logger.error("POST /api/sessions/mcp error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to add MCP server" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing server ID parameter" }, { status: 400 });
    }

    await deleteMcpServer(id);
    return NextResponse.json({ success: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    logger.error("DELETE /api/sessions/mcp error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete MCP server" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const { id, name, url } = await req.json();

    if (!id || !name || !url) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate URL structure
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    const server = await updateMcpServer(id, name, url);
    return NextResponse.json({ server });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    logger.error("PUT /api/sessions/mcp error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update MCP server" },
      { status: 500 }
    );
  }
}
