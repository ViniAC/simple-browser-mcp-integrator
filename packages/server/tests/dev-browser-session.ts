import { randomBytes } from "node:crypto";
import { createAttachPageAccess } from "../lib/extension-page-access.js";
import { launchDevBrowser } from "../lib/launch-dev-browser.js";
import { prepareExtension } from "../lib/prepare-extension.js";
import { serveFixture } from "../lib/serve-fixture.js";
import { startAgentHost } from "./agent-host.js";

type HarnessResource = {
  close(): void | Promise<void>;
};

type DevBrowserSessionOptions = {
  beforeExtensionLaunch?(
    websocketUrl: string,
  ): Promise<HarnessResource | undefined>;
};

export async function startDevBrowserSession(
  options: DevBrowserSessionOptions = {},
) {
  const { url, close: closeHttp } = await serveFixture();
  const secret = randomBytes(16).toString("hex");
  let pageAccess = await createAttachPageAccess({ secret });
  const port = pageAccess.port;
  const websocketUrl = `ws://127.0.0.1:${port}`;
  const extension = await prepareExtension({
    websocketUrl,
    token: secret,
  });
  let browser: Awaited<ReturnType<typeof launchDevBrowser>> | undefined;
  let beforeLaunchResource: HarnessResource | undefined;

  try {
    beforeLaunchResource =
      await options.beforeExtensionLaunch?.(websocketUrl);
    browser = await launchDevBrowser(extension.dir);
    const activeBrowser = browser;
    let host = await startAgentHost(pageAccess);
    return {
      get host() {
        return host;
      },
      fixtureUrl: url,
      async restartServer() {
        await host.close();
        await pageAccess.close();
        pageAccess = await createAttachPageAccess({ secret, port });
        host = await startAgentHost(pageAccess);
      },
      async close() {
        await host.close();
        await activeBrowser.close();
        await beforeLaunchResource?.close();
        await pageAccess.close();
        await extension.close();
        closeHttp();
      },
    };
  } catch (error) {
    await browser?.close();
    await beforeLaunchResource?.close();
    await pageAccess.close();
    await extension.close();
    closeHttp();
    throw error;
  }
}
