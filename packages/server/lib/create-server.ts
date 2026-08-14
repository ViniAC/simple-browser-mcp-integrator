import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { openTargets } from "../../shared/open-target.js";
import type { PageAccess } from "./page-access.js";
import { runAction, runJson } from "./tool-result.js";

export function createServer(
  pageAccess: PageAccess,
  fixtureUrl?: string,
): McpServer {
  const instructions = fixtureUrl
    ? `Load unpacked the Extension from packages/extension/dist once. The Fixture Page is at ${fixtureUrl} Open it with open_page, then get_inventory, type, and click. After Clicking Submit, get_inventory again to see the Result region change.`
    : undefined;
  const server = new McpServer(
    {
      name: "browser-mcp-integrator",
      version: "0.0.1",
    },
    instructions ? { instructions } : undefined,
  );

  server.registerTool(
    "open_page",
    {
      description: fixtureUrl
        ? `Open a URL in the current page, a new tab, or the focused tab. The Fixture Page is at ${fixtureUrl}`
        : "Open a URL in the current page, a new tab, or the focused tab.",
      inputSchema: {
        url: z.string(),
        target: z.enum(openTargets).optional(),
      },
    },
    async ({ url, target }) =>
      runJson(() => pageAccess.open(url, target ?? "current")),
  );

  server.registerTool(
    "get_inventory",
    {
      description: "Read the Page Inventory of the current page.",
    },
    async () => runJson(() => pageAccess.getInventory()),
  );

  server.registerTool(
    "click",
    {
      description: "Activate the element at a Path.",
      inputSchema: {
        role: z.string(),
        name: z.string(),
      },
    },
    async ({ role, name }) =>
      runAction(() => pageAccess.click({ role, name })),
  );

  server.registerTool(
    "type",
    {
      description: "Replace the current value at a Path.",
      inputSchema: {
        role: z.string(),
        name: z.string(),
        value: z.string(),
      },
    },
    async ({ role, name, value }) =>
      runAction(() => pageAccess.type({ role, name }, value)),
  );

  return server;
}
