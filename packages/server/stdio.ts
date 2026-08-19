import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./lib/create-server.js";
import { startProductRuntime } from "./lib/product-runtime.js";

const runtime = await startProductRuntime();
const server = createServer(runtime.pageAccess, runtime.fixtureUrl);

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  await server.close();
  await runtime.close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
process.stdin.on("end", () => void shutdown());

const transport = new StdioServerTransport();
await server.connect(transport);
