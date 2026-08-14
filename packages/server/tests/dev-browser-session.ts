import { createExtensionPageAccess } from "../lib/extension-page-access.js";
import { serveFixture } from "../lib/serve-fixture.js";
import { startAgentHost } from "./agent-host.js";

export async function startDevBrowserSession() {
  const { url, close: closeHttp } = await serveFixture();
  const pageAccess = createExtensionPageAccess();
  const host = await startAgentHost(pageAccess);
  return {
    host,
    fixtureUrl: url,
    async close() {
      await host.close();
      await pageAccess.close();
      closeHttp();
    },
  };
}
