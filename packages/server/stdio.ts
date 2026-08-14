import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildLoadableExtension } from "../extension/build.js";
import { createServer } from "./lib/create-server.js";
import { createAttachPageAccess } from "./lib/extension-page-access.js";
import { fixturePort, serveFixture } from "./lib/serve-fixture.js";

const fixture = await serveFixture(fixturePort);
const pageAccess = await createAttachPageAccess(await resolveAttach());
const server = createServer(pageAccess, fixture.url);

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  await server.close();
  await pageAccess.close();
  fixture.close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
process.stdin.on("end", () => void shutdown());

const transport = new StdioServerTransport();
await server.connect(transport);

async function resolveAttach() {
  const secret = process.env.BROWSER_MCP_ATTACH_SECRET;
  const port = envInt("BROWSER_MCP_ATTACH_PORT");
  const attachTimeoutMs = envInt("BROWSER_MCP_ATTACH_TIMEOUT_MS");
  if (secret && port !== undefined) {
    return { secret, port, attachTimeoutMs };
  }
  const extension = await buildLoadableExtension();
  return {
    secret: extension.secret,
    port: extension.port,
    attachTimeoutMs,
  };
}

function envInt(name: string) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    return undefined;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}
