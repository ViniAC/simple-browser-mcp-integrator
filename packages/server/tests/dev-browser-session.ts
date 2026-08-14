import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildLoadableExtension } from "../../extension/build.js";
import { launchDevBrowser } from "../lib/launch-dev-browser.js";
import { serveFixture } from "../lib/serve-fixture.js";
import { createDevBrowserTabs } from "./dev-browser-tabs.js";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const attachServerEntry = path.join(
  repoRoot,
  "packages",
  "server",
  "tests",
  "attach-server.ts",
);

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
  const extensionDir = await mkdtemp(
    path.join(tmpdir(), "browser-mcp-loadable-"),
  );
  const extension = await buildLoadableExtension({
    dir: extensionDir,
    port: await availablePort(),
  });
  let host: Awaited<ReturnType<typeof startAttachAgentHost>> | undefined;
  let browser: Awaited<ReturnType<typeof launchDevBrowser>> | undefined;
  let beforeLaunchResource: HarnessResource | undefined;
  let closed = false;

  async function close() {
    if (closed) {
      return;
    }
    closed = true;
    await closeResources([
      () => host?.close(),
      () => browser?.close(),
      () => beforeLaunchResource?.close(),
      () => rm(extensionDir, { recursive: true, force: true }),
      closeHttp,
    ]);
  }

  try {
    host = await startAttachAgentHost(extension.secret, extension.port);
    beforeLaunchResource =
      await options.beforeExtensionLaunch?.(extension.websocketUrl);
    browser = await launchDevBrowser(extensionDir);
    const tabs = createDevBrowserTabs(browser.port);
    await tabs.ready();
    return {
      get host() {
        return requireHost(host);
      },
      fixtureUrl: url,
      tabs,
      async restartServer() {
        await requireHost(host).close();
        host = await startAttachAgentHost(extension.secret, extension.port);
      },
      close,
    };
  } catch (error) {
    await close().catch(() => {});
    throw error;
  }
}

async function startAttachAgentHost(secret: string, port: number) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--import", "tsx", attachServerEntry],
    cwd: repoRoot,
    env: {
      ...inheritedEnv(),
      BROWSER_MCP_ATTACH_SECRET: secret,
      BROWSER_MCP_ATTACH_PORT: String(port),
    },
    stderr: "pipe",
  });
  const stderr: string[] = [];
  transport.stderr?.on("data", (chunk) => stderr.push(String(chunk)));
  const client = new Client({ name: "test-agent-host", version: "0.0.0" });
  try {
    await client.connect(transport);
  } catch (error) {
    throw new Error(`${String(error)}\n${stderr.join("")}`);
  }
  return {
    callTool(name: string, args?: Record<string, unknown>) {
      return client.callTool({ name, arguments: args });
    },
    close() {
      return client.close();
    },
  };
}

function requireHost<T>(host: T | undefined): T {
  if (!host) {
    throw new Error("Agent Host is not connected to the Server");
  }
  return host;
}

export function availablePort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Expected a TCP address"));
        return;
      }
      server.close(() => resolve(address.port));
    });
  });
}

async function closeResources(
  closers: Array<() => void | Promise<void> | undefined>,
) {
  const errors: unknown[] = [];
  for (const closer of closers) {
    try {
      await closer();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) {
    throw errors[0];
  }
}

function inheritedEnv() {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
}
