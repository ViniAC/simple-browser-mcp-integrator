import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildLoadableExtension } from "../../extension/build.js";
import { launchDevBrowser } from "../lib/launch-dev-browser.js";
import { fixturePort } from "../lib/serve-fixture.js";
import { parseToolJson } from "./agent-host.js";
import { availablePort } from "./dev-browser-session.js";
import { fixtureInventory } from "./fixture-inventory.js";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const stdioEntry = path.join(repoRoot, "packages", "server", "stdio.ts");
const fixtureUrl = `http://127.0.0.1:${fixturePort}/`;

describe("stdio Agent Host does not launch a Dev Browser", () => {
  it("returns not_connected when nothing Attaches", async () => {
    const host = await startStdioAgentHost({
      BROWSER_MCP_ATTACH_SECRET: "stdio-no-attach",
      BROWSER_MCP_ATTACH_PORT: String(await availablePort()),
      BROWSER_MCP_ATTACH_TIMEOUT_MS: "250",
    });

    try {
      const parsed = parseToolJson(
        await host.callTool({ name: "get_inventory", arguments: {} }),
      );
      expect(parsed).toEqual({
        isError: true,
        body: { error: "not_connected" },
      });
    } finally {
      await host.close();
    }
  }, 30_000);
});

describe("stdio Agent Host loop", () => {
  let session: StdioLoopSession | undefined;

  beforeAll(async () => {
    session = await startStdioLoopSession();
    const notes = session.host.getInstructions() ?? "";
    expect(notes).toContain("Load unpacked");
    expect(notes).toContain(fixtureUrl);
  }, 180_000);

  afterAll(async () => {
    await session?.close();
  });

  it("opens the Fixture Page, Types, Clicks Submit, and re-reads the Result", async () => {
    const host = session?.host;
    if (!host) {
      throw new Error("Agent Host did not attach over stdio");
    }

    const opened = parseToolJson(
      await host.callTool({
        name: "open_page",
        arguments: { url: fixtureUrl },
      }),
    );
    const before = parseToolJson(
      await host.callTool({ name: "get_inventory", arguments: {} }),
    );
    const typed = parseToolJson(
      await host.callTool({
        name: "type",
        arguments: {
          role: "textbox",
          name: "Full name",
          value: "Ada Lovelace",
        },
      }),
    );
    const clicked = parseToolJson(
      await host.callTool({
        name: "click",
        arguments: { role: "button", name: "Submit" },
      }),
    );
    const after = parseToolJson(
      await host.callTool({ name: "get_inventory", arguments: {} }),
    );

    expect(opened).toEqual({ isError: false, body: { url: fixtureUrl } });
    expect(before.body).toEqual(fixtureInventory(fixtureUrl));
    expect(typed).toEqual({ isError: false, body: { ok: true } });
    expect(clicked).toEqual({ isError: false, body: { ok: true } });
    expect(after.body).toEqual(
      fixtureInventory(fixtureUrl, {
        fullName: "Ada Lovelace",
        result: "Submitted",
      }),
    );
  }, 180_000);
});

type StdioLoopSession = {
  host: Client;
  close(): Promise<void>;
};

async function startStdioLoopSession(): Promise<StdioLoopSession> {
  const extensionDir = await mkdtemp(
    path.join(tmpdir(), "browser-mcp-stdio-"),
  );
  const extension = await buildLoadableExtension({
    dir: extensionDir,
    port: await availablePort(),
  });
  const host = await startStdioAgentHost({
    BROWSER_MCP_ATTACH_SECRET: extension.secret,
    BROWSER_MCP_ATTACH_PORT: String(extension.port),
  });
  try {
    const browser = await launchDevBrowser(extensionDir);
    return {
      host,
      async close() {
        await host.close();
        await browser.close();
        await rm(extensionDir, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await host.close().catch(() => {});
    await rm(extensionDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

async function startStdioAgentHost(extraEnv: Record<string, string> = {}) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--import", "tsx", stdioEntry],
    cwd: repoRoot,
    env: { ...inheritedEnv(), ...extraEnv },
    stderr: "pipe",
  });
  const stderr: string[] = [];
  transport.stderr?.on("data", (chunk) => {
    stderr.push(String(chunk));
  });
  const host = new Client({ name: "test-agent-host", version: "0.0.0" });
  try {
    await host.connect(transport);
  } catch (error) {
    throw new Error(`${String(error)}\n${stderr.join("")}`);
  }
  return host;
}

function inheritedEnv() {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
}
