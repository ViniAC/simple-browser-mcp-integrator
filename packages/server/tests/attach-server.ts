import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "../index.js";
import { createAttachPageAccess } from "../lib/extension-page-access.js";

const secret = requiredEnv("BROWSER_MCP_ATTACH_SECRET");
const port = Number(requiredEnv("BROWSER_MCP_ATTACH_PORT"));
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("BROWSER_MCP_ATTACH_PORT must be a valid TCP port");
}

const pageAccess = await createAttachPageAccess({ secret, port });
const server = createServer(pageAccess);
const transport = new StdioServerTransport();

process.stdin.once("end", () => {
  void pageAccess.close().finally(() => process.exit(0));
});

await server.connect(transport);

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}
