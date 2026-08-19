import { listenMcpHttp, mcpHttpPort } from "./lib/listen-http.js";
import { envInt, startProductRuntime } from "./lib/product-runtime.js";

const runtime = await startProductRuntime();
const http = await listenMcpHttp({
  pageAccess: runtime.pageAccess,
  fixtureUrl: runtime.fixtureUrl,
  port: envInt("BROWSER_MCP_HTTP_PORT") ?? mcpHttpPort,
});

process.stderr.write(`listening ${http.url}\n`);

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  await http.close();
  await runtime.close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
