import { getPrisma } from "../client";
import { logger } from "../../logger";

export interface DbMcpServer {
  id: string;
  sessionId: string;
  name: string;
  url: string;
  createdAt: Date;
}

/**
 * Repository containing all MCP server queries and updates.
 */
export async function listMcpServers(sessionId: string): Promise<DbMcpServer[]> {
  const prisma = getPrisma();
  return prisma.mcpServer.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });
}

export async function createMcpServer(
  sessionId: string,
  name: string,
  url: string
): Promise<DbMcpServer> {
  const prisma = getPrisma();
  const server = await prisma.mcpServer.create({
    data: {
      sessionId,
      name,
      url,
    },
  });
  logger.info(`Added MCP server [ID: ${server.id}, SessionID: ${sessionId}, Name: "${name}"]`);
  return server;
}

export async function deleteMcpServer(id: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.mcpServer.delete({
    where: { id },
  });
  logger.info(`Deleted MCP server [ID: ${id}]`);
}
