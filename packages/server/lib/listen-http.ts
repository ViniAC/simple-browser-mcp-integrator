import { randomUUID } from "node:crypto";
import http from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createServer } from "./create-server.js";
import type { PageAccess } from "./page-access.js";

export const mcpHttpPort = 7423;
export const mcpHttpHost = "127.0.0.1";
export const mcpHttpPath = "/mcp";

type Session = {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
};

export async function listenMcpHttp(options: {
  pageAccess: PageAccess;
  fixtureUrl?: string;
  port?: number;
}) {
  const sessions = new Map<string, Session>();
  const listener = http.createServer((req, res) => {
    void handleHttp(req, res, sessions, options).catch(() => {
      if (!res.headersSent) {
        res.writeHead(500).end();
      }
    });
  });
  const port = await listen(listener, options.port ?? mcpHttpPort, mcpHttpHost);

  return {
    url: `http://${mcpHttpHost}:${port}${mcpHttpPath}`,
    port,
    async close() {
      for (const session of sessions.values()) {
        await session.transport.close();
        await session.server.close();
      }
      sessions.clear();
      await closeListener(listener);
    },
  };
}

async function handleHttp(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  sessions: Map<string, Session>,
  options: { pageAccess: PageAccess; fixtureUrl?: string },
) {
  const path = req.url?.split("?")[0] ?? "/";
  if (path !== mcpHttpPath) {
    res.writeHead(404).end();
    return;
  }

  const parsedBody = req.method === "POST" ? await readJsonBody(req) : undefined;
  const sessionId = headerValue(req.headers["mcp-session-id"]);
  const existing = sessionId ? sessions.get(sessionId) : undefined;
  if (existing) {
    await existing.transport.handleRequest(req, res, parsedBody);
    return;
  }
  if (!sessionId && isInitializeRequest(parsedBody)) {
    await startSession(req, res, parsedBody, sessions, options);
    return;
  }
  res.writeHead(sessionId ? 404 : 400, {
    "content-type": "application/json",
  });
  res.end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Bad Request" },
      id: null,
    }),
  );
}

async function startSession(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  parsedBody: unknown,
  sessions: Map<string, Session>,
  options: { pageAccess: PageAccess; fixtureUrl?: string },
) {
  const server = createServer(options.pageAccess, options.fixtureUrl);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (id) => {
      sessions.set(id, { server, transport });
    },
  });
  transport.onclose = () => {
    const id = transport.sessionId;
    if (id) {
      sessions.delete(id);
    }
  };
  await server.connect(transport);
  await transport.handleRequest(req, res, parsedBody);
}

async function readJsonBody(req: http.IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return undefined;
  }
  return JSON.parse(raw) as unknown;
}

function headerValue(value: string | string[] | undefined) {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  return undefined;
}

function listen(server: http.Server, port: number, host: string) {
  return new Promise<number>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.removeListener("error", reject);
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("expected TCP address"));
        return;
      }
      resolve(address.port);
    });
  });
}

function closeListener(server: http.Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}
