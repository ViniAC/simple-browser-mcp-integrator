import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createFakePageAccess, type FakePageSeed } from "../fake-page-access.js";
import { createServer } from "../index.js";
import type { PageAccess } from "../lib/page-access.js";

export async function startAgentHost(pageAccess: PageAccess) {
  const server = createServer(pageAccess);
  const [hostTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const agentHost = new Client({ name: "test-agent-host", version: "0.0.0" });
  await Promise.all([
    server.connect(serverTransport),
    agentHost.connect(hostTransport),
  ]);
  return {
    callTool(name: string, args?: Record<string, unknown>) {
      return agentHost.callTool({ name, arguments: args });
    },
    async close() {
      await agentHost.close();
      await server.close();
    },
  };
}

export async function startSession(seed: FakePageSeed) {
  return startAgentHost(createFakePageAccess(seed));
}

export function parseToolJson(result: unknown) {
  if (typeof result !== "object" || result === null) {
    throw new Error("expected text tool content");
  }
  const record = result as {
    content?: Array<{ type?: string; text?: string }>;
    isError?: boolean;
  };
  const [first] = record.content ?? [];
  if (first?.type !== "text" || first.text === undefined) {
    throw new Error("expected text tool content");
  }
  return {
    isError: Boolean(record.isError),
    body: JSON.parse(first.text) as unknown,
  };
}
