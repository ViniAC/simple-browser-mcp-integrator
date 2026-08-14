import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./lib/create-server.js";
import { createExtensionPageAccess } from "./lib/extension-page-access.js";
import { fixturePort, serveFixture } from "./lib/serve-fixture.js";

const fixture = await serveFixture(fixturePort);
const pageAccess = createExtensionPageAccess();
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
